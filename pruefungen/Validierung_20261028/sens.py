import json, re, math
from collections import Counter
D = json.load(open('../repo/netz.json', encoding='utf-8')); ac = {c: i for i, c in enumerate(D['attr_cols'])}
X = [D['nodes'][2*i]/100 for i in range(len(D['nodes'])//2)]; Y = [D['nodes'][2*i+1]/100 for i in range(len(D['nodes'])//2)]
L = [sum(math.hypot(X[ids[i]]-X[ids[i-1]], Y[ids[i]]-Y[ids[i-1]]) for ids in s[0] for i in range(1, len(ids))) for s in D['segs']]
T = D['texte']
for c in 'ABCD':
    km = Counter(); typ = Counter()
    for f, a in enumerate(D['attr']):
        if a[ac['ausserhalb']]: continue
        g = T[a[ac[c+'_breite_grund']]] if a[ac[c+'_breite_grund']] is not None else ''
        e = a[ac[c+'_breite']]; s = a[ac['v9_sigma_m']]
        m = re.match(r'mindestens ([\d.]+) m >= Bedarf ([\d.]+) m', g)
        if e == 'AUSREICHEND' and m and s:
            wlo, bed = float(m.group(1)), float(m.group(2)); km['gemessen ausreichend'] += L[f]
            if wlo - (2.326-1.645)*s < bed: km['kippt bei k=2.326 (99%)'] += L[f]
            if wlo - 1.645*s < bed: km['kippt bei doppeltem sigma'] += L[f]
        elif e == 'AUSREICHEND': typ[g.split('(')[0].split(';')[0][:60]] += L[f]
        mt = re.search(r'innerhalb der Messtoleranz \(([\d.]+) \.\. ([\d.]+) m\)', g); mb = re.search(r'Bedarf ([\d.]+) m', g)
        if e == 'NICHT_ENTSCHEIDBAR' and mt and s:
            km['in Toleranz (nicht entscheidbar)'] += L[f]
            if float(mt.group(1)) + 1.645*s*(1-1/math.sqrt(2)) >= float(mb.group(1)): km['wird ausreichend bei sigma/sqrt2'] += L[f]
        if e == 'NICHT_ENTSCHEIDBAR': km['nicht entscheidbar gesamt'] += L[f]
    print(c, {k: round(v/1000, 1) for k, v in km.items()})
    print('   abgeleitet ausreichend (km):', {k: round(v/1000, 1) for k, v in typ.most_common(6)})
# Gruende fuer NICHT_ENTSCHEIDBAR bei D
g = Counter()
for f, a in enumerate(D['attr']):
    if a[ac['ausserhalb']] or a[ac['D_breite']] != 'NICHT_ENTSCHEIDBAR': continue
    t = T[a[ac['D_breite_grund']]] if a[ac['D_breite_grund']] is not None else 'None'
    g[re.sub(r'[\d.]+', '#', t)[:70]] += L[f]
print('D nicht entscheidbar – Gruende (km):'); [print('  %6.1f  %s' % (v/1000, k)) for k, v in g.most_common(10)]
