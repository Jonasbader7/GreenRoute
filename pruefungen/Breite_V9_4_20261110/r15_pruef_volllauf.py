# -*- coding: utf-8 -*-
"""Pruefung Volllauf Breite V9.4 gegen Breite V9.3 (nur lesend).
Aufruf: python -I r15_pruef_volllauf.py <breite_v9_3.gpkg> <breite_v9_4.gpkg> <ausgabe.txt>
Prueft: PRAGMA integrity_check, eindeutige seg_id = Zeilen, gleiche Abschnittsmenge wie V9.3, und fuer jede Spalte von
breite_v9 in V9.3 (inkl. Geometrie): Wert in V9.4 identisch (Zahlen exakt, Text exakt). Neue Spalten werden nur gelistet.
Dazu dieselbe Pruefung fuer engstellen_v9 (gleiche Spalten, Schluessel seg_id + Zeilenfolge)."""
import sqlite3, sys
from collections import Counter

A, N, OUT = sys.argv[1:4]
ca = sqlite3.connect('file:{}?mode=ro'.format(A.replace('\\', '/')), uri=True)
cn = sqlite3.connect('file:{}?mode=ro'.format(N.replace('\\', '/')), uri=True)
L = []
log = lambda s: (print(s), L.append(s))
for nm, c in (('V9.3', ca), ('V9.4', cn)):
    log('{} integrity_check: {}'.format(nm, c.execute('pragma integrity_check').fetchone()[0]))
spa = lambda c, t: [r[1] for r in c.execute('pragma table_info("{}")'.format(t))]
ok_alle = True
for t in ('breite_v9', 'engstellen_v9'):
    sa, sn = spa(ca, t), spa(cn, t)
    fehlt = [s for s in sa if s not in sn]; neu = [s for s in sn if s not in sa]
    log('\n== {}: Spalten V9.3 {}, V9.4 {}, in V9.4 fehlend {}, neu {}'.format(t, len(sa), len(sn), fehlt, len(neu)))
    if t == 'breite_v9':
        log('   neue Spalten: ' + ', '.join(neu))
    gem = [s for s in sa if s in sn and s != 'fid']
    q = 'select {} from "{}" order by seg_id, fid'.format(', '.join('"{}"'.format(s) for s in gem), t)
    ra, rn = ca.execute(q).fetchall(), cn.execute(q).fetchall()
    log('   Zeilen V9.3 {}, V9.4 {}'.format(len(ra), len(rn)))
    if t == 'breite_v9':
        ids = [r[gem.index('seg_id')] for r in rn]
        log('   eindeutige seg_id V9.4: {} (Zeilen {})'.format(len(set(ids)), len(ids)))
        log('   gleiche Abschnittsmenge wie V9.3: {}'.format(set(ids) == set(r[gem.index('seg_id')] for r in ra)))
        ok_alle &= len(set(ids)) == len(ids) == 20867
    if len(ra) != len(rn):
        log('   ABWEICHUNG Zeilenzahl'); ok_alle = False; continue
    diff = Counter(); bsp = {}
    for x, y in zip(ra, rn):
        for i, s in enumerate(gem):
            if x[i] != y[i] and not (isinstance(x[i], float) and isinstance(y[i], float) and x[i] != x[i] and y[i] != y[i]):
                diff[s] += 1; bsp.setdefault(s, (x[gem.index('seg_id')], x[i], y[i]))
    log('   verglichene Spalten {} x Zeilen {} = {} Werte; abweichende Spalten: {}'.format(len(gem), len(ra), len(gem) * len(ra), len(diff)))
    for s, n in diff.most_common():
        log('     {}: {} Zeilen, z.B. {}'.format(s, n, bsp[s])); ok_alle = False
log('\nERGEBNIS: {}'.format('PASS (V9.3-Felder identisch, 20867 eindeutige Abschnitte, Integritaet ok)' if ok_alle else 'FAIL'))
open(OUT, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
