# -*- coding: utf-8 -*-
"""Kontrolle: AV-Bodenbedeckung ueber dem Orthofoto-Detail (gleicher Ausschnitt wie r2_ortho, gedreht). Nur lesend.
Erst NACH der eingefrorenen Ablesung verwenden (zeigt Modellgeometrie). Aufruf:
  python -I r7_overlay.py <BORS_ROOT> <referenzset.csv> <bildordner_roh> <ausgabeordner> F001:Q1 ...
Farben: rot Strasse/Weg, blau uebrige befestigte, gelb Trottoir, magenta Verkehrsinsel, weiss Gebaeude, orange EO-Hindernisse,
gruen Parkfelder (Stadt Bern/OSM)."""
import csv, math, sqlite3, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT, REFC, ROH, AUS = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]); AUS.mkdir(parents=True, exist_ok=True)
wahl = [tuple(a.split(':')) for a in sys.argv[5:]]
ns = {}
exec(compile((ROOT / '01_Skripte' / 'Aktuell' / 'bors_geo.py').read_text(encoding='utf-8'), 'bors_geo.py', 'exec'), ns)
ringe = ns['ringe']; linien = ns['linien']
FARBE = {'Strasse, Weg': (255, 40, 40), 'übrige befestigte': (60, 120, 255), 'Trottoir': (255, 230, 0), 'Verkehrsinsel': (255, 0, 255),
         'Gebäude': (255, 255, 255)}
qs = {(z['fall'], z['querschnitt']): z for z in csv.DictReader(open(REFC, encoding='utf-8-sig'), delimiter=';')}
pts = [(float(qs[w]['E']), float(qs[w]['N'])) for w in wahl]
R = 30.0


def nahe(geom_rings):
    for poly in geom_rings:
        for r in poly:
            for x, y in r:
                if any(abs(x - px) < R and abs(y - py) < R for px, py in pts):
                    return True
    return False


av = ROOT / '02_Daten' / '2_Aktuell_V9' / 'av_export_20261028_1447.gpkg'
c = sqlite3.connect('file:{}?mode=ro'.format(av.as_posix()), uri=True)
POLY = []
for g, art in c.execute('select geom, bbartt_bez_de from bb'):
    if art not in FARBE:
        continue
    rg = ringe(g)
    if nahe(rg):
        POLY.append((art, rg))
for g, art in c.execute("select geom, eoartt_bez_de from eof where gueltig != 0"):
    if art in ('Mauer', 'Pfeiler', 'Brunnen', 'massiver Sockel', 'Mast Antenne', 'wichtige Treppe'):
        rg = ringe(g)
        if nahe(rg):
            POLY.append(('EO', rg))
pk = sorted((ROOT / '02_Daten' / '2_Aktuell_V9' / 'Vorstufen').glob('parkierung_v5_*.gpkg'))[-1]
c = sqlite3.connect('file:{}?mode=ro'.format(pk.as_posix()), uri=True)
for g, in c.execute('select geom from parkierung'):
    rg = ringe(g)
    if nahe(rg):
        POLY.append(('PARK', rg))
RES, S = 0.04, 48.0
W = int(S / RES)
for w in wahl:
    z = qs[w]
    E, N, az = float(z['E']), float(z['N']), float(z['richtung_grad'])
    roh = ROH / '{}_{}_{}_roh.jpg'.format(w[0], w[1], z['seg_id'])
    im = Image.open(roh).convert('RGB'); dr = ImageDraw.Draw(im)
    pix = lambda x, y: ((x - (E - S / 2)) / RES, ((N + S / 2) - y) / RES)
    for art, rg in POLY:
        col = FARBE.get(art, (255, 140, 0) if art == 'EO' else (0, 230, 0))
        for poly in rg:
            for r in poly:
                dr.line([pix(*p) for p in r], fill=col, width=2)
    im = im.rotate(az - 90, resample=Image.BICUBIC)
    bw, bh = int(12 / RES), int(20 / RES)
    det = im.crop((int(W / 2 - bw / 2), int(W / 2 - bh / 2), int(W / 2 - bw / 2) + bw, int(W / 2 - bh / 2) + bh))
    d = ImageDraw.Draw(det)
    x = bw / 2
    for k in range(-10, 11):
        y = bh / 2 - k / RES
        d.line([(x - 8, y), (x + 8, y)], fill=(0, 255, 255)); d.text((x + 10, y - 7), '{:+d}'.format(k), fill=(0, 255, 255))
    det.save(AUS / '{}_{}_overlay.png'.format(*w))
    print(w)
