# -*- coding: utf-8 -*-
"""Feld-fuer-Feld-Vergleich der Tabelle netz_v5 zweier Netzmaster (nur lesend).
Aufruf: python -I r19_nm_vergleich.py <netzmaster_a.gpkg> <netzmaster_b.gpkg> [max_beispiele=5]
Vergleicht alle gemeinsamen Spalten je seg_id (Zahlen exakt, Text exakt, Geometrie als Blob)."""
import sqlite3, sys
from collections import Counter

A, B = sys.argv[1:3]; MAXB = int(sys.argv[3]) if len(sys.argv) > 3 else 5
ro = lambda f: sqlite3.connect('file:{}?mode=ro'.format(f.replace('\\', '/')), uri=True)
ca, cb = ro(A), ro(B)
sa = [r[1] for r in ca.execute('pragma table_info(netz_v5)')]; sb = [r[1] for r in cb.execute('pragma table_info(netz_v5)')]
gem = [s for s in sa if s in sb and s != 'fid']
print('Spalten A {}, B {}, gemeinsam {}, nur A {}, nur B {}'.format(len(sa), len(sb), len(gem), [s for s in sa if s not in sb], [s for s in sb if s not in sa]))
q = 'select {} from netz_v5'.format(', '.join('"{}"'.format(s) for s in gem))
ia = gem.index('seg_id')
RA = {r[ia]: r for r in ca.execute(q)}; RB = {r[ia]: r for r in cb.execute(q)}
print('Zeilen A {}, B {}, nur A {}, nur B {}'.format(len(RA), len(RB), len(set(RA) - set(RB)), len(set(RB) - set(RA))))
diff, bsp = Counter(), {}
for s in RA.keys() & RB.keys():
    x, y = RA[s], RB[s]
    for i, c in enumerate(gem):
        if x[i] != y[i]:
            diff[c] += 1
            bsp.setdefault(c, []).append((s, str(x[i])[:90], str(y[i])[:90]))
print('abweichende Spalten: {}'.format(len(diff)))
for c, n in diff.most_common():
    print('  {}: {} Zeilen'.format(c, n))
    for b in bsp[c][:MAXB]:
        print('     ', b)
print('ERGEBNIS:', 'IDENTISCH' if not diff and set(RA) == set(RB) else 'ABWEICHUNGEN')
