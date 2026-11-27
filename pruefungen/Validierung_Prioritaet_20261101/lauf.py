import sys, shutil
from pathlib import Path
root, skript, ziel = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
p = root / '01_Skripte' / 'Aktuell' / skript
g = {'BORS_ROOT': root, '__name__': '__lauf__'}
exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'), g)
ziel.mkdir(parents=True, exist_ok=True)
for f in (root / '02_Daten' / '2_Aktuell_V9').glob('BORS_Netzmaster_V9_*'):
    shutil.move(str(f), str(ziel / f.name))
