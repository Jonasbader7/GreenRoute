# Orthofoto-Ausschnitt (SWISSIMAGE, WMS swisstopo) mit Messskala quer zur Strasse fuer die Breitenpruefung am Bildschirm.
# Nur lesend; Bilder sind der Beleg fuer Befunde mit Methode ORTHOFOTO.
# Aufruf: python -I b2_ortho_skala.py <netz.json> <ausgabeordner> <seg_id>:<E>:<N>[:<halbe_breite_m>] ...
#   Zeichnet: OSM-Achse des Abschnitts (tuerkis), drei Querschnitte (Mitte rot am Punkt, gelb +-4 m entlang der Achse)
#   mit Strichen alle 0.5 m und Zahlen alle 1 m (0 = Achse, + links / - rechts in Abschnittsrichtung).
import json, math, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

nj, aus = sys.argv[1], Path(sys.argv[2])
aus.mkdir(parents=True, exist_ok=True)
D = json.load(open(nj, encoding='utf-8'))
idx = {a[0]: f for f, a in enumerate(D['attr'])}
RES = 0.04          # m pro Pixel im Ausschnitt (SWISSIMAGE 10 cm, vergroessert)
HALB = 14.0         # halbe Bildbreite in m
try:
    FONT = ImageFont.truetype('arial.ttf', 15)
except OSError:
    FONT = ImageFont.load_default()


def linie(f):
    return [[(D['nodes'][2 * i] / 100 + D['x0'], D['nodes'][2 * i + 1] / 100 + D['y0']) for i in p] for p in D['segs'][f][0]]


def tangente(parts, E, N):
    best = None
    for P in parts:
        for i in range(len(P) - 1):
            (x1, y1), (x2, y2) = P[i], P[i + 1]
            dx, dy = x2 - x1, y2 - y1; L2 = dx * dx + dy * dy
            if not L2:
                continue
            t = max(0, min(1, ((E - x1) * dx + (N - y1) * dy) / L2))
            d = math.dist((E, N), (x1 + t * dx, y1 + t * dy))
            if best is None or d < best[0]:
                L = math.sqrt(L2); best = (d, dx / L, dy / L, x1 + t * dx, y1 + t * dy)
    return best


for arg in sys.argv[3:]:
    teile = arg.split(':')
    sid, E, N = teile[0], float(teile[1]), float(teile[2])
    q = float(teile[3]) if len(teile) > 3 else 8.0
    f = idx[sid]; parts = linie(f)
    _, tx, ty, E0, N0 = tangente(parts, E, N)       # Punkt auf die Achse projizieren
    nx, ny = -ty, tx                                 # Normale (links der Abschnittsrichtung)
    x0, y0 = E0 - HALB, N0 - HALB
    W = int(2 * HALB / RES)
    url = ('https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=&CRS=EPSG:2056'
           '&BBOX={:.2f},{:.2f},{:.2f},{:.2f}&WIDTH={}&HEIGHT={}&FORMAT=image/png').format(x0, y0, x0 + 2 * HALB, y0 + 2 * HALB, W, W)
    roh = aus / '{}_roh.png'.format(sid)
    if not roh.exists():
        urllib.request.urlretrieve(url, str(roh))
    im = Image.open(roh).convert('RGB'); dr = ImageDraw.Draw(im)
    px = lambda e, n: ((e - x0) / RES, (y0 + 2 * HALB - n) / RES)
    for P in parts:
        dr.line([px(*p) for p in P], fill=(0, 230, 230), width=2)
    for s, farbe in ((0.0, (255, 40, 40)), (-4.0, (255, 220, 0)), (4.0, (255, 220, 0))):
        cx, cy = E0 + s * tx, N0 + s * ty
        a, b = px(cx - q * nx, cy - q * ny), px(cx + q * nx, cy + q * ny)
        dr.line([a, b], fill=farbe, width=1)
        k = -q
        while k <= q + 1e-9:
            mx, my = px(cx + k * nx, cy + k * ny)
            lang = 7 if abs(k - round(k)) < 1e-9 else 4
            dr.line([(mx - lang * tx, my + lang * ty), (mx + lang * tx, my - lang * ty)], fill=farbe, width=1)
            if s == 0.0 and abs(k - round(k)) < 1e-9:
                dr.text((mx + 9 * tx + 2, my - 9 * ty - 8), '{:+d}'.format(int(round(k))), fill=farbe, font=FONT)
            k += 0.5
    dr.text((8, 8), '{}  Punkt {:.0f}/{:.0f}  rot: Querschnitt am Punkt, gelb: +-4 m; Striche 0.5 m'.format(sid, E0, N0), fill=(255, 255, 255), font=FONT)
    im.save(aus / '{}_skala.png'.format(sid))
    print(sid, 'Achse bei {:.1f}/{:.1f}, Richtung {:.0f} Grad'.format(E0, N0, math.degrees(math.atan2(tx, ty)) % 360), '->', aus / '{}_skala.png'.format(sid))
