# Zuordnung mit Richtungspruefung: Planlinie und Abschnitt muessen parallel laufen (keine Unterfuehrungen quer unter Bruecken)
import json, sqlite3, sys, csv, numpy as np
from pathlib import Path
from collections import defaultdict
S = Path(sys.argv[1]); BORS = Path(sys.argv[2])
g = {}
exec(compile((BORS/'01_Skripte/Aktuell/bors_geo.py').read_text(encoding='utf-8'), 'bors_geo', 'exec'), g)
T = json.load(open(S/'georef.json')); a, bE, bN = T['a'], T['bE'], T['bN']
plan = [o for o in json.load(open(S/'plan_linien.json')) if o['t'] != 'signal' and not (o['rect'][0] < 240 and o['rect'][1] < 360)]
PP = defaultdict(list)   # t -> (x, y, ux, uy)
for o in plan:
    pts = [(a*x+bE, -a*y+bN) for x, y in o['pts']]
    for (x0,y0),(x1,y1) in zip(pts[:-1], pts[1:]):
        L = np.hypot(x1-x0, y1-y0)
        if L < 1e-6: continue
        ux, uy = (x1-x0)/L, (y1-y0)/L
        for t in np.linspace(0, 1, max(1, int(L/1.0))+1):
            PP[o['t']].append((x0+t*(x1-x0), y0+t*(y1-y0), ux, uy))
grid = {t: defaultdict(list) for t in PP}
for t, pts in PP.items():
    for q in pts: grid[t][(int(q[0]//10), int(q[1]//10))].append(q)
def naechst(t, x, y):
    best, bq = 1e18, None
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for q in grid[t].get((int(x//10)+dx, int(y//10)+dy), ()):
                d = (q[0]-x)**2 + (q[1]-y)**2
                if d < best: best, bq = d, q
    return best**0.5, bq
HK = {}
for r in csv.DictReader(open(BORS/'02_Daten/2_Aktuell_V9/BORS_Netzmaster_V9_20261101_2206_HINDKAT_Zuordnung.csv', encoding='utf-8-sig'), delimiter=';'):
    if r['seg_id'] and r['tonnsig_t']: HK[r['seg_id']] = min(float(r['tonnsig_t']), HK.get(r['seg_id'], 99))
db = sqlite3.connect('file:{}?mode=ro'.format((BORS/'02_Daten/2_Aktuell_V9/BORS_Netzmaster_V9_20261101_2206.gpkg').as_posix()), uri=True)
TOL, MIN_ANTEIL, MIN_PARALLEL, MIN_LAENGE_M = 6.0, 0.6, 0.8, 15.0
alle, neu = [], []
for sid, nm, geom, L, hw, glim, gq, cs, ds, bs in db.execute("select seg_id, name, geom, laenge_m, highway_type, v8_g_limit, v8_g_quelle, c_v9_status, d_v9_status, b_v9_status from netz_v5 where ist_routingtyp=1"):
    ls = g['linien'](geom)
    if not ls: continue
    pts = []
    for l in ls:
        for (x0,y0),(x1,y1) in zip(l[:-1], l[1:]):
            Ls = np.hypot(x1-x0, y1-y0)
            if Ls < 1e-6: continue
            ux, uy = (x1-x0)/Ls, (y1-y0)/Ls
            pts += [(x0+t*(x1-x0), y0+t*(y1-y0), ux, uy) for t in np.linspace(0, 1, max(1, int(Ls/2))+1)]
    if not pts: continue
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    if max(xs) < 2599100 or min(xs) > 2601800 or max(ys) < 1198800 or min(ys) > 1200800: continue
    best = None
    for t in sorted(PP):
        treffer = par = 0
        for x, y, ux, uy in pts:
            d, q = naechst(t, x, y)
            if d <= TOL:
                treffer += 1
                par += abs(ux*q[2] + uy*q[3]) >= MIN_PARALLEL
        if not treffer: continue
        ant, parant = treffer/len(pts), par/treffer
        r = dict(seg_id=sid, name=nm or '', highway=hw, laenge_m=round(L or 0, 1), plan_t=t, anteil=round(ant, 2), parallel=round(parant, 2),
                 netz_osm_t=glim if glim is not None else '', netz_quelle=gq or '', hindkat_t=HK.get(sid, ''),
                 status_vorher_B=bs, status_vorher_C=cs, status_vorher_D=ds)
        ok = parant >= 0.7 and (ant >= MIN_ANTEIL or ant * (L or 0) >= MIN_LAENGE_M)   # auch Teilabdeckung >= 15 m: Durchfahrt fuehrt ueber den beschraenkten Teil
        r['zugeordnet'] = 'ja' if ok else 'nein (Abdeckung < 60 % und < 15 m, oder quer)'
        alle.append(r)
        if ok and (best is None or t < best['plan_t']):
            best = r
    if best:
        heute = min([v for v in (best['netz_osm_t'], best['hindkat_t']) if v != ''] or [40.0])
        best['heute_t'] = heute
        best['wirkung'] = 'neu strenger' if best['plan_t'] < heute - 1e-9 else 'schon im Netz'
        neu.append(best)
alle.sort(key=lambda r: (r['zugeordnet'], r['name'], r['seg_id']))
f = list(alle[0])
with open(S/'zuordnung_alle.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=f, delimiter=';'); w.writeheader(); w.writerows(alle)
neu.sort(key=lambda r: (r['wirkung'], r['plan_t'], r['name']))
with open(S/'zuordnung_final.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=list(neu[0]), delimiter=';'); w.writeheader(); w.writerows(neu)
from collections import Counter
print(Counter((r['wirkung'], r['plan_t']) for r in neu))
for r in neu:
    if r['wirkung'] == 'neu strenger':
        print(r['plan_t'], r['seg_id'], r['name'], r['highway'], r['laenge_m'], 'heute', r['heute_t'], r['anteil'], r['parallel'], r['status_vorher_C'], r['status_vorher_D'])
print('--- nicht zugeordnet, Abdeckung >= 0.3 ---')
for r in alle:
    if r['zugeordnet'] != 'ja' and r['anteil'] >= 0.3:
        print(r['plan_t'], r['seg_id'], r['name'], r['highway'], r['laenge_m'], r['anteil'], r['parallel'])
