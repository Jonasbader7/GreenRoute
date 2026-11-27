exec(open('profil.py', encoding='utf-8').read().split("res = []")[0])
import json
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}
A = {a[0]: a for a in D['attr']}
for sid, s in [('w25960934', 34.5), ('w372877943', 62.5), ('w197513254', 11.5), ('w262443093', 34.5)]:
    d = P[sid]; (x0, y0), (x1, y1) = d[round(s-3, 1)][2], d[round(s+3, 1)][2]; px, py = d[s][2]
    L = math.hypot(x1-x0, y1-y0); tx, ty = (x1-x0)/L, (y1-y0)/L; out = []
    for wdeg in (-20, -10, 0, 10, 20):
        w = math.radians(wdeg); nx, ny = -ty*math.cos(w) - tx*math.sin(w), tx*math.cos(w) - ty*math.sin(w)
        out.append(schnitt(px, py, nx, ny, 30.0)[0])
    # Ist der Profilpunkt selbst in einer Strassenflaeche? Nachbarstationen?
    a = A.get(sid)
    print(sid, s, A[sid][ac['name']], A[sid][ac['highway_type']], 'Punkt', [round(px), round(py)], 'eigene je Winkel', [round(x, 2) if x else None for x in out],
          'BORS', d[s][1], 'Nachbarn BORS', [d.get(round(s+k, 1), (None, None))[1] for k in (-2, -1, 1, 2)],
          'Strasse untere Schranke', a[ac['v9_untere_schranke_m']], 'D', a[ac['D_breite']])
