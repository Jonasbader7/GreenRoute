import sqlite3, re, sys
from collections import Counter, defaultdict
f = sys.argv[1]
db = sqlite3.connect('file:{}?mode=ro&immutable=1'.format(f), uri=True)
rows = db.execute('select seg_id, highway_type, service_type, laenge_m, zone, a_v9_status,a_v9_grund,b_v9_status,b_v9_grund,c_v9_status,c_v9_grund,d_v9_status,d_v9_grund, a_breite_v9_grund, d_breite_v9_grund from netz_v5 where ist_routingtyp=1').fetchall()

def kat(teil):
    t = teil.strip()
    if t.startswith('Breite nicht entscheidbar'):
        g = t[len('Breite nicht entscheidbar: '):]
        if g.startswith('keine Messung'): return 'Breite: keine Messung'
        if 'Abdeckung' in g or 'abdeckung' in g: return 'Breite: Abdeckung zu gering'
        if 'Luecke' in g or 'luecke' in g: return 'Breite: Messluecke'
        if 'Rand weich' in g: return 'Breite: AV zu schmal, Rand weich'
        if 'Schranke' in g or 'schranke' in g or 'zwischen' in g: return 'Breite: Bedarf zwischen unterer/oberer Schranke'
        return 'Breite: ' + g[:40]
    if t.startswith('Hoehe ungeklaert'): return 'Hoehe ungeklaert: ' + t[18:50]
    if t.startswith('Hoehe knapp'): return 'Hoehe knapp (Hinderniskartei)'
    if t.startswith('Hindernis ungeklaert'): return 'Hindernis ungeklaert: ' + t[22:55]
    if t.startswith('Gewicht ungeklaert'): return 'Gewicht ungeklaert: ' + t[20:45]
    return None

for P in 'abcd':
    i = 5 + 2 * 'abcd'.index(P)
    km = Counter(); n = Counter(); einzig = Counter()
    for r in rows:
        if r[4] != 'BEWERTUNG' or r[i] != 'UNVALIDIERT': continue
        ks = [k for k in (kat(x) for x in (r[i+1] or '').split(' | ')) if k]
        for k in set(ks):
            km[k] += (r[3] or 0) / 1000; n[k] += 1
        if len(set(ks)) == 1:
            einzig[ks[0]] += (r[3] or 0) / 1000
    tot = sum((r[3] or 0) for r in rows if r[4] == 'BEWERTUNG' and r[i] == 'UNVALIDIERT') / 1000
    cnt = sum(1 for r in rows if r[4] == 'BEWERTUNG' and r[i] == 'UNVALIDIERT')
    print('\n== {} unvalidiert: {} Abschnitte, {:.0f} km'.format(P.upper(), cnt, tot))
    for k, v in km.most_common(25):
        print('  {:7.1f} km {:5d} Abschn. (einziger Grund {:6.1f} km)  {}'.format(v, n[k], einzig[k], k))

# Strassentyp fuer D
print('\n== D unvalidiert nach highway/service (km)')
c = Counter()
for r in rows:
    if r[4] == 'BEWERTUNG' and r[11] == 'UNVALIDIERT':
        c[(r[1], r[2] or '')] += (r[3] or 0) / 1000
for k, v in c.most_common(20): print('  {:7.1f}  {}'.format(v, k))

# Beispieltexte Breite
print('\n== Beispiele Breite-Gruende D')
ex = Counter()
for r in rows:
    if r[4] == 'BEWERTUNG' and r[11] == 'UNVALIDIERT':
        for x in (r[12] or '').split(' | '):
            if x.startswith('Breite'):
                ex[re.sub(r'[0-9.]+', '#', x)[:120]] += 1
for k, v in ex.most_common(15): print('  {:5d}  {}'.format(v, k))
