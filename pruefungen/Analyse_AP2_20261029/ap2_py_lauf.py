# -*- coding: utf-8 -*-
"""AP2: Routenlogik des QGIS-Routers (7_Router_*.py) AUSSERHALB von QGIS auf den Daten von netz.json rechnen.
Zweck: pruefen, ob der Python-Code dieselben Ergebnisse liefert wie bors_router.js auf denselben Daten (Portierungsfehler).
qgis/osgeo werden durch Attrappen ersetzt; Netz, Kosten, Hindernispunkte, Abbiegen und Klickmalus kommen aus netz.json,
der Raumindex ist ein exakter Nachbau (wie QgsSpatialIndex mit gespeicherten Geometrien). Kein Ersatz fuer den QGIS-Test.
Aufruf: python -I ap2_py_lauf.py <7_Router_*.py> <netz.json> <paare.json> <aus.json> [max_paare] [--v92d]
"""
import json
import math
import sys
import time
import types
from pathlib import Path

ROUTER, NETZ, PAARE, AUS = sys.argv[1:5]
MAXP = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else None


class _Attrappe:
    def __init__(self, *a, **k):
        pass

    def __getattr__(self, n):
        return _Attrappe()

    def __call__(self, *a, **k):
        return _Attrappe()


class QgsPointXY:
    def __init__(self, x, y):
        self._x, self._y = x, y

    def x(self):
        return self._x

    def y(self):
        return self._y


def _modul(name, **fest):
    m = types.ModuleType(name)
    for k, v in fest.items():
        setattr(m, k, v)
    m.__getattr__ = lambda n: _Attrappe
    sys.modules[name] = m
    return m


for _n in ('qgis', 'qgis.PyQt', 'qgis.PyQt.QtCore', 'qgis.PyQt.QtGui', 'qgis.PyQt.QtWidgets', 'qgis.gui', 'osgeo'):
    _modul(_n)
_modul('qgis.core', QgsPointXY=QgsPointXY)

src = Path(ROUTER).read_text(encoding='utf-8')
src = src[:src.index("for _alt in ('BORS_ROUTER'")]          # ohne Dock/Start am Dateiende
ns = {'__name__': 'bors_router_test', 'BORS_ROOT': Path.home() / 'OneDrive' / 'Desktop' / 'BORS'}
exec(compile(src, ROUTER, 'exec'), ns)

D = json.load(open(NETZ, encoding='utf-8'))
if '--v92d' in sys.argv:
    W = {'w4684618': {'D': 2}, 'w23586279': {'B': 1, 'C': 1, 'D': 1}, 'w25334273': {'D': 2}, 'w322946731': {'D': 2},
         'w753741041': {'C': 2, 'D': 2}, 'w1337245698': {'B': 1, 'C': 1, 'D': 1}, 'w1558491001': {'D': 2}}
    iS = D['attr_cols'].index('seg_id')
    for f, a in enumerate(D['attr']):
        w = W.get(str(a[iS]).split('_')[0])
        for c, k in (w or {}).items():
            v = D['kosten']['V'][c][f]; D['kat'][c][f] = k; D['kosten']['V'][c][f] = 0
            D['kosten']['E'][c][f] = v * D['konst']['RISIKO_FAKTOR'] if k == 1 else 0
ac = {c: i for i, c in enumerate(D['attr_cols'])}
A = lambda f, c: D['attr'][f][ac[c]]
nn = len(D['nodes']) // 2
X = [D['nodes'][2 * i] / 100 for i in range(nn)]
Y = [D['nodes'][2 * i + 1] / 100 for i in range(nn)]

# --- Routing-Kern wie Netz() in bors_router.js (Knoten = Index aus netz.json)
kern = ns['RoutingKern']()
kern.xy = list(zip(X, Y)); kern.out = [[] for _ in range(nn)]; kern.und = [[] for _ in range(nn)]
for f, s in enumerate(D['segs']):
    parts, fw, bw = s[0], bool(s[1] & 1), bool(s[1] & 2)
    cums, offs, off = [], [], 0.0
    for pi, ids in enumerate(parts):
        cum = [0.0]
        for i in range(1, len(ids)):
            cum.append(cum[-1] + math.hypot(X[ids[i]] - X[ids[i - 1]], Y[ids[i]] - Y[ids[i - 1]]))
        for i in range(len(ids) - 1):
            L = cum[i + 1] - cum[i]
            if L <= 1e-9 or ids[i] == ids[i + 1]:
                continue
            if fw:
                kern.out[ids[i]].append((ids[i + 1], f, pi, cum[i], cum[i + 1], L))
            if bw:
                kern.out[ids[i + 1]].append((ids[i], f, pi, cum[i + 1], cum[i], L))
            kern.und[ids[i]].append((ids[i + 1], f)); kern.und[ids[i + 1]].append((ids[i], f))
        cums.append(cum); offs.append(off); off += cum[-1]
    kern.feat[f] = dict(parts=[[(X[i], Y[i]) for i in ids] for ids in parts], cum=cums, off=offs, ids=parts, L=off, fw=fw, bw=bw)


class Raumindex:
    """Exakter Nachbau: alle Abschnitte nach Abstand der Geometrie, hoechstens k, bis maxd."""
    G = 100.0

    def __init__(self):
        self.grid = {}
        for f, F in kern.feat.items():
            for ids in F['ids']:
                for a, b in zip(ids, ids[1:]):
                    for gx in range(int(math.floor(min(X[a], X[b]) / self.G)), int(math.floor(max(X[a], X[b]) / self.G)) + 1):
                        for gy in range(int(math.floor(min(Y[a], Y[b]) / self.G)), int(math.floor(max(Y[a], Y[b]) / self.G)) + 1):
                            self.grid.setdefault((gx, gy), set()).add(f)

    def nearestNeighbor(self, pt, k, maxd):
        x, y = pt.x(), pt.y()
        r = int(maxd // self.G) + 1; cx, cy = int(math.floor(x / self.G)), int(math.floor(y / self.G))
        cand = set()
        for i in range(cx - r, cx + r + 1):
            for j in range(cy - r, cy + r + 1):
                cand |= self.grid.get((i, j), set())
        ds = sorted((kern.project(f, x, y)[0], f) for f in cand)
        return [f for d, f in ds if d <= maxd][:k]


KATN = {0: 'KEIN_HINWEIS', 1: 'UNGEKLAERT', 2: 'BESCHRAENKUNG_BESTAETIGT'}
R = object.__new__(ns['BorsRouterV7'])
R.kern = kern
R.sidx = Raumindex()
R.info = {}
for f in range(len(D['segs'])):
    i = dict(seg_id=A(f, 'seg_id'), name=A(f, 'name'), hw=A(f, 'highway_type'), btl=A(f, 'bruecke_tunnel_layer'), speed=A(f, 'speed'),
             _row={'gemeinde': 'ausserhalb AOI' if A(f, 'ausserhalb') else ''})
    for c in 'ABCD':
        i[c.lower() + '_kat'] = KATN[D['kat'][c][f]]; i[c.lower() + '_grund'] = ''
    R.info[f] = i
R.punkte = {int(f): [(pi, pos, 'FEST' if fest else 'OEFFNEN', '') for pi, pos, fest, *_ in pl] for f, pl in D['punkte'].items()}
R.kat_ohne_hindernis = {}
R.netz_version = D.get('version', 'netz.json')
R.hat_evidenz = False
R.modus_ui = 'VALIDIERT'
R.modus = None
R.kosten, R.aus = {}, {}
R._klick_malus = lambda fid: A(fid, 'klick_malus')
R._belege = lambda code, rows: []
R._nur_feste_sperre = lambda fid, code: False


def _profil_kosten(code):
    m = 'V' if R.modus == 'VALIDIERT' else 'E'
    k = D['kosten'][m][code]
    return {f: v for f, v in enumerate(k) if v}, {}


R._profil_kosten = _profil_kosten
_abb = {}


def _abbiege_tabelle(code):
    if code not in _abb:
        t = D['abb'][code]
        _abb[code] = {'turn': {(u, a, b): s for u, a, b, s, tx in t['turn']},
                      'kurve': {(f, 'fw' if fw else 'bw'): s for f, fw, s, tx in t['kurve']},
                      'text': {(u, a, b): D['texte'][tx] for u, a, b, s, tx in t['turn']}}
        _abb[code]['text'].update({('K', f): D['texte'][tx] for f, fw, s, tx in t['kurve']})
    return _abb[code]


R._abbiege_tabelle = _abbiege_tabelle

paare = json.load(open(PAARE, encoding='utf-8'))[:MAXP]
out, t0 = [], time.time()
for p in paare:
    p1 = (p['p1'][0] - D['x0'], p['p1'][1] - D['y0']); p2 = (p['p2'][0] - D['x0'], p['p2'][1] - D['y0'])
    res = R.berechne(p1, p2, ['REF', 'A', 'B', 'C', 'D'])
    row = {'id': p['id']}
    for c in ('REF', 'A', 'B', 'C', 'D'):
        r = res[c]
        if not r['ok']:
            row[c] = {'ok': False, 'urs': r.get('ursache'), 'text': (r.get('text') or '')[:200]}
            continue
        d = r.get('diag', {})
        row[c] = {'ok': True, 'L': r['laenge_m'], 'mod': r['modell_min'], 'modus': r['modus'], 'urs': r.get('ursache') or '',
                  'rueck': bool(r.get('validiert_ergebnis')), 'dom': r.get('dominanz_von') or '', 'unval': r.get('unvalidiert_m', 0),
                  'ss': d.get('start_status') or '', 'zs': d.get('ziel_status') or '', 'f4': bool(d.get('f4_anschluss')),
                  'rs': d.get('start_restdistanz_luftlinie_m') or 0, 'rz': d.get('ziel_restdistanz_luftlinie_m') or 0,
                  'segs': ' '.join(str(x['seg_id']) for x in r['rows'])}
    out.append(row)
json.dump(out, open(AUS, 'w', encoding='utf-8'))
print('gerechnet:', len(out), 'Paare in {:.0f} s'.format(time.time() - t0))
