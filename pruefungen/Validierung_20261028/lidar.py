# swissSURFACE3D 2023: Laengsprofil der Punktwolke entlang der BORS-Achse durch eine Unterfuehrung
import laspy, numpy as np, json, math, sys
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')
LAS, HX, HY, NAME, HSIG = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}
X = np.array(D['nodes'][0::2])/100+D['x0']; Y = np.array(D['nodes'][1::2])/100+D['y0']
# Achse: alle Abschnitte mit passendem Namen, Kanten <= 70 m vom Hindernis
E = []
for f, s in enumerate(D['segs']):
    if (D['attr'][f][ac['name']] or '') != NAME: continue
    for ids in s[0]:
        for a, b in zip(ids, ids[1:]):
            if min(math.hypot(X[a]-HX, Y[a]-HY), math.hypot(X[b]-HX, Y[b]-HY)) <= 70: E.append((X[a], Y[a], X[b], Y[b], f))
fs = sorted(set(e[4] for e in E))
print('Achse', [D['attr'][f][0] for f in fs], NAME, 'OSM maxheight=%s, Signal Kanton=%s' % ([D['attr'][f][ac['maxheight']] for f in fs], HSIG))
pts = np.array([[e[0], e[1]] for e in E] + [[e[2], e[3]] for e in E])
u, sv, vt = np.linalg.svd(pts - pts.mean(0)); dirx, diry = vt[0]
las = laspy.read(LAS)
px, py, pz, cl = np.asarray(las.x), np.asarray(las.y), np.asarray(las.z), np.asarray(las.classification)
m = (np.abs(px-HX) < 45) & (np.abs(py-HY) < 45)
px, py, pz, cl = px[m], py[m], pz[m], cl[m]
print('Punkte im 90-m-Fenster:', m.sum(), 'Klassen:', dict(Counter(cl.tolist())))
# Projektion: Station entlang Hauptrichtung, Querabstand zur naechsten Achskante
S = (px-HX)*dirx + (py-HY)*diry; Q = np.full(px.shape, np.inf)
for x1, y1, x2, y2, _ in E:
    dx, dy = x2-x1, y2-y1; L2 = dx*dx+dy*dy
    if L2 == 0: continue
    t = np.clip(((px-x1)*dx+(py-y1)*dy)/L2, 0, 1); Q = np.minimum(Q, np.hypot(px-x1-t*dx, py-y1-t*dy))
s0 = 0.0
sel = (Q <= 2.0) & (np.abs(S-s0) <= 40)
print('Punkte innerhalb 2 m der Achse, +-40 m um das Hindernis:', sel.sum())
print('Station  Boden(min Kl.2)  tiefster Nicht-Boden-Punkt ueber Boden (Klasse)  hoechster Punkt  n')
gz_prev = None; rows = []
for b in range(-40, 41, 2):
    w = sel & (S >= s0+b) & (S < s0+b+2)
    g = w & (cl == 2)
    gz = np.median(pz[g]) if g.any() else np.nan
    rows.append((b, gz, w))
gzs = np.array([r[1] for r in rows]); st = np.array([r[0] for r in rows])
ok = ~np.isnan(gzs)
gint = np.interp(st, st[ok], gzs[ok])   # Boden unter der Bruecke linear interpoliert (dort keine Bodenpunkte)
for (b, gz, w), gi in zip(rows, gint):
    ng = w & (cl != 2) & (cl != 7)
    over = ng & (pz > gi+1.0)
    low = (pz[over]-gi).min() if over.any() else np.nan
    lowcl = int(cl[over][np.argmin(pz[over])]) if over.any() else -1
    top = (pz[w]-gi).max() if w.any() else np.nan
    print('%+4d m   %8s        %6s m  (Kl. %2s)                          %6s m   %d' % (b, '%.2f' % gz if not np.isnan(gz) else ' (interp)', '%.2f' % low if not np.isnan(low) else '  -', lowcl if lowcl >= 0 else '-', '%.2f' % top if not np.isnan(top) else '-', w.sum()))
# Zusammenfassung: tiefste Punkte ueber der Fahrbahn im Bauwerksbereich (keine Boden-, Vegetations-, Rauschpunkte)
core = sel & (np.abs(S-s0) <= 10) & ~np.isin(cl, [2, 3, 4, 5, 7])
gi_all = np.interp(S, st, gint)
h = pz - gi_all
cand = core & (h > 1.5) & (h < 12)
o = np.argsort(h[cand])[:8]
print('Tiefste Punkte ueber Fahrbahn (|s|<=10 m, q<=2 m): ' + ', '.join('%.2f m (Kl.%d, s=%+.1f, q=%.1f)' % (h[cand][j], cl[cand][j], S[cand][j], Q[cand][j]) for j in o))
print('LIDAR_SCHAETZUNG %s %.2f SIGNAL %s' % (NAME, h[cand][o[0]] if len(o) else float('nan'), HSIG))
