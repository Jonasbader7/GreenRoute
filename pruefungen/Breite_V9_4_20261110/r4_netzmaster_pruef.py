# -*- coding: utf-8 -*-
"""Netzmaster in einer Pruef-Ablage rechnen (schreibt NIE nach 02_Daten/2_Aktuell_V9 der echten Ablage).
Aufruf: python r4_netzmaster_pruef.py <BORS_ROOT> <pruef_ordner> <breite.gpkg> <netzmaster_skript.py> [bors_breite_modul ...]
Kopiert: Skripte aus 01_Skripte/Aktuell, Netzmaster V8, Befunde, Signale Fachstelle, Hinderniskartei und die angegebene
Breitendatei in <pruef_ordner>, startet den Netzmaster mit BORS_ROOT = <pruef_ordner> und gibt die Ausgabedatei aus."""
import shutil, sys, time
from pathlib import Path

ROOT, PR, BR, NMS = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4]
if PR.resolve() == ROOT.resolve() or ROOT.resolve() in PR.resolve().parents:
    raise SystemExit('Pruef-Ordner darf nicht in der Ablage liegen')
akt = PR / '02_Daten' / '2_Aktuell_V9'; akt.mkdir(parents=True, exist_ok=True)
(PR / '02_Daten' / '1_Rohdaten' / 'Kanton_Bern').mkdir(parents=True, exist_ok=True)
sk = PR / '01_Skripte' / 'Aktuell'; sk.mkdir(parents=True, exist_ok=True)
for f in (ROOT / '01_Skripte' / 'Aktuell').glob('*.py'):
    shutil.copy2(f, sk / f.name)
for f in (ROOT / '01_Skripte' / 'Aktuell').glob('*.csv'):
    shutil.copy2(f, sk / f.name)
for f in ('BORS_Netzmaster_V8_20261028_1357.gpkg', 'BORS_Befunde.csv', 'BORS_Signale_Fachstelle.csv'):
    if not (akt / f).exists():
        shutil.copy2(ROOT / '02_Daten' / '2_Aktuell_V9' / f, akt / f)
shutil.copy2(ROOT / '02_Daten' / '1_Rohdaten' / 'Kanton_Bern' / 'HINDKAT_Stand_20260824.gpkg', PR / '02_Daten' / '1_Rohdaten' / 'Kanton_Bern')
for alt in akt.glob('BORS_Breite_V9_*.gpkg'):
    alt.unlink()
shutil.copy2(BR, akt / BR.name)
vorher = set(akt.glob('BORS_Netzmaster_V9_*.gpkg'))
g = {'BORS_ROOT': PR, '__name__': '__main__'}
t = time.time()
p = sk / NMS
exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'), g)
neu = sorted(set(akt.glob('BORS_Netzmaster_V9_*.gpkg')) - vorher)
print('AUSGABE', neu[-1] if neu else 'keine', '{:.0f} s'.format(time.time() - t))
