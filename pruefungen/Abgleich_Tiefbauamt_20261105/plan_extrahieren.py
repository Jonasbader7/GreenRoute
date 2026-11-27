# -*- coding: utf-8 -*-
"""Schritt 1: farbige Gewichtslinien aus dem Vektor-PDF des Tiefbaus lesen (PDF-Punkte, y nach unten).
Braucht PyMuPDF (pip install pymupdf). Aufruf: python plan_extrahieren.py <plan.pdf> <ausgabe/plan_linien.json>
Farben laut Legende: 10 t hellorange, 16 t orange, 28 t rot, 34 t dunkelrot (Strichbreite 3.12 pt; Legende 2.88 pt).
Das Inset Felsenaubruecke (links oben) wird in georef.py/zuordnen.py ausgelassen (eigener Massstab, schon im Netz)."""
import json
import sys

import pymupdf

F = {(1.0, 0.0, 0.0): 28, (1.0, 0.828, 0.498): 10, (1.0, 0.666, 0.0): 16, (0.451, 0.0, 0.0): 34}
seite = pymupdf.open(sys.argv[1])[0]
out = []
for x in seite.get_drawings():
    col = tuple(round(v, 3) for v in x['color']) if x.get('color') else None
    if x['type'] != 's' or col not in F or abs(x['width'] - 3.12) > 0.01:
        continue
    pts = []
    for it in x['items']:
        if it[0] == 'l':
            pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == 'c':
            pts += [(it[1].x, it[1].y), (it[4].x, it[4].y)]
    out.append(dict(t=F[col], pts=pts, rect=list(x['rect'])))
json.dump(out, open(sys.argv[2], 'w'))
print(len(out), 'Linien')
