# -*- coding: utf-8 -*-
"""Statuswechsel alt -> neu je Klasse mit Grund und Szenario Spiegelregel (nur lesend, Zielgebiet BEWERTUNG).
Aufruf: python -I r16_statuswechsel.py <netzmaster_alt.gpkg> <netzmaster_neu.gpkg> <breite_v9_4.gpkg> <ausgabe_prefix>
Ausgaben:
  <prefix>_matrix.csv    klasse;status_alt;status_neu;abschnitte;km
  <prefix>_gruende.csv   klasse;wechsel;grund;abschnitte;km  (Grund: Ursache der Breitenaenderung, sonst Kriterium des neuen/weggefallenen Grundes)
  <prefix>_spiegel.csv   Abschnitte, die nur wegen der verschaerften Spiegelregel nicht nachgewiesen sind (siehe unten)
  <prefix>.txt           Zusammenfassung
Spiegelregel (Szenario, keine Modellaenderung): Korridor nicht nachgewiesen (<p>_k_untere_m < 0), aber die Reserve mit
Spiegel ueber Trottoir/Insel (<p>_k_spiegel_niedrig_reserve_m, Parkfelder belegt) abzueglich derselben Messunsicherheit
(<p>_k_reserve_m - <p>_k_untere_m) waere >= 0. 'Status waere validiert', wenn der Abschnitt UNVALIDIERT ist und alle Gruende
nur die Breite betreffen. Naeherung: Messunsicherheit des massgebenden Bereichs ohne Spiegel uebernommen."""
import csv, sqlite3, sys
from collections import Counter

ALT, NEU, BR, OUT = sys.argv[1:5]
ro = lambda f: sqlite3.connect('file:{}?mode=ro'.format(f.replace('\\', '/')), uri=True)
F = ['zone', 'laenge_m', 'name', 'highway_type', 'gemeinde'] + ['{}_{}'.format(p, k) for p in 'abcd' for k in ('v9_status', 'v9_grund', 'breite_v9', 'breite_v9_grund')]
lade = lambda f: {r[0]: dict(zip(F, r[1:])) for r in ro(f).execute('select seg_id, {} from netz_v5 where ist_routingtyp = 1'.format(', '.join(F)))}
A, N = lade(ALT), lade(NEU)
bc = ro(BR); kol = [r[1] for r in bc.execute('pragma table_info(breite_v9)')]
BRT = {r[kol.index('seg_id')]: dict(zip(kol, r)) for r in bc.execute('select * from breite_v9')}


def urs_breite(g):
    if 'Fahrkorridor nachgewiesen' in g:
        return 'Breite: Korridor nachgewiesen' + (' (Bauwerk abgeleitet)' if 'abgeleitet' in g else '')
    for k, t in (('freien Parkfeldern', 'Breite: Parkierung belegt'), ('Messunsicherheit', 'Breite: Messunsicherheit Abschnitt (Sidak)'),
                 ('wechselseitige', 'Breite: Schikane/Fahrzeuglaenge'), ('Kurve', 'Breite: Kurve (Schleppkurve)'),
                 ('Spiegel ueber Trottoir', 'Breite: nur mit Spiegel ueber Trottoir'), ('Messluecke', 'Breite: Messluecke'),
                 ('Seite', 'Breite: Seitenwechsel/Fahrbahnwechsel'), ('Engstelle', 'Breite: Engstelle'),
                 ('Fahrkorridor nachgewiesen', 'Breite: Korridor nachgewiesen'), ('keine Fahrbahnflaeche', 'Breite: Bruecke/Tunnel ohne Fahrbahnflaeche'),
                 ('ausserhalb der AV', 'Breite: Achse ausserhalb AV-Strassenflaeche')):
        if k in g:
            return t + (' (Bauwerk abgeleitet)' if 'abgeleitet' in g and k == 'Fahrkorridor nachgewiesen' else '')
    return 'Breite: ' + g[:50]


def teile(g):
    return [t for t in (g or '').split(' | ') if t and not t.startswith('vorher:')]


def kriterium(t):
    return t.split(':')[0].split(' ')[0] if t else '-'


mat, mn, gr, grn = Counter(), Counter(), Counter(), Counter()
sp_km, sp_n, sp_val, sp_val_n, sp_alt_aus = Counter(), Counter(), Counter(), Counter(), Counter()
sp_rows = []
for s, n in N.items():
    a = A.get(s)
    if not a or n['zone'] != 'BEWERTUNG':
        continue
    L = (n['laenge_m'] or 0) / 1000
    m = BRT.get(s, {})
    for p in 'abcd':
        P = p.upper(); sa, sn = a[p + '_v9_status'], n[p + '_v9_status']
        mat[(P, sa, sn)] += L; mn[(P, sa, sn)] += 1
        if sa != sn:
            if a[p + '_breite_v9'] != n[p + '_breite_v9']:
                g = urs_breite(n[p + '_breite_v9_grund'] or '')
            else:
                ta, tn = set(teile(a[p + '_v9_grund'])), set(teile(n[p + '_v9_grund']))
                d = sorted(tn - ta) or sorted(ta - tn)
                g = 'anderes Kriterium: ' + (kriterium(d[0]) if d else 'Text gleich')
            gr[(P, sa + '->' + sn, g)] += L; grn[(P, sa + '->' + sn, g)] += 1
        # Szenario Spiegelregel
        u, r, sp = m.get(p + '_k_untere_m'), m.get(p + '_k_reserve_m'), m.get(p + '_k_spiegel_niedrig_reserve_m')
        if n[p + '_breite_v9'] == 'NICHT_ENTSCHEIDBAR' and u is not None and u < 0 and r is not None and sp is not None and sp - (r - u) >= 0 \
                and (m.get(p + '_k_ursache') or '') != 'KNOTEN':
            sp_km[P] += L; sp_n[P] += 1
            nur_breite = sn == 'UNVALIDIERT' and all(t.startswith('Breite') for t in teile(n[p + '_v9_grund']))
            if nur_breite:
                sp_val[P] += L; sp_val_n[P] += 1
            if a[p + '_breite_v9'] == 'AUSREICHEND':
                sp_alt_aus[P] += L
            sp_rows.append([s, n['name'] or '', n['highway_type'], n['gemeinde'], round(L * 1000, 1), P, round(u, 3), round(r, 3), round(sp, 3),
                            round(sp - (r - u), 3), a[p + '_breite_v9'], sn, nur_breite])
w = lambda f, kopf, rows: (lambda fh: (csv.writer(fh, delimiter=';').writerow(kopf), csv.writer(fh, delimiter=';').writerows(rows), fh.close()))(
    open(f, 'w', newline='', encoding='utf-8-sig'))
w(OUT + '_matrix.csv', ['klasse', 'status_alt', 'status_neu', 'abschnitte', 'km'], [list(k) + [mn[k], round(v, 2)] for k, v in sorted(mat.items())])
w(OUT + '_gruende.csv', ['klasse', 'wechsel', 'grund', 'abschnitte', 'km'],
  [list(k) + [grn[k], round(v, 2)] for k, v in sorted(gr.items(), key=lambda x: (x[0][0], x[0][1], -x[1]))])
w(OUT + '_spiegel.csv', ['seg_id', 'name', 'strassentyp', 'gemeinde', 'laenge_m', 'klasse', 'k_untere_m', 'k_reserve_m', 'spiegel_ueber_trottoir_reserve_m',
                         'spiegel_ueber_trottoir_untere_m', 'breite_alt_2203', 'status_neu', 'status_waere_validiert'], sp_rows)
T = []
S = ['VALIDIERT', 'UNVALIDIERT', 'GESPERRT']
for P in 'ABCD':
    T.append('{}: Statuswechsel (km, Abschnitte)'.format(P))
    for x in S:
        T.append('   {:<12}'.format(x[:12]) + ' '.join('-> {:<4} {:7.1f} km ({:5d})'.format(y[:4], mat[(P, x, y)], mn[(P, x, y)]) for y in S))
    for k, v in sorted(((k, v) for k, v in gr.items() if k[0] == P), key=lambda x: -x[1])[:14]:
        T.append('     {:<26} {:<55} {:5d} Abschn. {:7.1f} km'.format(k[1], k[2][:55], grn[k], v))
    T.append('   Spiegelregel-Szenario: {:.1f} km ({} Abschnitte) waeren mit Spiegel ueber Trottoir ausreichend; davon in 2203 ausreichend {:.1f} km; '
             'Status waere validiert {:.1f} km ({} Abschnitte)'.format(sp_km[P], sp_n[P], sp_alt_aus[P], sp_val[P], sp_val_n[P]))
open(OUT + '.txt', 'w', encoding='utf-8').write('\n'.join(T) + '\n')
print('\n'.join(T))
