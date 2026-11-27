# -*- coding: utf-8 -*-
"""Vergleich alt/neu ueber das ganze Netz (Zielgebiet BEWERTUNG). Nur lesend.
Aufruf: python -I r10_vergleich.py <netzmaster_alt.gpkg> <netzmaster_neu.gpkg> <breite_v9_4.gpkg> <ausgabe_prefix>
Ausgaben: <prefix>_klassen.csv (km je Klasse und Breitenentscheid/Status alt/neu), <prefix>_ursachen.csv (Ursache der Aenderung),
<prefix>_gemeinde_typ.csv, <prefix>_fahrzeuge.csv (konkrete Fahrzeuge), <prefix>_lokal.csv (lokale Laenge der Ursache
gegenueber der Abschnittslaenge), <prefix>_sperren.csv (alle Abschnitte, deren Sperre gelockert wird), <prefix>.txt (Zusammenfassung)."""
import csv, re, sqlite3, sys
from collections import Counter, defaultdict

ALT, NEU, BR, OUT = sys.argv[1:5]


def lade(f, felder):
    c = sqlite3.connect('file:{}?mode=ro'.format(f.replace('\\', '/')), uri=True)
    return {r[0]: dict(zip(felder, r[1:])) for r in c.execute('select seg_id, {} from netz_v5 where ist_routingtyp = 1'.format(', '.join(felder)))}


F = ['zone', 'laenge_m', 'gemeinde', 'highway_type', 'name'] + ['{}_{}'.format(p, k) for p in 'abcd' for k in ('breite_v9', 'v9_status', 'breite_v9_grund', 'v9_grund', 'breite_v9_beleg')]
A, N = lade(ALT, F), lade(NEU, F)
b = sqlite3.connect('file:{}?mode=ro'.format(BR.replace('\\', '/')), uri=True)
EV = defaultdict(list)
for sid, kl, ty, v, bi, L in b.execute('select seg_id, klasse, typ, station_von_m, station_bis_m, laenge_m from ereignisse_v9_4'):
    EV[sid].append((kl, ty, v, bi, L))
FZ = defaultdict(Counter); FZkm = defaultdict(Counter)
LEN = {s: (N[s]['laenge_m'] or 0) for s in N}
for sid, fz, kl, unt, urs in b.execute('select seg_id, fahrzeug, klasse, untere_m, ursache from fahrzeug_v9_4'):
    if N.get(sid, {}).get('zone') != 'BEWERTUNG':
        continue
    ok = urs == 'WIE_KLASSE_OK' or (unt is not None and unt >= 0)
    FZ[fz]['ok' if ok else 'nicht'] += 1; FZkm[fz]['ok' if ok else 'nicht'] += LEN[sid] / 1000


def ursache(g):
    for k, t in (('freien Parkfeldern', 'Parkierung belegt'), ('Messunsicherheit', 'Messunsicherheit (Abschnitt)'), ('wechselseitige', 'Schikane/Fahrzeuglaenge'),
                 ('Kurve', 'Kurve (Schleppkurve)'), ('Spiegel ueber Trottoir', 'nur mit Spiegel ueber Trottoir'), ('Messluecke', 'Messluecke'),
                 ('Seite', 'Seitenwechsel/Fahrbahnwechsel'), ('Engstelle', 'Engstelle'), ('Fahrkorridor nachgewiesen', 'Korridor nachgewiesen')):
        if k in g:
            return t
    return 'andere: ' + g[:40]


km = Counter(); ur = Counter(); urn = Counter(); gt = Counter(); lok = defaultdict(list); sperr = []
for s, n in N.items():
    a = A.get(s)
    if not a or n['zone'] != 'BEWERTUNG':
        continue
    L = (n['laenge_m'] or 0) / 1000
    for p in 'abcd':
        P = p.upper()
        km[(P, 'breite_alt', a[p + '_breite_v9'])] += L; km[(P, 'breite_neu', n[p + '_breite_v9'])] += L
        km[(P, 'status_alt', a[p + '_v9_status'])] += L; km[(P, 'status_neu', n[p + '_v9_status'])] += L
        km[(P, 'beleg_neu', n[p + '_breite_v9_beleg'])] += L
        ea, en = a[p + '_breite_v9'], n[p + '_breite_v9']
        if ea != en:
            u = ursache(n[p + '_breite_v9_grund'] or '') if en != 'AUSREICHEND' else ('Korridor nachgewiesen' + (' (Bauwerk abgeleitet)' if 'abgeleitet' in (n[p + '_breite_v9_grund'] or '') else ''))
            ur[(P, ea, en, u)] += L; urn[(P, ea, en, u)] += 1
            gt[(P, n['gemeinde'], n['highway_type'], ea + '->' + en)] += L
            if en == 'NICHT_ENTSCHEIDBAR':
                loc = sum(e[4] or 0 for e in EV[s] if e[0] in (P, '-'))
                lok[P].append((L * 1000, loc))
        if a[p + '_v9_status'] == 'GESPERRT' and n[p + '_v9_status'] != 'GESPERRT':
            sperr.append([s, n['name'], n['highway_type'], round(L * 1000, 1), P, a[p + '_v9_grund'][:150], n[p + '_v9_status'], n[p + '_v9_grund'][:200]])
with open(OUT + '_klassen.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['klasse', 'art', 'wert', 'km'])
    for k, v in sorted(km.items(), key=lambda x: tuple(str(y) for y in x[0])):
        w.writerow(list(k) + [round(v, 2)])
with open(OUT + '_ursachen.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['klasse', 'breite_alt', 'breite_neu', 'ursache', 'abschnitte', 'km'])
    for k, v in sorted(ur.items(), key=lambda x: (x[0][0], -x[1])):
        w.writerow(list(k) + [urn[k], round(v, 2)])
with open(OUT + '_gemeinde_typ.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['klasse', 'gemeinde', 'strassentyp', 'aenderung', 'km'])
    for k, v in sorted(gt.items(), key=lambda x: (x[0][0], -x[1])):
        w.writerow(list(k) + [round(v, 3)])
with open(OUT + '_fahrzeuge.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['fahrzeug', 'abschnitte_korridor_ok', 'abschnitte_nicht', 'km_ok', 'km_nicht'])
    for fz in sorted(FZ):
        w.writerow([fz, FZ[fz]['ok'], FZ[fz]['nicht'], round(FZkm[fz]['ok'], 1), round(FZkm[fz]['nicht'], 1)])
with open(OUT + '_sperren.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';'); w.writerow(['seg_id', 'name', 'strassentyp', 'laenge_m', 'klasse', 'grund_alt', 'status_neu', 'grund_neu']); w.writerows(sperr)
txt = []
for P in 'ABCD':
    txt.append('{}: Breite alt  aus {:.1f} | ne {:.1f} | unz {:.1f} km   neu  aus {:.1f} | ne {:.1f} | unz {:.1f} km   Status neu val {:.1f} | unv {:.1f} | ges {:.1f} (alt {:.1f} | {:.1f} | {:.1f})'.format(
        P, km[(P, 'breite_alt', 'AUSREICHEND')], km[(P, 'breite_alt', 'NICHT_ENTSCHEIDBAR')], km[(P, 'breite_alt', 'UNZUREICHEND')],
        km[(P, 'breite_neu', 'AUSREICHEND')], km[(P, 'breite_neu', 'NICHT_ENTSCHEIDBAR')], km[(P, 'breite_neu', 'UNZUREICHEND')],
        km[(P, 'status_neu', 'VALIDIERT')], km[(P, 'status_neu', 'UNVALIDIERT')], km[(P, 'status_neu', 'GESPERRT')],
        km[(P, 'status_alt', 'VALIDIERT')], km[(P, 'status_alt', 'UNVALIDIERT')], km[(P, 'status_alt', 'GESPERRT')]))
    for k, v in sorted(((k, v) for k, v in ur.items() if k[0] == P), key=lambda x: -x[1])[:12]:
        txt.append('    {} -> {} {}: {} Abschnitte, {:.1f} km'.format(k[1][:4], k[2][:4], k[3], urn[k], v))
    if lok[P]:
        sL = sum(x for x, _ in lok[P]); sl = sum(y for _, y in lok[P])
        txt.append('    neu ungeklaert: {:.1f} km Abschnittslaenge, davon lokal gemeldete Engstellen/Messluecken {:.1f} km'.format(sL / 1000, sl / 1000))
txt.append('Sperren gelockert (GESPERRT -> anders, alle Klassen): {}'.format(len(sperr)))
open(OUT + '.txt', 'w', encoding='utf-8').write('\n'.join(txt) + '\n')
print('\n'.join(txt))
