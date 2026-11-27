# Unabhaengige Python-Neuimplementierung des Routing-Kerns (kantenbasierter Dijkstra mit Abbiegekosten)
import json, math, heapq, time, random
D = json.load(open('../repo/netz.json', encoding='utf-8'))
J = json.load(open('core_js.json'))
X = [D['nodes'][2*i]/100 for i in range(len(D['nodes'])//2)]
Y = [D['nodes'][2*i+1]/100 for i in range(len(D['nodes'])//2)]
K = D['konst']
adj = [[] for _ in X]; CUM = []
for f, (parts, fl) in enumerate(D['segs']):
    fw, bw = bool(fl & 1), bool(fl & 2); cl = []
    for pi, ids in enumerate(parts):
        cum = [0.0]
        for i in range(1, len(ids)): cum.append(cum[-1] + math.hypot(X[ids[i]]-X[ids[i-1]], Y[ids[i]]-Y[ids[i-1]]))
        cl.append(cum)
        for i in range(len(ids)-1):
            L = cum[i+1]-cum[i]
            if L <= 1e-9 or ids[i] == ids[i+1]: continue
            if fw: adj[ids[i]].append((ids[i+1], f, pi, cum[i], cum[i+1], L))
            if bw: adj[ids[i+1]].append((ids[i], f, pi, cum[i+1], cum[i], L))
    CUM.append(cl)
TURN = {c: {(u, a, b): s for u, a, b, s, _ in D['abb'][c]['turn']} for c in D['abb']}
KURVE = {c: {(f, bool(fw)): s for f, fw, s, _ in D['abb'][c]['kurve']} for c in D['abb']}
def punkte(c, kosten):
    out = {}
    for f, pl in D['punkte'].items():
        f = int(f)
        if not kosten[f]: continue
        l = [(pi, pos, None) if fest else (pi, pos, K['OEFFNEN_SEK']) for pi, pos, fest, *_ in pl if fest or c != 'REF']
        if l: out[f] = l
    return out
def kantenkosten(e, fin, u, c, kosten, pk):
    v, f, pi, a, b, L = e
    if not kosten[f]: return None
    x = 0.0
    if fin != -1 and f != fin: x += TURN[c].get((u, fin, f), 0)
    if f != fin: x += KURVE[c].get((f, b >= a), 0)
    lo, hi = min(a, b), max(a, b)
    for ppi, pos, sek in pk.get(f, ()):
        if ppi != pi: continue
        if sek is None:
            if lo-0.01 <= pos <= hi+0.01: return None
        elif (lo+0.01 < pos < hi-0.01) or abs(pos-b) <= 0.01: x += sek
    return L*kosten[f] + x
def route(sF, sS, tF, tS, c, kosten, pk):
    ids = D['segs'][sF][0][sS[1]]; cum = CUM[sF][sS[1]]; fl = D['segs'][sF][1]; i, pos = sS[2], sS[3]
    start = []
    if fl & 1: start.append((ids[i+1], sF, sS[1], pos, cum[i+1], abs(cum[i+1]-pos)))
    if fl & 2: start.append((ids[i], sF, sS[1], pos, cum[i], abs(pos-cum[i])))
    tids = D['segs'][tF][0][tS[1]]; tcum = CUM[tF][tS[1]]; tfl = D['segs'][tF][1]; j, tp = tS[2], tS[3]
    into = {}
    if tfl & 1: into.setdefault(tids[j], []).append(('T', tF, tS[1], tcum[j], tp, abs(tp-tcum[j])))
    if tfl & 2: into.setdefault(tids[j+1], []).append(('T', tF, tS[1], tcum[j+1], tp, abs(tcum[j+1]-tp)))
    if sF == tF and sS[1] == tS[1]:
        a, b = pos, tp
        if (b >= a and fl & 1) or (b <= a and fl & 2): start.append(('T', sF, sS[1], a, b, abs(b-a)))
    best = {('S', -1): 0.0}; pq = [(0.0, 0, 'S', -1)]; cnt = 1
    while pq:
        d, _, u, fin = heapq.heappop(pq)
        if u == 'T': return d
        if d > best.get((u, fin), math.inf): continue
        edges = start if u == 'S' else adj[u] + into.get(u, [])
        for e in edges:
            w = kantenkosten(e, fin, u, c, kosten, pk)
            if w is None: continue
            s = (e[0], e[1]); nd = d + w
            if nd < best.get(s, math.inf) - 1e-12:
                best[s] = nd; cnt += 1; heapq.heappush(pq, (nd, cnt, e[0], e[1]))
    return None
random.seed(7); sample = random.sample(J, 300); t0 = time.time(); diffs = []; mism = []
pkc = {}
for o in sample:
    kosten = D['kosten'][o['m']][o['c']]
    key = (o['m'], o['c'])
    if key not in pkc: pkc[key] = punkte(o['c'], kosten)
    r = route(o['sF'], o['sS'], o['tF'], o['tS'], o['c'], kosten, pkc[key])
    if (r is None) != (o['cost'] is None): mism.append((o['k'], o['m'], o['c'], r, o['cost']))
    elif r is not None: diffs.append(abs(r-o['cost'])/max(r, 1e-9))
print('Stichprobe', len(sample), 'Sekunden', round(time.time()-t0))
print('Erreichbarkeit verschieden:', len(mism), mism[:5])
print('Kosten verglichen:', len(diffs), 'max rel. Abweichung', max(diffs), 'Anzahl > 1e-9:', sum(d > 1e-9 for d in diffs))
# Pfadpruefung aller 1314 JS-Routen: zusammenhaengend, Richtung erlaubt, kein gesperrter Abschnitt, Kosten nachgerechnet
bad = 0
for o in J:
    if o['weg'] is None: continue
    kosten = D['kosten'][o['m']][o['c']]
    for f, pi, a, b, L in o['weg']:
        fl = D['segs'][f][1]
        if not kosten[f] or (b > a and not fl & 1) or (b < a and not fl & 2) or abs(abs(b-a)-L) > 1e-6: bad += 1; break
    else:
        for (f1, p1, a1, b1, _), (f2, p2, a2, b2, _) in zip(o['weg'], o['weg'][1:]):
            n1 = D['segs'][f1][0][p1][CUM[f1][p1].index(min(CUM[f1][p1], key=lambda z: abs(z-b1)))]
            n2 = D['segs'][f2][0][p2][CUM[f2][p2].index(min(CUM[f2][p2], key=lambda z: abs(z-a2)))]
            if n1 != n2: bad += 1; break
print('JS-Pfade mit Regelverstoss (Richtung, Sperre, Luecke):', bad, 'von', sum(o['weg'] is not None for o in J))
