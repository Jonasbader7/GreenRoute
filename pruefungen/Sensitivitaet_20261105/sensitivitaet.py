# -*- coding: utf-8 -*-
r"""BORS Sensitivitaetsanalyse (5.11.2026): Wie stark haengen die Zustaende VALIDIERT / UNVALIDIERT / GESPERRT
an den gesetzten Parametern? Normales Python, kein QGIS.

Vorgehen: Der Netzmaster 26_Netzmaster_V9_2g_BORS.py wird als Text geladen, je Variante werden genau die Konstanten
ersetzt, und er laeuft mit einer Ausgabe in einem temporaeren Ordner (nie in 02_Daten). Danach werden je Klasse die
km je Zustand (Zone BEWERTUNG) und die Abschnitte mit anderem Zustand als in der Basis gezaehlt; die temporaere
GeoPackage-Datei wird wieder entfernt. Die Basis muss den aktiven Lauf BORS_Netzmaster_V9_20261105_1118 Feld fuer Feld
treffen (Pruefung im Skript).

Grenzen: Der Faktor k wird naeherungsweise ueber die Schranken verschoben (w_lo + (1.645 - k) x sigma des Abschnitts),
weil k in der Breitenmessung 25_Breite eingerechnet ist. Router-Parameter (ungeklaert x2, Abbiegen) aendern keine
Zustaende und sind hier nicht enthalten.
Aufruf: python sensitivitaet.py --tmp <Ordner fuer Zwischenergebnisse>
"""
import csv
import json
import re
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SKRIPT = ROOT / '01_Skripte' / 'Aktuell' / '26_Netzmaster_V9_2g_BORS.py'
AKTIV = ROOT / '02_Daten' / '2_Aktuell_V9' / 'BORS_Netzmaster_V9_20261105_1118.gpkg'
OUT = Path(__file__).resolve().parents[1] / 'ergebnisse'
TMP = Path(sys.argv[sys.argv.index('--tmp') + 1]) if '--tmp' in sys.argv else OUT / '_tmp'
if (OUT / 'sensitivitaet_km.csv').exists():
    raise SystemExit('Abbruch: Ergebnisse existieren schon.')
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

VARIANTEN = [
    ('BASIS', 'heutiger Stand (k 1.645, Reserve 0.25 m, Spiegel 0.10 m, Hoehe 0.10 m, D = Huelle mit Wasserwerfer, Hoehenregel ein)', {}),
    ('K_1282', 'Toleranzfaktor k = 1.282 (90 % einseitig)', {'k': 1.282}),
    ('K_1960', 'Toleranzfaktor k = 1.96 (97.5 % einseitig)', {'k': 1.96}),
    ('RESERVE_015', 'Fahrreserve B-D 0.15 m je Seite', {'reserve': {'A': 0.15, 'B': 0.15, 'C': 0.15, 'D': 0.15}}),
    ('RESERVE_035', 'Fahrreserve B-D 0.35 m je Seite', {'reserve': {'A': 0.15, 'B': 0.35, 'C': 0.35, 'D': 0.35}}),
    ('SPIEGEL_000', 'Spiegelabstand 0 m', {'spiegel': 0.0}),
    ('SPIEGEL_020', 'Spiegelabstand 0.20 m', {'spiegel': 0.20}),
    ('HOEHE_000', 'Hoehenreserve 0 m', {'hoehe': 0.0}),
    ('HOEHE_020', 'Hoehenreserve 0.20 m', {'hoehe': 0.20}),
    ('D_OHNE_WASSERWERFER', 'D ohne Wasserwerfer: Huelle der Feuerwehr (G-TLF 16: 26 t, 3.40 m)', {'ohne': ['WAWE']}),
    ('HOEHENREGEL_AUS', 'ohne Hoehenregel 4.00 m (Stand V9.2f)', {'hoehenregel': False}),
]


def patche(text, p, tmp):
    def r(alt, neu):
        nonlocal text
        assert text.count(alt) == 1, alt
        text = text.replace(alt, neu)
    r("OUT = NMDIR / 'BORS_Netzmaster_V9_{}.gpkg'.format(STAMP)", "OUT = Path(r'{}') / 'BORS_Netzmaster_V9_{{}}.gpkg'.format(STAMP)".format(tmp))
    text = text.replace("NMDIR / (OUT.stem", "Path(r'{}') / (OUT.stem".format(tmp))
    if 'ohne' in p:
        r("_FZ = lade_fahrzeuge(AKT / 'BORS_Fahrzeuge_V1.csv')\n",
          "_FZ = lade_fahrzeuge(AKT / 'BORS_Fahrzeuge_V1.csv')\n_FZ = {k: v for k, v in _FZ.items() if k not in " + repr(p['ohne']) + "}\n")
        r("GEWICHT = {'A': 3.1, 'B': 5.5, 'C': 17.0, 'D': 28.4}", "GEWICHT = {'A': 3.1, 'B': 5.5, 'C': 17.0, 'D': MASSE['D']['gewicht_t']}")
    if 'reserve' in p:
        r("RESERVE = {'A': 0.15, 'B': 0.25, 'C': 0.25, 'D': 0.25}", "RESERVE = " + repr(p['reserve']))
    if 'spiegel' in p:
        r("RES_SPIEGEL = 0.10\n", "RES_SPIEGEL = {}\n".format(p['spiegel']))
    if 'hoehe' in p:
        r("RES_SPIEGEL = ", "HOEHE_RESERVE = {}\nRES_SPIEGEL = ".format(p['hoehe']))
    if 'hoehenregel' in p:
        r("HOEHENREGEL_4M = globals().get('BORS_HOEHENREGEL_4M', True)", "HOEHENREGEL_4M = {}".format(p['hoehenregel']))
    if 'k' in p:
        d = 1.645 - p['k']
        r("BREITE = {r[bc.index('seg_id')]: dict(zip(bc, r)) for r in b.execute('select * from breite_v9')}\n",
          "BREITE = {r[bc.index('seg_id')]: dict(zip(bc, r)) for r in b.execute('select * from breite_v9')}\n"
          "for _m in BREITE.values():\n"
          "    _s = _m.get('sigma_breite_m')\n"
          "    if _s:\n"
          "        for _k, _v in (('untere_schranke_m', 1), ('untere_schranke_fest_m', 1), ('obere_schranke_fest_m', -1)):\n"
          "            if _m.get(_k) is not None:\n"
          "                _m[_k] = _m[_k] + _v * " + repr(d) + " * _s\n")
    return text


def zustaende(gpkg):
    c = sqlite3.connect(str(gpkg))
    rows = c.execute('select seg_id, laenge_m, zone, a_v9_status, b_v9_status, c_v9_status, d_v9_status from netz_v5 where ist_routingtyp = 1').fetchall()
    c.close()
    return {r[0]: (r[1] or 0, r[2], r[3:]) for r in rows}


text0 = SKRIPT.read_text(encoding='utf-8')
ergebnis, basis = [], None
for name, beschr, p in VARIANTEN:
    vt = TMP / name
    vt.mkdir(exist_ok=True)
    g = {'__name__': '__bors_sens__', 'BORS_ROOT': ROOT}
    t0 = time.time()
    exec(compile(patche(text0, p, vt), str(SKRIPT) + ' [' + name + ']', 'exec'), g)
    gp = sorted(vt.glob('BORS_Netzmaster_V9_*.gpkg'))[-1]
    z = zustaende(gp)
    if name == 'BASIS':
        basis = z
        aktiv = zustaende(AKTIV)
        diff = sum(1 for s in z if z[s][2] != aktiv.get(s, (0, 0, None))[2])
        print('Pruefung Basis gegen aktiven Lauf 1118: {} Abschnitte mit anderem Zustand'.format(diff))
        if diff:
            raise SystemExit('Basis weicht vom aktiven Netz ab - Abbruch')
    for i, c in enumerate('ABCD'):
        km = {'VALIDIERT': 0.0, 'UNVALIDIERT': 0.0, 'GESPERRT': 0.0}
        for s, (L, zone, st) in z.items():
            if zone == 'BEWERTUNG' and st[i] in km:
                km[st[i]] += L / 1000
        wechsel = {}
        for s, (L, zone, st) in z.items():
            b = basis[s][2][i]
            if st[i] != b:
                wechsel[b + '->' + st[i]] = wechsel.get(b + '->' + st[i], 0) + 1
        ergebnis.append({'variante': name, 'beschreibung': beschr, 'klasse': c, 'km_validiert': round(km['VALIDIERT'], 1), 'km_unvalidiert': round(km['UNVALIDIERT'], 1),
                         'km_gesperrt': round(km['GESPERRT'], 1), 'abschnitte_anders_als_basis': sum(wechsel.values()), 'wechsel': json.dumps(wechsel, ensure_ascii=False)})
    for f in vt.iterdir():          # temporaere Ausgabe entfernen (nur eigene Zwischenergebnisse)
        f.unlink()
    vt.rmdir()
    print('{:<22} {:5.0f} s  {}'.format(name, time.time() - t0, ' | '.join('{} V{} U{} G{}'.format(r['klasse'], r['km_validiert'], r['km_unvalidiert'], r['km_gesperrt']) for r in ergebnis[-4:])))

with open(OUT / 'sensitivitaet_km.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=list(ergebnis[0].keys()), delimiter=';')
    w.writeheader()
    w.writerows(ergebnis)
print('geschrieben:', OUT / 'sensitivitaet_km.csv')
