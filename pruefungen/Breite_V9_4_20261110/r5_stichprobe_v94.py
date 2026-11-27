# -*- coding: utf-8 -*-
"""25_Breite_V9_4_BORS fuer eine Auswahl rechnen (nie nach P_AKTUELL).
Aufruf: python r5_stichprobe_v94.py <BORS_ROOT> <ausgabe_ordner> <split: E|V|alle|liste> [seg_id ...]
Auswahl aus referenz/referenzset_v1_schluessel.csv; Diagnose je Station fuer dieselben Abschnitte."""
import csv, sys, time
from pathlib import Path

ROOT, AUS, SPLIT = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
REF = Path(__file__).resolve().parent.parent / 'referenz'
if SPLIT == 'liste':
    ids = sys.argv[4:]
else:
    ids = [z['seg_id'] for z in csv.DictReader(open(REF / 'referenzset_v1_schluessel.csv', encoding='utf-8-sig'), delimiter=';')
           if SPLIT == 'alle' or z['split'] == SPLIT]
AUS.mkdir(parents=True, exist_ok=True)
g = {'BORS_ROOT': ROOT, 'BORS_V9_SEG_IDS': ids, 'BORS_V9_DIAG_IDS': ids, 'BORS_BREITE_AUSGABE': AUS, '__name__': '__main__'}
p = ROOT / '01_Skripte' / 'Aktuell' / '25_Breite_V9_4_BORS.py'
t = time.time()
exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'), g)
print('Abschnitte', len(ids), '{:.0f} s'.format(time.time() - t))
