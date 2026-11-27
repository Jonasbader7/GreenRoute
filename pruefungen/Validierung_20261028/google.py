# Google Maps (Auto, abgefragt 28.10.2026 ca. 22:30, Verkehr "normal"), erste/empfohlene Route + Alternativen: (min, km)
import json, statistics as st, sys
sys.stdout.reconfigure(encoding='utf-8')
G = {21: [(2, .50), (2, .55), (2, .65)], 32: [(4, 1.9)], 40: [(8, 4.0), (8, 4.1), (8, 3.7)], 78: [(6, 4.3)],
     79: [(9, 5.6), (11, 4.9)], 5: [(8, 5.6), (12, 4.8), (9, 5.7)], 76: [(9, 7.2), (10, 7.6), (11, 5.9)],
     56: [(12, 6.3), (13, 6.2), (11, 6.9)], 13: [(16, 6.7), (16, 10.3), (18, 9.1)], 19: [(18, 11.5), (21, 9.6), (21, 15.2)],
     45: [(15, 7.9), (16, 7.9), (16, 8.3)], 50: [(12, 9.8), (16, 8.6), (15, 12.7)], 46: [(20, 13.9), (21, 12.2), (23, 16.0)],
     8: [(13, 14.2), (14, 14.6)], 59: [(17, 19.1), (21, 20.2)]}
P = {r['k']: r for r in json.load(open('auswahl.json', encoding='utf-8'))}
json.dump({str(k): v for k, v in G.items()}, open('google.json', 'w'))
rows = []
print('k   Luft  | BORS km  min | OSRM km  min | Google km min | BORS-Route = eine Google-Variante (±7 %)?')
for k, g in G.items():
    r = P[k]; b, bt = r['REF']/1000, r['REF_min']; o, ot = r['osrm_m']/1000, r['osrm_min']; gk, gt = g[0][1], g[0][0]
    var = any(abs(b-x)/x <= .07 for _, x in g)
    rows.append((k, r['luft'], b, bt, o, ot, gk, gt, var))
    print('%-3d %5d | %6.2f %5.1f | %6.2f %5.1f | %6.1f %4d | %s' % (k, r['luft'], b, bt, o, ot, gk, gt, 'ja' if var else 'nein'))
def s(name, v):
    v = sorted(v); print('%-34s Median %.2f  IQR %.2f–%.2f  min %.2f max %.2f' % (name, st.median(v), v[len(v)//4], v[3*len(v)//4], v[0], v[-1]))
s('Länge BORS / Google', [r[2]/r[6] for r in rows]); s('Länge OSRM / Google', [r[4]/r[6] for r in rows])
s('Zeit BORS / Google', [r[3]/r[7] for r in rows]); s('Zeit OSRM / Google', [r[5]/r[7] for r in rows])
lg = [r for r in rows if r[1] > 2000]
s('Zeit BORS / Google (Luftlinie > 2 km)', [r[3]/r[7] for r in lg])
print('Summe Minuten  BORS %.1f  OSRM %.1f  Google %d' % (sum(r[3] for r in rows), sum(r[5] for r in rows), sum(r[7] for r in rows)))
print('BORS-Route entspricht einer Google-Variante: %d von %d' % (sum(r[8] for r in rows), len(rows)))
# Google rundet auf ganze Minuten: Fehler bis +-0.5 min; Einfluss bei kurzen Routen gross
