# Unvalidierte km je Klasse nach Ursache -> welche Ursachen Fernerkundung adressieren kann
import json, math, re, sys
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}; T = D['texte']
X = [D['nodes'][2*i]/100 for i in range(len(D['nodes'])//2)]; Y = [D['nodes'][2*i+1]/100 for i in range(len(D['nodes'])//2)]
L = [sum(math.hypot(X[ids[i]]-X[ids[i-1]], Y[ids[i]]-Y[ids[i-1]]) for ids in s[0] for i in range(1, len(ids))) for s in D['segs']]
REGELN = [  # (Muster im Grund, Kategorie, Fernerkundung?)
    (r'innerhalb der Messtoleranz', 'Breite in Messtoleranz', 'nein – LiDAR/Ortho nicht genauer als AV TS2'),
    (r'Spiegel ueber Trottoir|ohne Fahrreserve', 'nur mit Spiegel über Trottoir passierbar', 'teilweise – Masten/Signale am Randstein (LiDAR)'),
    (r'Messluecke', 'Messlücke im Abschnitt', 'ja – Fahrbahnrand aus LiDAR/Orthofoto'),
    (r'belegten Parkfeldern', 'nur ohne parkierte Autos', 'nein – Momentaufnahme, Parkierung wechselt'),
    (r'Rand weich', 'weicher Rand (Bankett)', 'ja – Neigung/Befestigung aus LiDAR'),
    (r'PN \(provisorische', 'AV provisorisch (PN)', 'ja – Breite aus Orthofoto/LiDAR'),
    (r'Achse ausserhalb', 'OSM-Achse ausserhalb AV-Fahrbahn', 'ja – Abgleich mit Orthofoto'),
    (r'Bruecke/Tunnel|Bauwerksbreite|Tunnel Unterf', 'Brücke/Tunnel ohne Fahrbahnfläche', 'teilweise – LiDAR auf Brücken ja, in Tunneln nein'),
    (r'Hoehe ungeklaert|Ueberbauung', 'Höhe ungeklärt (Überbauung)', 'ja – Durchfahrtshöhe aus LiDAR (Punktwolke)'),
    (r'Gewicht ungeklaert', 'Tragfähigkeit ungeklärt', 'nein – nicht sichtbar'),
    (r'Steigung', 'Steigung', 'ja – swissALTI3D'),
]
for c in 'CD':
    km = Counter(); haupt = Counter()
    for f, a in enumerate(D['attr']):
        if a[ac['ausserhalb']] or D['kat'][c][f] != 1: continue
        g = T[D['grund'][c][f]] or ''
        treffer = [k for m, k, _ in REGELN if re.search(m, g)]
        haupt[treffer[0] if treffer else 'sonstiges: ' + g[:50]] += L[f]
        for k in set(treffer): km[k] += L[f]
    tot = sum(haupt.values())
    print('\n%s unvalidiert gesamt %.0f km. Ursache (erste genannte / alle Nennungen):' % (c, tot/1000))
    for m, k, rs in REGELN: print('  %-42s %6.1f / %6.1f km   Fernerkundung: %s' % (k, haupt[k]/1000, km[k]/1000, rs))
    for k, v in haupt.items():
        if k.startswith('sonstiges') and v > 2000: print('  %-60s %6.1f km' % (k, v/1000))
