# -*- coding: utf-8 -*-
"""Vergleich zweier Protokolle 27_QGIS_Test (v9_oberflaeche_*.csv). Nur lesend.
Aufruf: python -I r18_qgis_vergleich.py <alt.csv> <neu.csv>
Gibt PASS/FAIL/SKIP je Protokoll und jede Zeile aus, deren Ergebnis, Modus, ungeklaerte Meter, Banner oder Pruefung abweicht."""
import csv, sys
from collections import Counter


def lade(f):
    with open(f, encoding='utf-8-sig') as fh:
        return [r for r in csv.DictReader(fh, delimiter=';')]


A, N = lade(sys.argv[1]), lade(sys.argv[2])
for nm, R in (('alt', A), ('neu', N)):
    print(nm, sys.argv[1 if nm == 'alt' else 2], dict(Counter(r['pruefung'] for r in R if r.get('pruefung'))))
key = lambda r: (r['nr'], r['test'], r['profil'], r['modus_ui'], r['eingabe'])
ia = {key(r): r for r in A}
n = 0
for r in N:
    a = ia.get(key(r))
    if a is None:
        print('NEU   ', key(r), r['ergebnis']); n += 1; continue
    d = [f for f in ('ergebnis', 'modus_router', 'unvalidiert_m', 'banner', 'pruefung', 'fehler') if (a.get(f) or '') != (r.get(f) or '')]
    if d:
        n += 1
        print('DIFF  ', key(r)[:4], r['eingabe'][:50])
        for f in d:
            print('        {}: {} -> {}'.format(f, (a.get(f) or '')[:120], (r.get(f) or '')[:120]))
print('Zeilen alt {}, neu {}, abweichend {}'.format(len(A), len(N), n))
