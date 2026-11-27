# Kontrollbild: Planlinien (farbig, georeferenziert) und zugeordnete Netzabschnitte (schwarz) in LV95
import json, sqlite3, sys, csv
from pathlib import Path
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
S = Path(sys.argv[1]); BORS = Path(sys.argv[2]); OUT = Path(sys.argv[3])
g = {}; exec(compile((BORS/'01_Skripte/Aktuell/bors_geo.py').read_text(encoding='utf-8'), 'bors_geo', 'exec'), g)
T = json.load(open(S/'georef.json')); a, bE, bN = T['a'], T['bE'], T['bN']
plan = [o for o in json.load(open(S/'plan_linien.json')) if o['t'] != 'signal' and not (o['rect'][0] < 240 and o['rect'][1] < 360)]
FARBE = {10: '#f5c26b', 16: '#f0a000', 28: '#e00000', 34: '#730000'}
zu = {r['seg_id']: r for r in csv.DictReader(open(S/'zuordnung_final.csv', encoding='utf-8-sig'), delimiter=';')}
db = sqlite3.connect('file:{}?mode=ro'.format((BORS/'02_Daten/2_Aktuell_V9/BORS_Netzmaster_V9_20261105_1118.gpkg').as_posix()), uri=True)
fig, ax = plt.subplots(figsize=(16, 11), dpi=110)
for sid, geom in db.execute('select seg_id, geom from netz_v5 where ist_routingtyp=1'):
    for l in g['linien'](geom) or []:
        xs = [p[0] for p in l]; ys = [p[1] for p in l]
        if max(xs) < 2599100 or min(xs) > 2601800 or max(ys) < 1198900 or min(ys) > 1200700: continue
        if sid in zu:
            ax.plot(xs, ys, color='black', lw=1.2, zorder=3)
        else:
            ax.plot(xs, ys, color='#bbbbbb', lw=0.5, zorder=1)
for o in plan:
    xs = [a*x+bE for x, y in o['pts']]; ys = [-a*y+bN for x, y in o['pts']]
    ax.plot(xs, ys, color=FARBE[o['t']], lw=5, alpha=0.55, zorder=2, solid_capstyle='round')
for t, c in FARBE.items(): ax.plot([], [], color=c, lw=5, alpha=0.6, label='Plan {} t'.format(t))
ax.plot([], [], color='black', lw=1.2, label='zugeordneter Netzabschnitt'); ax.plot([], [], color='#bbbbbb', lw=0.5, label='übriges Netz')
ax.set_aspect('equal'); ax.set_xlim(2599100, 2601800); ax.set_ylim(1198900, 1200700); ax.legend(loc='lower left')
ax.set_title('Plan Höchstgewicht Tiefbau Stadt Bern (04.05.2026) georeferenziert, Massstab 1:{:.0f}, Rest median 0.8 m'.format(a/(25.4/72)*1000))
ax.ticklabel_format(useOffset=False, style='plain'); plt.tight_layout(); plt.savefig(OUT); print('ok', OUT)
