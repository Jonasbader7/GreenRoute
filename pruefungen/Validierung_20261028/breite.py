import json, re, statistics as st, math
from collections import defaultdict, Counter
D = json.load(open('../repo/netz.json', encoding='utf-8'))
ac = {c: i for i, c in enumerate(D['attr_cols'])}
W = json.load(open('osm_width.json', encoding='utf-8'))
osm = {}
for e in W:
    m = re.fullmatch(r'\s*(\d+(?:[.,]\d+)?)\s*(m)?\s*', e['tags'].get('width', ''))
    if m: osm['w%d' % e['id']] = (float(m.group(1).replace(',', '.')), e['tags'])
rows = []
for a in D['attr']:
    if a[0] in osm and a[ac['v9_fahrbahn_median_m']] is not None and not a[ac['ausserhalb']]:
        rows.append((a, osm[a[0]][0], osm[a[0]][1]))
def rang(v):
    s = sorted(range(len(v)), key=lambda i: v[i]); r = [0]*len(v)
    for k, i in enumerate(s): r[i] = k
    return r
def pearson(x, y):
    mx, my = st.mean(x), st.mean(y); sx = math.sqrt(sum((a-mx)**2 for a in x)); sy = math.sqrt(sum((b-my)**2 for b in y))
    return sum((a-mx)*(b-my) for a, b in zip(x, y))/(sx*sy)
def bericht(name, R):
    if len(R) < 10: return
    av = [r[0][ac['v9_fahrbahn_median_m']] for r in R]; o = [r[1] for r in R]; d = [a-b for a, b in zip(av, o)]
    print('%-14s n=%4d  Median(AV-OSM)=%+.2f m  MAD=%.2f m  |d|<=0.5: %3.0f%%  |d|<=1.0: %3.0f%%  Pearson=%.2f Spearman=%.2f' % (
        name, len(R), st.median(d), st.median([abs(x-st.median(d)) for x in d]), 100*sum(abs(x) <= .5 for x in d)/len(d),
        100*sum(abs(x) <= 1 for x in d)/len(d), pearson(av, o), pearson(rang(av), rang(o))))
print('OSM-Wege mit numerischem width im Gebiet:', len(osm), ' davon mit AV-Messung verknuepft:', len(rows))
bericht('alle', rows)
g = defaultdict(list)
for r in rows: g[r[0][ac['highway_type']]].append(r)
for k, v in sorted(g.items(), key=lambda kv: -len(kv[1])): bericht(k, v)
# Entscheidungsrelevant: OSM sagt deutlich zu schmal, BORS sagt ausreichend
P = D['profile']
print('\nKonflikte: OSM-width < Spiegelbreite+0.2 - 0.5 m, BORS-Breite AUSREICHEND')
for c in 'ABCD':
    bed = P[c]['sp'] + 0.2
    k = [r for r in rows if r[1] < bed - 0.5 and r[0][ac[c+'_breite']] == 'AUSREICHEND']
    n = [r for r in rows if r[1] < bed - 0.5]
    print(c, 'Bedarf~%.2f m: OSM zu schmal n=%d, davon BORS ausreichend %d' % (bed, len(n), len(k)),
          [(r[0][0], r[0][ac['name']], r[0][ac['highway_type']], r[1], r[0][ac['v9_untere_schranke_m']]) for r in k[:6]])
print('\nUmgekehrt: OSM-width >= Bedarf+1.0 m, BORS UNZUREICHEND')
for c in 'ABCD':
    bed = P[c]['sp'] + 0.2
    k = [r for r in rows if r[1] >= bed + 1.0 and r[0][ac[c+'_breite']] not in ('AUSREICHEND',)]
    print(c, Counter(r[0][ac[c+'_breite']] for r in k))
print('\nBreite-Status Werte:', Counter(a[ac['D_breite']] for a in D['attr']))
