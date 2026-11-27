# Unabhaengige Nachmessung der Fahrbahnbreite an 600 zufaelligen BORS-Querprofilen (Status OK) direkt aus AV "Strasse, Weg"
import sqlite3, struct, random, math, statistics as st, time
import numpy as np
V9 = 'C:/Users/Bader/Documents/BORS_V9/'
def wkb_polys(g):
    fl = g[3]; o = 8 + [0, 32, 48, 48, 64][(fl >> 1) & 7]; b = memoryview(g)
    def u32(o, bo): return struct.unpack_from(bo+'I', b, o)[0]
    bo = '<' if g[o] == 1 else '>'; typ = u32(o+1, bo); o += 5; rings = []
    n = u32(o, bo) if typ == 6 else 1; o += 4 if typ == 6 else 0
    for _ in range(n):
        if typ == 6: bo = '<' if g[o] == 1 else '>'; o += 5
        nr = u32(o, bo); o += 4
        for _ in range(nr):
            npt = u32(o, bo); o += 4
            rings.append(np.frombuffer(g, dtype=bo+'f8', count=2*npt, offset=o).reshape(-1, 2).copy()); o += 16*npt
    return rings
def pt(g):
    fl = g[3]; o = 8 + [0, 32, 48, 48, 64][(fl >> 1) & 7]; bo = '<' if g[o] == 1 else '>'
    return struct.unpack_from(bo+'dd', g, o+5)
t0 = time.time()
c = sqlite3.connect('file:'+V9+'av_export_20261028_1447.gpkg?mode=ro', uri=True)
polys = []
for (g,) in c.execute("select geom from bb where bbartt_bez_de='Strasse, Weg'"):
    r = wkb_polys(g); allp = np.vstack(r); polys.append((r, allp.min(0), allp.max(0)))
print('Strassenflaechen', len(polys), round(time.time()-t0), 's')
pc = sqlite3.connect('file:'+V9+'BORS_Breite_V9_20261028_1654_profile.gpkg?mode=ro', uri=True)
P = {}
for sid, s, stt, fb, g in pc.execute('select seg_id, station_m, status, fahrbahn_m, geom from profile_v9'):
    P.setdefault(sid, {})[round(s, 1)] = (stt, fb, pt(g))
random.seed(11)
cand = [(sid, s) for sid, d in P.items() for s, v in d.items() if v[0] == 'OK' and (round(s-3, 1) in d) and (round(s+3, 1) in d)]
sample = random.sample(cand, 600)
def inside(x, y, rings):
    # Gerade-Ungerade ueber alle Ringe (inkl. Loecher)
    ins = False
    for R in rings:
        x1, y1 = R[:-1, 0], R[:-1, 1]; x2, y2 = R[1:, 0], R[1:, 1]
        m = ((y1 > y) != (y2 > y))
        if m.any():
            xi = x1[m] + (y - y1[m]) * (x2[m] - x1[m]) / (y2[m] - y1[m])
            ins ^= bool((xi > x).sum() % 2)
    return ins
def schnitt(px, py, dx, dy, H):
    ax, ay, bx, by = px-H*dx, py-H*dy, px+H*dx, py+H*dy
    lo, hi = np.array([min(ax, bx), min(ay, by)]), np.array([max(ax, bx), max(ay, by)])
    ts = [0.0, 1.0]; cs = []
    for rings, mn, mx in polys:
        if (mn > hi).any() or (mx < lo).any(): continue
        cs.append(rings)
        for R in rings:
            ex, ey = R[1:, 0]-R[:-1, 0], R[1:, 1]-R[:-1, 1]; rx, ry = bx-ax, by-ay
            den = rx*ey - ry*ex; ok = np.abs(den) > 1e-12
            qx, qy = R[:-1, 0]-ax, R[:-1, 1]-ay
            t = np.where(ok, (qx*ey - qy*ex)/np.where(ok, den, 1), -1); u = np.where(ok, (qx*ry - qy*rx)/np.where(ok, den, 1), -1)
            m = ok & (t >= 0) & (t <= 1) & (u >= 0) & (u <= 1); ts.extend(t[m].tolist())
    ts = sorted(set(ts)); iv = []
    for a, b in zip(ts, ts[1:]):
        if b - a < 1e-9: continue
        tm = (a+b)/2; x, y = ax+tm*(bx-ax), ay+tm*(by-ay)
        if any(inside(x, y, r) for r in cs): iv.append([a*2*H, b*2*H])
    mg = []
    for a, b in iv:
        if mg and a - mg[-1][1] < 0.05: mg[-1][1] = b
        else: mg.append([a, b])
    for a, b in mg:
        if a <= H <= b: return (b-a, a < 0.01 or b > 2*H-0.01)
    return (None, False)
res = []
for sid, s in sample:
    d = P[sid]; (x0, y0), (x1, y1) = d[round(s-3, 1)][2], d[round(s+3, 1)][2]; px, py = d[s][2]
    L = math.hypot(x1-x0, y1-y0)
    if L < 1: continue
    tx, ty = (x1-x0)/L, (y1-y0)/L; ws = []; rand = False
    for wdeg in (-20, -10, 0, 10, 20):
        w = math.radians(wdeg); nx, ny = -ty*math.cos(w) - tx*math.sin(w), tx*math.cos(w) - ty*math.sin(w)
        wd, r = schnitt(px, py, nx, ny, 30.0); rand |= r
        if wd is not None: ws.append(wd)
    if len(ws) == 5 and not rand: res.append((sid, s, min(ws), d[s][1]))
print('nachgemessen', len(res), 'von', len(sample), round(time.time()-t0), 's')
dif = [a-b for _, _, a, b in res]; ad = sorted(abs(x) for x in dif)
print('Differenz eigene - BORS: Median %+.3f m, P90 |d| %.3f m, P95 |d| %.3f m, max |d| %.2f m' % (st.median(dif), ad[int(.9*len(ad))], ad[int(.95*len(ad))], ad[-1]))
for g in (0.01, 0.05, 0.10, 0.25): print('  |d| <= %.2f m: %.1f %%' % (g, 100*sum(x <= g for x in ad)/len(ad)))
print('groesste Abweichungen:', [(a, b, round(w, 2), round(f, 2)) for a, b, w, f in sorted(res, key=lambda r: -abs(r[2]-r[3]))[:8]])
import json
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}
H = {a[0]: a[ac['highway_type']] for a in D['attr']}
ns = [r for r in res if H.get(r[0]) != 'service']; sv = [r for r in res if H.get(r[0]) == 'service']
for name, R in (('ohne service', ns), ('service', sv)):
    ad = sorted(abs(a-b) for _, _, a, b in R)
    print(name, 'n=%d  |d|<=0.01 m: %.1f%%  |d|>0.05 m: %d  davon eigene < BORS: %d' % (len(R), 100*sum(x <= .01 for x in ad)/len(ad), sum(x > .05 for x in ad), sum(a-b < -0.05 for _, _, a, b in R)))
print('Abweichungen ausserhalb service:', [(a, b, round(w, 2), round(f, 2), H.get(a)) for a, b, w, f in ns if abs(w-f) > .01])
