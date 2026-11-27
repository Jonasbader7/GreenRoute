# Pruefung 4: Routen aus p3 gegen Daten, die BORS fuer die Breite nicht benutzt.
#  a) swissTLM3D (swisstopo, Breitenklasse je Strasse aus Luftbild/Topografie; weder AV/MOPUBE noch OSM)
#  b) KSVB (kantonales Verzeichnis der Verkehrsbeschraenkungen, amtlich)
# Nur sqlite3 + numpy, Geometrie (GPKG/WKB) wird hier selbst gelesen.
# Aufruf: python -I p4_unabhaengig.py <BORS-Wurzel>
import sys, json, sqlite3, struct, math, collections
from pathlib import Path
import numpy as np

W = Path(sys.argv[1])
PR = W / '05_Berichte/Pruefung_WebApp_V5_20261031'
TLM = W / '02_Daten/1_Rohdaten/swisstopo/swissTLM3D/tlm3d_strassen_bors.gpkg'
KSVB = W / '02_Daten/1_Rohdaten/Kanton_Bern/KSVB/KSVB_Kanton_Bern.gpkg'
NETZ = W / '04_WebApp/Entwicklung_V5_Vergleich_Einsatz/netz.json'
PROFIL = {'A': dict(h=1.64, t=3.1, b=1.94), 'B': dict(h=2.95, t=5.5, b=2.2), 'C': dict(h=3.2, t=17.0, b=2.5), 'D': dict(h=3.66, t=28.44, b=2.56)}


def wkb_linien(blob):
    """GPKG-Geometrie -> Liste von Linien [[(x,y),...]] (Point -> eine Linie mit einem Punkt)."""
    flags = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    b = memoryview(blob)[8 + env:]
    out = []

    def lese(o):
        bo = '<' if b[o] == 1 else '>'
        typ = struct.unpack_from(bo + 'I', b, o + 1)[0]
        dim = 2
        if typ & 0x80000000: dim += 1
        if typ & 0x40000000: dim += 1
        typ &= 0x0FFFFFFF
        if typ >= 1000: dim = {1: 3, 2: 3, 3: 4}[typ // 1000]; typ %= 1000
        o += 5
        if typ == 1:
            out.append([struct.unpack_from(bo + 'dd', b, o)]); return o + 8 * dim
        if typ == 2:
            n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4
            out.append([struct.unpack_from(bo + 'dd', b, o + i * 8 * dim) for i in range(n)]); return o + n * 8 * dim
        if typ in (4, 5):
            n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4
            for _ in range(n): o = lese(o)
            return o
        raise ValueError('WKB-Typ %d' % typ)
    lese(0)
    return out


class Index:
    """Liniensegmente mit 50-m-Raster; naechstes Segment zu einem Punkt."""
    def __init__(self, G=50.0):
        self.G, self.seg, self.attr, self.grid = G, [], [], collections.defaultdict(list)

    def add(self, linie, attr):
        for (x1, y1), (x2, y2) in zip(linie, linie[1:]):
            i = len(self.seg); self.seg.append((x1, y1, x2, y2)); self.attr.append(attr)
            for gx in range(int(min(x1, x2) // self.G), int(max(x1, x2) // self.G) + 1):
                for gy in range(int(min(y1, y2) // self.G), int(max(y1, y2) // self.G) + 1):
                    self.grid[(gx, gy)].append(i)

    def naechst(self, x, y, maxd):
        best = None
        gx, gy = int(x // self.G), int(y // self.G)
        for i in {i for dx in (-1, 0, 1) for dy in (-1, 0, 1) for i in self.grid.get((gx + dx, gy + dy), ())}:
            x1, y1, x2, y2 = self.seg[i]; dx, dy = x2 - x1, y2 - y1; l2 = dx * dx + dy * dy
            t = 0 if l2 == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
            d = math.hypot(x - x1 - t * dx, y - y1 - t * dy)
            if d <= maxd and (best is None or d < best[0]): best = (d, self.attr[i])
        return best


def stichproben(pts, schritt=5.0):
    """Punkte alle `schritt` m entlang einer Linie, je mit Gewicht (Meter)."""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        L = math.hypot(x2 - x1, y2 - y1); n = max(1, int(L // schritt))
        for k in range(n):
            t = (k + 0.5) / n; yield x1 + t * (x2 - x1), y1 + t * (y2 - y1), L / n


# ---------------------------------------------------------------- a) swissTLM3D
tlm = Index()
c = sqlite3.connect(TLM)
for geom, art, name in c.execute('select geom, objektart, strassenname from tlm_strassen'):
    for lin in wkb_linien(geom): tlm.add(lin, (int(art), name or ''))

# Codes entschluesseln: gemessene Fahrbahnbreite (AV-Median) der Netzabschnitte, deren Mitte auf eine TLM-Linie faellt
D = json.loads(NETZ.read_text(encoding='utf-8'))
mi = D['attr_cols'].index('v9_fahrbahn_median_m')
breiten = collections.defaultdict(list)
for f in range(0, len(D['segs']), 3):
    ids = D['segs'][f][0][0]; j = ids[len(ids) // 2]
    x, y = D['nodes'][2 * j] / 100 + D['x0'], D['nodes'][2 * j + 1] / 100 + D['y0']
    w = D['attr'][f][mi]; t = tlm.naechst(x, y, 3.0)
    if t and w: breiten[t[1][0]].append(w)
print('TLM-Code -> Median der AV-Fahrbahnbreite (n)')
for k in sorted(breiten, key=lambda k: -np.median(breiten[k])):
    if len(breiten[k]) >= 20: print('  %2d  %.2f m  (n=%d)' % (k, np.median(breiten[k]), len(breiten[k])))
# Klassennamen nach swissTLM3D-Objektkatalog; nur verwendet, wenn die Reihenfolge der Mediane dazu passt (siehe Ausgabe)
NAME = {8: '10m Strasse', 20: '8m Strasse', 9: '6m Strasse', 10: '4m Strasse', 11: '3m Strasse', 15: '2m Weg', 16: '1m Weg',
        2: 'Autobahn', 21: 'Autostrasse', 0: 'Ausfahrt', 1: 'Einfahrt', 4: 'Verbindung', 5: 'Zufahrt', 6: 'Dienstzufahrt', 12: 'Platz'}
SCHMAL = {15, 16, 17, 18}          # Wege: fuer C/D unplausibel
KNAPP = {11}                         # 3m Strasse: fuer C/D knapp

routen = json.loads((PR / 'p3_routen_geometrie.json').read_text(encoding='utf-8'))
erg_tlm = []
for r in routen:
    for farbe in ('gruen', 'blau'):
        rows = r[farbe]
        if not rows: continue
        tally, ohne, auff = collections.Counter(), 0.0, []
        for row in rows:
            seg_t = collections.Counter()
            for x, y, w in stichproben(row['pts']):
                t = tlm.naechst(x, y, 8.0)
                if t: tally[t[1][0]] += w; seg_t[t[1][0]] += w
                else: ohne += w
            if seg_t:
                k, m = seg_t.most_common(1)[0]
                if r['c'] in 'CD' and (k in SCHMAL or k in KNAPP) and m >= 10:
                    auff.append(dict(seg=row['seg'], name=row['name'], kat=row['kat'], tlm=NAME.get(k, k), m=round(m)))
        L = sum(tally.values()) + ohne
        erg_tlm.append(dict(id=r['id'], c=r['c'], farbe=farbe, L=round(L), ohne_tlm_m=round(ohne),
                            klassen={NAME.get(k, str(k)): round(v) for k, v in tally.most_common()}, auffaellig=auff))

# ---------------------------------------------------------------- b) KSVB
c = sqlite3.connect(KSVB); c.text_factory = bytes
ksvb = []
for tab in ('ksvb_ksvbo', 'ksvb_ksvbs'):
    for geom, typ, gv, bem in c.execute(f'select geom, KSVBT_KSVB, GRENZVAL, BEM from {tab}'):
        typ = typ.decode('cp1252'); bem = (bem or b'').decode('cp1252')
        art = {'H': 'h', 'G': 't', 'B': 'b'}.get(typ[0])
        if art and gv: ksvb.append(dict(tab=tab, typ=typ, art=art, wert=float(gv), bem=bem, linien=wkb_linien(geom)))
erg_ksvb = []
for r in routen:
    p = PROFIL[r['c']]
    for farbe in ('gruen', 'blau'):
        rows = r[farbe]
        if not rows: continue
        idx = Index()
        for row in rows: idx.add(row['pts'], row['seg'])
        for k in ksvb:
            if p[k['art']] <= k['wert'] + 1e-9: continue          # Fahrzeug haelt den Grenzwert ein
            # Punkt: <= 8 m von der Route; Linie: mind. 15 m der Linie liegen <= 5 m an der Route (kein blosses Kreuzen)
            if k['tab'] == 'ksvb_ksvbo':
                t = idx.naechst(*k['linien'][0][0], 8.0)
                if t: erg_ksvb.append(dict(id=r['id'], c=r['c'], farbe=farbe, ksvb=f"{k['typ']} {k['wert']:g}", bem=k['bem'], seg=t[1], d=round(t[0], 1)))
            else:
                m = sum(w for lin in k['linien'] for x, y, w in stichproben(lin, 2.0) if idx.naechst(x, y, 5.0))
                if m >= 15: erg_ksvb.append(dict(id=r['id'], c=r['c'], farbe=farbe, ksvb=f"{k['typ']} {k['wert']:g}", bem=k['bem'], ueberlappung_m=round(m)))
# Gegenprobe: welche KSVB-Grenzwerte liegen nahe den Testfaellen (zeigt, ob die Sperren amtlich belegt sind)
FALL = {'N04': (2600025, 1202850), 'N07': (2594450, 1195350), 'N08': (2589320, 1201300)}
naehe = {}
for fid, (x, y) in FALL.items():
    l = []
    for k in ksvb:
        d = min(math.hypot(px - x, py - y) for lin in k['linien'] for px, py in lin)
        if d < 1500: l.append((round(d), f"{k['typ']} {k['wert']:g}", k['bem']))
    naehe[fid] = sorted(l)[:6]

out = dict(tlm=erg_tlm, ksvb_konflikte=erg_ksvb, ksvb_naehe_testfaelle=naehe, ksvb_anzahl=len(ksvb),
           tlm_code_breite={str(k): [round(float(np.median(v)), 2), len(v)] for k, v in breiten.items() if len(v) >= 20})
(PR / 'p4_ergebnis.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print('KSVB-Objekte mit Grenzwert:', len(ksvb))
print('KSVB-Konflikte (Fahrzeug ueber Grenzwert auf der Route):', len(erg_ksvb))
for e in erg_ksvb: print('  ', e)
print('KSVB nahe Testfaellen:')
for k, v in naehe.items(): print('  ', k, v)
print('TLM: auffaellige Segmente fuer C/D (Mehrheit 2m/1m Weg oder 3m Strasse, >= 10 m)')
for e in erg_tlm:
    if e['auffaellig'] or e['c'] == 'D':
        print('  %-6s %s %-5s L=%5d m ohne TLM %4d m | %s' % (e['id'], e['c'], e['farbe'], e['L'], e['ohne_tlm_m'], dict(list(e['klassen'].items())[:5])))
        for a in e['auffaellig']: print('        ', a)
