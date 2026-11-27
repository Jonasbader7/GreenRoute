# Netzmaster -> seg_id;a_status;b_status;c_status;d_status (fuer r12_web_pruef.js). Nur lesend.
import sqlite3, sys
from pathlib import Path
c = sqlite3.connect('file:{}?mode=ro'.format(Path(sys.argv[1]).as_posix()), uri=True)
with open(sys.argv[2], 'w', encoding='utf-8') as fh:
    fh.write('seg_id;a_status;b_status;c_status;d_status\n')
    for r in c.execute('select seg_id, a_v9_status, b_v9_status, c_v9_status, d_v9_status from netz_v5 where ist_routingtyp = 1'):
        fh.write(';'.join(r) + '\n')
