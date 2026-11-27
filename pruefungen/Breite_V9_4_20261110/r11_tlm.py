# -*- coding: utf-8 -*-
"""Grobe unabhaengige Pruefung mit swissTLM3D-Breitenklassen (Objektkatalog swissTLM3D 1.7: 2m Weg 1.81-2.80 m, 1m Weg bis
1.80 m, 3m Strasse 2.81-4.20 m, 4m Strasse 4.21-6.20 m, ...; Mindestlaenge 50 m). Nur lesend.
Aufruf: python -I r11_tlm.py <BORS_ROOT> <netzmaster.gpkg> [<netzmaster2.gpkg> ...] -> Tabelle je Netzmaster
Zuordnung: TLM-Linie, deren Stuetzpunkte zu >= 70 % innerhalb 4 m der Abschnittsachse liegen und die >= 50 % der Achse abdeckt
(Achspunkte alle 2 m innerhalb 4 m einer TLM-Linie). Mehrere Klassen -> die schmalste (konservativ fuer den Konfliktnachweis
'Modell ausreichend, TLM schmal'). Konflikt: Klasse ausreichend/validiert, TLM-Obergrenze < Karosseriebreite bzw. < Bedarf."""
import math, sqlite3, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(sys.argv[1]); NMS = sys.argv[2:]
ns = {}
exec(compile((ROOT / '01_Skripte' / 'Aktuell' / 'bors_geo.py').read_text(encoding='utf-8'), 'bors_geo.py', 'exec'), ns)
linien, Raster = ns['linien'], ns['Raster']
KL = {'16': ('1m Weg', 1.80), '15': ('2m Weg', 2.80), '18': ('2m Wegfragment', 2.80), '11': ('3m Strasse', 4.20), '10': ('4m Strasse', 6.20),
      '9': ('6m Strasse', 8.20), '20': ('8m Strasse', 10.20), '8': ('10m Strasse', 99.0)}
c = sqlite3.connect('file:{}?mode=ro'.format((ROOT / '02_Daten' / '1_Rohdaten' / 'swisstopo' / 'swissTLM3D' / 'tlm3d_strassen_bors.gpkg').as_posix()), uri=True)
TL, R = [], Raster(50.0)
for g, oa in c.execute('select geom, objektart from tlm_strassen'):
    if oa not in KL:
        continue
    for l in linien(g):
        pts = []
        for (x0, y0), (x1, y1) in zip(l, l[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 2))
            pts += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
        pts.append(l[-1])
        i = len(TL); TL.append((oa, pts))
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        R.add(i, min(xs), min(ys), max(xs), max(ys))
BED = {'A': (1.94, 2.39), 'B': (2.20, 2.75), 'C': (2.50, 3.20), 'D': (2.56, 3.26)}
zuord = None
for nm in NMS:
    d = sqlite3.connect('file:{}?mode=ro'.format(nm.replace('\\', '/')), uri=True)
    cols = ['seg_id', 'geom', 'zone', 'laenge_m'] + ['{}_breite_v9'.format(p) for p in 'abcd'] + ['{}_v9_status'.format(p) for p in 'abcd']
    rows = d.execute('select {} from netz_v5 where ist_routingtyp = 1'.format(', '.join(cols))).fetchall()
    if zuord is None:
        zuord = {}
        for r in rows:
            if r[2] != 'BEWERTUNG' or (r[3] or 0) < 20:
                continue
            ax = []
            for l in linien(r[1]):
                for (x0, y0), (x1, y1) in zip(l, l[1:]):
                    n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 2))
                    ax += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
            if not ax:
                continue
            xs = [p[0] for p in ax]; ys = [p[1] for p in ax]
            best = None
            for i in R.nahe(min(xs) - 4, min(ys) - 4, max(xs) + 4, max(ys) + 4):
                oa, tp = TL[i]
                deck = sum(1 for (x, y) in ax if any((x - a) ** 2 + (y - b) ** 2 <= 16 for a, b in tp)) / len(ax)
                if deck < 0.5:
                    continue
                nah = sum(1 for (a, b) in tp if any((x - a) ** 2 + (y - b) ** 2 <= 16 for x, y in ax)) / len(tp)
                if nah < 0.7 and deck < 0.9:
                    continue
                if best is None or KL[oa][1] < KL[best][1]:
                    best = oa
            if best:
                zuord[r[0]] = best
    stat = Counter(); km = Counter(); konf = []
    for r in rows:
        oa = zuord.get(r[0])
        if not oa:
            continue
        hi = KL[oa][1]
        for j, P in enumerate('ABCD'):
            e, st = r[4 + j], r[8 + j]
            stat[(P, KL[oa][0], e)] += 1
            if e == 'AUSREICHEND' and hi < BED[P][1]:
                art = 'TLM-Klasse < Karosserie' if hi < BED[P][0] else 'TLM-Klasse < Bedarf'
                km[(P, art)] += (r[3] or 0) / 1000
                konf.append((P, art, r[0], KL[oa][0], round(r[3] or 0, 1), st))
    print('==', Path(nm).name, '| zugeordnet', len(zuord))
    for P in 'ABCD':
        n1 = sum(1 for k in konf if k[0] == P and k[1] == 'TLM-Klasse < Karosserie')
        n2 = sum(1 for k in konf if k[0] == P and k[1] == 'TLM-Klasse < Bedarf')
        print('  {} ausreichend trotz TLM-Klasse < Karosserie: {} ({:.2f} km) | < Bedarf: {} ({:.2f} km) | ausreichend auf TLM 2m/1m Weg gesamt: {}'.format(
            P, n1, km[(P, 'TLM-Klasse < Karosserie')], n2, km[(P, 'TLM-Klasse < Bedarf')],
            sum(stat[(P, k, 'AUSREICHEND')] for k in ('1m Weg', '2m Weg', '2m Wegfragment'))))
    out = Path(nm).with_name(Path(nm).stem + '_TLM_Konflikte.csv') if len(sys.argv) < 0 else None
    import csv
    with open(str(Path(__file__).resolve().parent.parent / 'ergebnisse' / ('tlm_konflikte_' + Path(nm).stem + '.csv')), 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh, delimiter=';'); w.writerow(['klasse', 'art', 'seg_id', 'tlm_klasse', 'laenge_m', 'status']); w.writerows(konf)
