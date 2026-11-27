# -*- coding: utf-8 -*-
"""Pruef-Breitendatei: volle V9.3-Datei + V9.4-Felder/Ereignisse fuer die Abschnitte einer Stichprobe (nur Pruefablage).
Aufruf: python -I r8_mische_breite.py <v9_3_voll.gpkg> <v9_4_stichprobe.gpkg> <ausgabe.gpkg>"""
import shutil, sqlite3, sys
from pathlib import Path
voll, st, aus = map(Path, sys.argv[1:4])
if aus.exists():
    raise SystemExit('existiert: {}'.format(aus))
shutil.copyfile(voll, aus)
o = sqlite3.connect(str(aus)); s = sqlite3.connect('file:{}?mode=ro'.format(st.as_posix()), uri=True)
co = [r[1] for r in o.execute('pragma table_info(breite_v9)')]
cs = [(r[1], r[2]) for r in s.execute('pragma table_info(breite_v9)')]
neu = [(c, t) for c, t in cs if c not in co]
for c, t in neu:
    o.execute('alter table breite_v9 add column "{}" {}'.format(c, t or 'TEXT'))
names = [c for c, _ in neu]
rows = s.execute('select seg_id, {} from breite_v9'.format(', '.join('"{}"'.format(c) for c in names))).fetchall()
o.executemany('update breite_v9 set {} where seg_id = ?'.format(', '.join('"{}" = ?'.format(c) for c in names)), [r[1:] + (r[0],) for r in rows])
for t in ('ereignisse_v9_4', 'fahrzeug_v9_4'):
    sql = s.execute("select sql from sqlite_master where name = ?", (t,)).fetchone()[0]
    o.execute(sql)
    cols = [r[1] for r in s.execute('pragma table_info({})'.format(t))]
    o.executemany('insert into {} values ({})'.format(t, ','.join('?' * len(cols))), s.execute('select * from {}'.format(t)).fetchall())
meta = dict(s.execute('select schluessel, wert from bors_meta').fetchall())
o.execute("update bors_meta set wert = ? where schluessel = 'bedarf_profil'", (meta['bedarf_profil'],))
o.execute("insert into bors_meta values ('pruefdatei', ?)", ('V9.3 voll + V9.4-Felder fuer {} Abschnitte aus {} (nur Pruefung)'.format(len(rows), st.name),))
o.commit(); print('ok', len(rows), 'Abschnitte, neue Felder', len(names))
