# -*- coding: utf-8 -*-
"""Orthofoto-Querschnitte fuer das Referenzset (SWISSIMAGE ueber WMS swisstopo, nur lesend).
Aufruf: python -I r2_ortho.py <BORS_ROOT> <referenzset.csv> <bildordner> [fall ...]
Je Querschnitt ein Bild aus zwei Teilen, beide gedreht (OSM-Achse waagrecht, Fahrtrichtung nach rechts, oben = links):
  links  Uebersicht 40 m entlang x 24 m quer (8 cm/Pixel), OSM-Achse des Abschnitts tuerkis, Station als roter Strich
  rechts Detail 12 m x 20 m (4 cm/Pixel); rot: Querschnitt an der Station (Striche 0.5 m, Zahlen 1 m, + oben = links),
         gelb: 4 m davor und danach.
Die Bilder enthalten keine Modellwerte (Ablesung blind). SWISSIMAGE hat 10 cm Bodenaufloesung; die Vergroesserung
erhoeht die Genauigkeit nicht."""
import csv, math, sqlite3, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT, ref, aus = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]); aus.mkdir(parents=True, exist_ok=True)
nur = set(sys.argv[4:])
ns = {}
exec(compile((ROOT / '01_Skripte' / 'Aktuell' / 'bors_geo.py').read_text(encoding='utf-8'), 'bors_geo.py', 'exec'), ns)
c = sqlite3.connect('file:{}?mode=ro'.format((ROOT / '02_Daten' / '2_Aktuell_V9' / 'BORS_Breite_V9_3_20261110_2141.gpkg').as_posix()), uri=True)
GEOM = {s: g for s, g in c.execute('select seg_id, geom from breite_v9')}
RES = 0.04; S = 48.0; W = int(S / RES)
try:
    FONT = ImageFont.truetype('arial.ttf', 13)
except OSError:
    FONT = ImageFont.load_default()
for z in csv.DictReader(open(ref, encoding='utf-8-sig'), delimiter=';'):
    if nur and z['fall'] not in nur:
        continue
    name = '{}_{}_{}'.format(z['fall'], z['querschnitt'], z['seg_id'])
    roh, bild = aus / (name + '_roh.jpg'), aus / (name + '.png')
    if bild.exists():
        continue
    E, N, az = float(z['E']), float(z['N']), float(z['richtung_grad'])
    if not roh.exists():
        url = ('https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=&CRS=EPSG:2056'
               '&BBOX={:.2f},{:.2f},{:.2f},{:.2f}&WIDTH={}&HEIGHT={}&FORMAT=image/jpeg').format(E - S / 2, N - S / 2, E + S / 2, N + S / 2, W, W)
        urllib.request.urlretrieve(url, str(roh))
    im = Image.open(roh).convert('RGB')
    dr0 = ImageDraw.Draw(im)                      # Achse vor dem Drehen einzeichnen (nur fuer die Uebersicht)
    pix = lambda e, n: ((e - (E - S / 2)) / RES, ((N + S / 2) - n) / RES)
    ov = im.copy(); dro = ImageDraw.Draw(ov)
    for part in ns['linien'](GEOM[z['seg_id']]):
        dro.line([pix(*p) for p in part], fill=(0, 230, 230), width=3)
    rot = lambda x: x.rotate(az - 90, resample=Image.BICUBIC)
    im, ov = rot(im), rot(ov)
    cx = cy = W / 2
    # Uebersicht 40 x 24 m -> 8 cm/Pixel
    ow, oh = int(40 / RES), int(24 / RES)
    o = ov.crop((int(cx - ow / 2), int(cy - oh / 2), int(cx - ow / 2) + ow, int(cy - oh / 2) + oh)).resize((ow // 2, oh // 2), Image.LANCZOS)
    d = ImageDraw.Draw(o)
    d.line([(ow // 4, 0), (ow // 4, 14)], fill=(255, 40, 40), width=3); d.line([(ow // 4, oh // 2 - 14), (ow // 4, oh // 2)], fill=(255, 40, 40), width=3)
    d.text((4, 2), '{} {} Uebersicht 40 m'.format(z['fall'], z['querschnitt']), fill=(255, 255, 255), font=FONT)
    # Detail 12 x 20 m -> 4 cm/Pixel
    bw, bh = int(12 / RES), int(20 / RES)
    det = im.crop((int(cx - bw / 2), int(cy - bh / 2), int(cx - bw / 2) + bw, int(cy - bh / 2) + bh))
    dr = ImageDraw.Draw(det)
    for dx, farbe in ((0.0, (255, 40, 40)), (-4.0, (255, 220, 0)), (4.0, (255, 220, 0))):
        x = bw / 2 + dx / RES
        k = -10.0
        while k <= 10.0 + 1e-9:
            y = bh / 2 - k / RES
            lang = 8 if abs(k - round(k)) < 1e-9 else 4
            dr.line([(x - lang, y), (x + lang, y)], fill=farbe, width=1)
            if dx == 0.0 and abs(k - round(k)) < 1e-9:
                dr.text((x + 10, y - 7), '{:+d}'.format(int(round(k))), fill=farbe, font=FONT)
            k += 0.5
        for yy in range(0, bh, 10):
            dr.line([(x, yy), (x, yy + 3)], fill=farbe, width=1)
    out = Image.new('RGB', (o.width + det.width + 6, max(o.height, det.height)), (0, 0, 0))
    out.paste(o, (0, 0)); out.paste(det, (o.width + 6, 0))
    out.save(bild)
    print(bild.name)
