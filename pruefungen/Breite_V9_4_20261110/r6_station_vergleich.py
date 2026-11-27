# -*- coding: utf-8 -*-
"""Orthofoto-Ablesung je Querschnitt gegen die AV-Geometrie derselben Station (Diagnose aus 25_Breite_V9_4). Nur lesend.
Aufruf: python -I r6_station_vergleich.py <referenz_ordner> <diagnose.jsonl> <ausgabe.csv> [E|V|alle]
Je Querschnitt: Ortho fest_min/fest_max, AV-Fahrbahn an der Station (breitestes achsnahes Stueck, ungedreht und gestaucht),
AV kleinste Breite ueber 5 Winkel (V9.3), frei ohne Hindernisse, frei mit Parkfeldern (belegt). Differenz = AV - Ortho-Mitte."""
import csv, json, statistics, sys
from pathlib import Path

REF, DG, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
SPLIT = sys.argv[4] if len(sys.argv) > 4 else 'alle'
qs = {(z['fall'], z['querschnitt']): z for z in csv.DictReader(open(REF / 'referenzset_v1.csv', encoding='utf-8-sig'), delimiter=';')}
abl = {(z['fall'], z['querschnitt']): z for z in csv.DictReader(open(REF / 'ablesung_orthofoto_v1.csv', encoding='utf-8'), delimiter=';')}
D = {}
for z in map(json.loads, open(DG, encoding='utf-8')):
    D.setdefault(z['seg_id'], []).append(z)


def breit(iv):
    return max((b - a for a, b in iv), default=0.0)


rows, diffs = [], []
for k, q in qs.items():
    if SPLIT != 'alle' and q['split'] != SPLIT:
        continue
    a = abl[k]
    if q['seg_id'] not in D:
        continue
    st = min(D[q['seg_id']], key=lambda z: abs(z['station'] - float(q['station_m'])))
    lo, hi = (float(a['fest_min']) if a['fest_min'] else None), (float(a['fest_max']) if a['fest_max'] else None)
    av = breit(st['komps'])
    fest = breit([(x, y) for x, y in st['frei_bel']]) if st['frei_bel'] else 0.0
    from_fest = None
    r = dict(fall=k[0], q=k[1], seg_id=q['seg_id'], split=q['split'], art=q['art'], klar=a['klar'], achse=a['achse'], ortho_min=lo, ortho_max=hi,
             av_komp=round(av, 2), av_minwinkel=st['w_fb_min_winkel'], frei_belegt=round(fest, 2), status=st['status'], quelle=st['quelle'],
             knoten=st['knoten'], rand=' / '.join(st['rand']), komps=st['komps'], fest=st['fest'], belegt=st['belegt'], notiz=a['notiz'][:70])
    if lo is not None and a['klar'] in ('K', 'U') and a['achse'] != 'Knoten' and av > 0:
        r['diff_av_ortho'] = round(av - (lo + hi) / 2, 2)
        r['av_in_ortho'] = lo - 0.3 <= av <= hi + 0.3
        diffs.append(r['diff_av_ortho'])
    rows.append(r)
with open(OUT, 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, list(rows[0]) + ['diff_av_ortho', 'av_in_ortho'], delimiter=';', extrasaction='ignore'); w.writeheader(); w.writerows(rows)
if diffs:
    print('n', len(diffs), 'Median AV-Ortho', statistics.median(diffs), 'Quartile', statistics.quantiles(diffs, n=4),
          'innerhalb +-0.3 der Ablesespanne', sum(1 for r in rows if r.get('av_in_ortho')))
