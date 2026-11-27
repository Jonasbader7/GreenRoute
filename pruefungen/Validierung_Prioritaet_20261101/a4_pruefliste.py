# Prueffliste: unvalidierte Abschnitte mit der groessten Wirkung auf Routen ab der Hauptwache, mit Grund und Pruefmethode
# Aufruf: python -I a4_pruefliste.py <netzmaster.gpkg> <netz.json> <wirkung.json> <stichprobe.json> <ausgabe.csv>
import csv, json, math, sqlite3, sys
from collections import defaultdict

nm, nj, wj, sj, aus = sys.argv[1:6]
D = json.load(open(nj, encoding='utf-8'))
W = json.load(open(wj, encoding='utf-8'))
S = json.load(open(sj, encoding='utf-8'))
ac = {c: i for i, c in enumerate(D['attr_cols'])}
fidx = {a[ac['seg_id']]: f for f, a in enumerate(D['attr'])}
db = sqlite3.connect('file:{}?mode=ro&immutable=1'.format(nm), uri=True)
G = {}
for r in db.execute('select seg_id, v9_engstelle_pos_m, a_v9_status,a_v9_grund,b_v9_status,b_v9_grund,c_v9_status,c_v9_grund,d_v9_status,d_v9_grund, laenge_m, v9_fahrbahn_median_m from netz_v5'):
    G[r[0]] = dict(eng=r[1], st={p: r[2 + 2 * i] for i, p in enumerate('ABCD')}, gr={p: r[3 + 2 * i] or '' for i, p in enumerate('ABCD')},
                   # Verdacht Kreuzungsartefakt: Engstelle <= 8 m vom Abschnittsende, Median der Fahrbahn >= 6 m
                   kreuzung=r[1] is not None and min(r[1], (r[10] or 0) - r[1]) <= 8 and (r[11] or 0) >= 6)


def punkt(f, pos):
    """Punkt auf dem Abschnitt in LV95: pos Meter ab Anfang, sonst Mitte."""
    ids = [i for part in D['segs'][f][0] for i in part]
    xy = [(D['nodes'][2 * i] / 100 + D['x0'], D['nodes'][2 * i + 1] / 100 + D['y0']) for i in ids]
    L = sum(math.dist(xy[i], xy[i + 1]) for i in range(len(xy) - 1))
    s = pos if pos is not None and 0 <= pos <= L else L / 2
    for i in range(len(xy) - 1):
        d = math.dist(xy[i], xy[i + 1])
        if s <= d or i == len(xy) - 2:
            t = s / d if d else 0
            return xy[i][0] + t * (xy[i + 1][0] - xy[i][0]), xy[i][1] + t * (xy[i + 1][1] - xy[i][1])
        s -= d
    return xy[0]


def methode(gr):
    """Kategorie, Pruefmethode und was konkret zu pruefen ist (nach dem ersten Grund)."""
    g = gr.split(' | ')[0]
    if 'Rand weich' in g:
        return ('Rand weich', 'Orthofoto, sonst vor Ort',
                'Ist der Rand neben der AV-Fahrbahn befestigt (Asphalt, Pflaster, Rinne) und befahrbar? Fahrbahn + befestigter Rand messen')
    if 'Messtoleranz' in g:
        return ('Breite knapp (in Messtoleranz)', 'vor Ort messen',
                'Engste Stelle Randstein zu Randstein messen (Messband/Laser), dazu feste Hindernisse am Rand')
    if 'Spiegel' in g:
        return ('nur mit Spiegel ueber Trottoir/ohne Reserve', 'vor Ort',
                'Engste Stelle messen; stehen Masten, Signale, Poller direkt am Randstein (Spiegelhoehe ca. 2 m)?')
    if 'Messluecke' in g:
        return ('Messluecke', 'Orthofoto (Messwerkzeug)',
                'Fahrbahnbreite im Bereich der Luecke auf SWISSIMAGE messen')
    if 'Bauwerksbreite' in g or 'Bruecke/Tunnel' in g:
        return ('Bruecke/Tunnel', 'Orthofoto (Bruecke) bzw. vor Ort (Tunnel/Unterfuehrung)',
                'Fahrbahnbreite zwischen Randsteinen/Gelaendern auf dem Bauwerk; bei Unterfuehrung auch lichte Hoehe')
    if 'Parkfeld' in g:
        return ('nur ohne parkierte Autos', 'vor Ort zu mehreren Zeiten bzw. Entscheid',
                'Restbreite bei belegten Parkfeldern messen; Entscheid, ob Parkfelder als belegt gelten')
    if 'PN' in g:
        return ('AV provisorisch (PN)', 'Orthofoto (Messwerkzeug)', 'Fahrbahnbreite auf SWISSIMAGE messen')
    if 'Achse ausserhalb' in g:
        return ('OSM-Achse ausserhalb AV', 'Orthofoto', 'Liegt die Strasse wirklich dort? Fahrbahnbreite messen')
    if 'Gewicht' in g:
        return ('Tragfaehigkeit ungeklaert', 'Fachstelle (Eigentuemer, Tiefbauamt, Feuerwehr)',
                'Ist die Zufahrt fuer das Fahrzeuggewicht ausgelegt (Feuerwehrzufahrt, Tiefgaragendecke)?')
    if 'Hoehe' in g:
        return ('Hoehe ungeklaert', 'vor Ort (Laser) oder Signal', 'Lichte Hoehe der Ueberbauung messen bzw. Signal ablesen')
    if 'Hindernis' in g:
        return ('Hindernis (Poller/Sperre)', 'vor Ort bzw. Feuerwehr', 'Typ des Hindernisses, versenkbar/umlegbar, Schluessel FKS?')
    return ('anderes', 'pruefen', g[:80])


rang = defaultdict(dict)
for c in 'ABCD':
    for e in W['klassen'][c]['liste']:
        rang[e['seg_id']][c] = (e['rang'], e['luecke_km'])
stich = defaultdict(lambda: defaultdict(lambda: [0, 0]))
for e in S['liste']:
    stich[e['seg_id']][e['klasse']] = [e['in_hauptroute'], e['in_alternative']]

kand = set()
for c, n in (('D', 100), ('C', 100), ('B', 60), ('A', 40)):
    kand |= {e['seg_id'] for e in W['klassen'][c]['liste'][:n]}
kand |= {e['seg_id'] for e in S['liste'] if e['in_hauptroute'] + e['in_alternative'] >= 2}

zeilen = []
for sid in kand:
    f = fidx[sid]; g = G[sid]
    unv = ''.join(p for p in 'ABCD' if g['st'][p] == 'UNVALIDIERT')
    if not unv:
        continue
    pm = 'D' if 'D' in unv else unv[-1]          # massgebende (schwerste unvalidierte) Klasse
    kat, meth, was = methode(g['gr'][pm])
    E, Nn = punkt(f, g['eng'])
    lk = {c: rang[sid].get(c, (None, 0))[1] for c in 'ABCD'}
    hs = sum(stich[sid][c][0] for c in 'ABCD'); al = sum(stich[sid][c][1] for c in 'ABCD')
    wert = max(lk['D'], lk['C'], lk['B'] * 0.8, lk['A'] * 0.6) + 2.0 * hs + 0.5 * al   # einfache Rangzahl
    a = D['attr'][f]
    zeilen.append(dict(seg_id=sid, strasse=a[ac['name']] or '(ohne Namen)', gemeinde=a[ac['gemeinde']] or '', strassentyp=a[ac['highway_type']] or '',
                       laenge_m=round(sum(math.dist((D['nodes'][2 * p[i]], D['nodes'][2 * p[i] + 1]), (D['nodes'][2 * p[i + 1]], D['nodes'][2 * p[i + 1] + 1]))
                                          for p in D['segs'][f][0] for i in range(len(p) - 1)) / 100),
                       unvalidiert_fuer=' '.join(unv), luecke_km_A=lk['A'], luecke_km_B=lk['B'], luecke_km_C=lk['C'], luecke_km_D=lk['D'],
                       stichprobe_hauptroute=hs, stichprobe_alternative=al, rangzahl=round(wert, 1),
                       kategorie=kat, verdacht_kreuzungsartefakt='ja' if g['kreuzung'] and g['gr'][pm].startswith('Breite') else '', methode=meth, was_pruefen=was, grund_netzmaster=g['gr'][pm][:250],
                       E=round(E), N=round(Nn),
                       karte='https://map.geo.admin.ch/#/map?lang=de&center={:.0f},{:.0f}&z=12&bgLayer=ch.swisstopo.swissimage'.format(E, Nn),
                       befund='', gemessene_breite_m='', methode_befund='', beleg='', geprueft_von='', datum=''))
zeilen.sort(key=lambda z: -z['rangzahl'])
for i, z in enumerate(zeilen, 1):
    z['rang'] = i
felder = ['rang'] + [k for k in zeilen[0] if k != 'rang']
with open(aus, 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=felder, delimiter=';'); w.writeheader(); w.writerows(zeilen)
print(len(zeilen), 'Zeilen ->', aus)
from collections import Counter
print(Counter(z['kategorie'] for z in zeilen[:50]).most_common())
print(Counter(z['methode'] for z in zeilen[:50]).most_common())
