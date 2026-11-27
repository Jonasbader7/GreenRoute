# Georeferenzierung Plan Hoechstgewicht (PDF-Punkte) -> LV95, Einpassung an Netzabschnitten
import json, sqlite3, sys, numpy as np
from pathlib import Path
S = Path(sys.argv[1]); BORS = Path(sys.argv[2])
g = {}
exec(compile((BORS/'01_Skripte/Aktuell/bors_geo.py').read_text(encoding='utf-8'), 'bors_geo', 'exec'), g)
db = sqlite3.connect('file:{}?mode=ro'.format((BORS/'02_Daten/2_Aktuell_V9/BORS_Netzmaster_V9_20261101_2206.gpkg').as_posix()), uri=True)
seg = {}
for sid, nm, geom, L in db.execute("select seg_id, name, geom, laenge_m from netz_v5 where ist_routingtyp=1"):
    ls = g['linien'](geom)
    if not ls: continue
    pts = np.array([p for l in ls for p in l])
    if pts[:,0].min() > 2598000 and pts[:,0].max() < 2603500 and pts[:,1].min() > 1198000 and pts[:,1].max() < 1202500:
        seg[sid] = (nm or '', ls, L)
print('Abschnitte im Ausschnitt', len(seg))
plan = json.load(open(S/'plan_linien.json'))
plan = [o for o in plan if o['t'] != 'signal']
def mitte(sid):
    p = np.array([q for l in seg[sid][1] for q in l]); return p.mean(0)
def pmitte(o): p = np.array(o['pts']); return p.mean(0)
ctrl = [('w312022667', [o for o in plan if o['t']==10 and o['rect'][1] > 590][0]),
        ('w46097076', [o for o in plan if o['t']==10 and o['rect'][3]-o['rect'][1] > 100][0])]
for s, o in ctrl: print(s, seg[s][0], mitte(s), pmitte(o))
# Startwert: Massstab 1:6000 -> 1 pt = 25.4/72 mm * 6 = 2.1167 m, Nord oben
a = 25.4/72*6
(s1, o1), (s2, o2) = ctrl
A = np.array([[pmitte(o1)[0], 1, 0], [-pmitte(o1)[1], 0, 1]])
bE = np.mean([mitte(s)[0] - a*pmitte(o)[0] for s, o in ctrl]); bN = np.mean([mitte(s)[1] + a*pmitte(o)[1] for s, o in ctrl])
print('Start a=%.4f bE=%.1f bN=%.1f' % (a, bE, bN))
# ICP: Planpunkte (verdichtet) -> naechster Netzpunkt (verdichtet auf 2 m)
net = []
for sid, (nm, ls, L) in seg.items():
    for l in ls:
        for (x0,y0),(x1,y1) in zip(l[:-1], l[1:]):
            n = max(1, int(np.hypot(x1-x0, y1-y0)/2))
            for t in np.linspace(0,1,n+1): net.append((x0+t*(x1-x0), y0+t*(y1-y0)))
net = np.array(net)
from collections import defaultdict
grid = defaultdict(list)
for i,(x,y) in enumerate(net): grid[(int(x//20), int(y//20))].append(i)
def nn(x, y):
    best, bi = 1e9, -1
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for i in grid.get((int(x//20)+dx, int(y//20)+dy), ()):
                d = (net[i,0]-x)**2 + (net[i,1]-y)**2
                if d < best: best, bi = d, i
    return bi, best**0.5
P = []
for o in plan:
    if o['rect'][0] < 240 and o['rect'][1] < 360: continue      # Inset Felsenau
    pts = o['pts']
    for (x0,y0),(x1,y1) in zip(pts[:-1], pts[1:]):
        n = max(1, int(np.hypot(x1-x0, y1-y0)/1.0))
        for t in np.linspace(0,1,n+1): P.append((x0+t*(x1-x0), y0+t*(y1-y0)))
P = np.array(P)
for it in range(12):
    E = a*P[:,0] + bE; N = -a*P[:,1] + bN
    pr = [nn(e, n) for e, n in zip(E, N)]
    ok = np.array([d < (15 if it < 4 else 8) for _, d in pr])
    T = np.array([net[i] if i >= 0 else (np.nan, np.nan) for i, _ in pr])
    # kleinste Quadrate fuer a, bE, bN (ohne Rotation)
    X = P[ok]; Y = T[ok]
    M = np.zeros((2*len(X), 3)); r = np.zeros(2*len(X))
    M[0::2,0] = X[:,0]; M[0::2,1] = 1; r[0::2] = Y[:,0]
    M[1::2,0] = -X[:,1]; M[1::2,2] = 1; r[1::2] = Y[:,1]
    a, bE, bN = np.linalg.lstsq(M, r, rcond=None)[0]
    res = np.hypot(a*X[:,0]+bE-Y[:,0], -a*X[:,1]+bN-Y[:,1])
    print('it %d: a=%.4f bE=%.1f bN=%.1f  Punkte %d/%d  Rest median %.2f m p90 %.2f m' % (it, a, bE, bN, ok.sum(), len(P), np.median(res), np.percentile(res, 90)))
json.dump(dict(a=a, bE=bE, bN=bN), open(S/'georef.json', 'w'))
