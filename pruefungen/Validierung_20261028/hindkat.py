# Hinderniskartei Kanton Bern (SVSA, Stand 24.08.2026) gegen BORS-Netz: Hoehe/Gewicht je Hindernis
import sqlite3, struct, json, math, sys
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')
HK = sys.argv[1]
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}
X = [D['nodes'][2*i]/100+D['x0'] for i in range(len(D['nodes'])//2)]; Y = [D['nodes'][2*i+1]/100+D['y0'] for i in range(len(D['nodes'])//2)]
P = D['profile']
def pt(g):
    o = 8 + [0, 32, 48, 48, 64][(g[3] >> 1) & 7]; bo = '<' if g[o] == 1 else '>'
    return struct.unpack_from(bo+'dd', g, o+5)
def dist_seg(px, py, f):
    best = 1e9
    for ids in D['segs'][f][0]:
        for a, b in zip(ids, ids[1:]):
            dx, dy = X[b]-X[a], Y[b]-Y[a]; l2 = dx*dx+dy*dy
            t = 0 if l2 == 0 else max(0, min(1, ((px-X[a])*dx+(py-Y[a])*dy)/l2))
            best = min(best, math.hypot(px-X[a]-t*dx, py-Y[a]-t*dy))
    return best
mn = (min(X), min(Y)); mx = (max(X), max(Y))
# grobes Raster fuer Kandidaten
grid = {}
for f, s in enumerate(D['segs']):
    for ids in s[0]:
        for i in ids: grid.setdefault((int(X[i]//100), int(Y[i]//100)), set()).add(f)
c = sqlite3.connect('file:'+HK+'?mode=ro', uri=True)
rows = []
for hn, art, typ, ort, strn, hs, ts, dv, db, g in c.execute('select hindnr, hindart, hindt_bez_de, ort, strname, hoehesig, tonnsig, datumvon, datumbis, geometry from "geodb.hindkat_hindrnis_vw"'):
    x, y = pt(g)
    if not (mn[0] <= x <= mx[0] and mn[1] <= y <= mx[1]): continue
    cand = set().union(*[grid.get((int(x//100)+i, int(y//100)+j), set()) for i in (-1, 0, 1) for j in (-1, 0, 1)])
    near = sorted((dist_seg(x, y, f), f) for f in cand)[:4]
    if not near or near[0][0] > 40: rows.append((hn, art, typ, ort, strn, hs, ts, None, None, x, y)); continue
    # bevorzugt Abschnitt mit gleichem Strassennamen
    same = [n for n in near if (D['attr'][n[1]][ac['name']] or '') == (strn or '') and n[0] <= 40]
    d, f = same[0] if same else near[0]
    rows.append((hn, art, typ, ort, strn, hs, ts, f, d, x, y))
inside = [r for r in rows if r[7] is not None and not D['attr'][r[7]][ac['ausserhalb']]]
print('Hindernisse im BORS-Rechteck:', len(rows), ' davon auf BORS-Netz im Zielgebiet (<= 40 m):', len(inside))
print('Typen:', Counter(r[2] for r in inside))
print('mit Signal Hoehe:', sum(r[5] is not None for r in inside), ' mit Signal Tonnen:', sum(r[6] is not None for r in inside))
print('\nVergleich Signal (Kanton) vs. BORS/OSM:')
konf = []
for hn, art, typ, ort, strn, hs, ts, f, d, x, y in inside:
    a = D['attr'][f]; mh, mw = a[ac['maxheight']], a[ac['maxweight']]
    kat = ''.join(str(D['kat'][k][f]) for k in 'ABCD')
    probl = []
    for k in 'ABCD':
        if hs is not None and P[k]['h'] > hs and D['kat'][k][f] != 2: probl.append(k+':Hoehe')
        if ts is not None and P[k]['t'] > ts and D['kat'][k][f] != 2: probl.append(k+':Gewicht')
    line = '%-5s %-26s %-18s %-24s sig H=%-5s T=%-5s | OSM mh=%-8s mw=%-5s | kat ABCD=%s %s | %.0f m' % (hn, (art or '')[:26], typ, (strn or '')[:24], hs, ts, mh, mw, kat, ' '.join(probl), d)
    print(line)
    if probl: konf.append(line)
print('\nKONFLIKTE (Signal sperrt, BORS nicht gesperrt):', len(konf))
