import sqlite3, sys, glob
a, b = (glob.glob(d + '/BORS_Netzmaster_V9_*.gpkg')[0] for d in sys.argv[1:3])
A = sqlite3.connect('file:{}?mode=ro'.format(a), uri=True); Bc = sqlite3.connect('file:{}?mode=ro'.format(b), uri=True)
ca = [r[1] for r in A.execute('pragma table_info(netz_v5)')]; cb = [r[1] for r in Bc.execute('pragma table_info(netz_v5)')]
print('nur in B:', [c for c in cb if c not in ca]); print('nur in A:', [c for c in ca if c not in cb])
sel = ', '.join('"%s"' % c for c in ca)
ra = A.execute('select %s from netz_v5 order by fid' % sel).fetchall(); rb = Bc.execute('select %s from netz_v5 order by fid' % sel).fetchall()
print('Zeilen', len(ra), len(rb))
diff = {}
for x, y in zip(ra, rb):
    for c, u, v in zip(ca, x, y):
        if u != v: diff[c] = diff.get(c, 0) + 1
print('abweichende Felder:', diff or 'keine')
for c in [c for c in cb if c not in ca]:
    print(c, Bc.execute('select count(*) from netz_v5 where "%s" is not null' % c).fetchone()[0], 'nicht leer')
for t in ('bewertung_v8', 'evidenz', 'ksvb_zuordnung'):
    print(t, A.execute('select count(*) from %s' % t).fetchone(), Bc.execute('select count(*) from %s' % t).fetchone())
