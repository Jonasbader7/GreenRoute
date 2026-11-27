# -*- coding: utf-8 -*-
"""Referenzset V1 fuer die Breitenbewertung (10.11.2026). Nur lesend, normales Python.
Aufruf: python -I r1_referenzset.py <BORS_ROOT>
Schichten (ein Abschnitt kann in mehreren liegen; gezogen wird er in der ersten, die anderen werden vermerkt):
  R01 kurze Engstelle neu (V9.3: ein Profil < Bedarf, robust >= Bedarf, irgendeine Klasse A-D)
  R02 versetzte Achse (>= 20 % der Profile)
  R03 Mittelinsel/getrennte Fahrbahn (Rand Verkehrsinsel an der Engstelle oder Seitenwechsel gemeldet)
  R04 Parkierung (belegt >= 0.5 m schmaler als fest)   R05 breite Plaetze (>= 5 Profile an der Suchgrenze)
  R06 Bruecke/Tunnel/ueberdeckt/ueber unterirdischem Bau
  R07/R08/R09 D validiert / ungeklaert / gesperrt wegen Breite (Netzmaster 2203)
  R10 wichtig (>= 25 Routen Wache -> Zufallsziel, Web-Router)   R11 Sperre gelockert V9.1 -> V9.3 (alle Faelle, alle Klassen)
  R12 reine Zufallsauswahl   R13 neu ausreichend V9.3 (nicht entscheidbar -> ausreichend, irgendeine Klasse)
Aufteilung Validierung (V) / Entwicklung (E): SHA1(seg_id|20261110) ungerade/gerade, unabhaengig von der Schicht.
Ausgaben (nie ueberschrieben): referenz/referenzset_v1.csv (blind, ohne Modellwerte), referenz/referenzset_v1_schluessel.csv,
  referenz/referenzset_v1_meta.txt
"""
import csv, hashlib, math, random, sqlite3, sys
from pathlib import Path

ROOT = Path(sys.argv[1]); AKT = ROOT / '02_Daten' / '2_Aktuell_V9'
REF = Path(__file__).resolve().parent.parent / 'referenz'
ns = {}
exec(compile((ROOT / '01_Skripte' / 'Aktuell' / 'bors_geo.py').read_text(encoding='utf-8'), 'bors_geo.py', 'exec'), ns)
linien, punkt_bei, laenge = ns['linien'], ns['punkt_bei'], ns['laenge']
SEED = 20261110


def lade(f, t='breite_v9'):
    c = sqlite3.connect('file:{}?mode=ro'.format(f.as_posix()), uri=True)
    cols = [r[1] for r in c.execute('pragma table_info({})'.format(t))]
    return {r[cols.index('seg_id')]: dict(zip(cols, r)) for r in c.execute('select * from {}'.format(t))}


B91 = lade(AKT / 'BORS_Breite_V9_20261028_1829.gpkg')
B93 = lade(AKT / 'BORS_Breite_V9_3_20261110_2141.gpkg')
c = sqlite3.connect('file:{}?mode=ro'.format((AKT / 'BORS_Netzmaster_V9_20261106_2203.gpkg').as_posix()), uri=True)
NM = {r[0]: r for r in c.execute("select seg_id, d_v9_status, d_v9_grund, c_v9_status, b_v9_status, a_v9_status, zone, d_breite_v9, "
                                  "a_breite_v9, b_breite_v9, c_breite_v9 from netz_v5 where ist_routingtyp=1")}
WICHT = {}
wf = REF / 'wichtigkeit_routen.csv'
for z in csv.DictReader(open(wf, encoding='utf-8'), delimiter=';'):
    WICHT[z['seg_id']] = int(z['routen'])


def split(sid):
    return 'V' if int(hashlib.sha1('{}|{}'.format(sid, SEED).encode()).hexdigest(), 16) % 2 else 'E'


def f(m, k, d=0.0):
    v = m.get(k)
    return d if v is None else v


basis = sorted(s for s, m in B93.items() if (m['laenge_m'] or 0) >= 10 and NM[s][6] == 'BEWERTUNG')
SCH = {
    'R01': lambda s, m: any(f(m, p + '_reserve_einzel_m', 9) < 0 <= f(m, p + '_reserve_profil_m', -9) for p in 'abcd'),
    'R02': lambda s, m: m['n_profile'] and m['n_achse_versetzt'] / m['n_profile'] >= 0.2,
    'R03': lambda s, m: 'Verkehrsinsel' in (m['rand_links'] or '') + (m['rand_rechts'] or '') or (m['durchgang_n'] or 0) > 0,
    'R04': lambda s, m: m['frei_fest_min_rel_m'] is not None and m['frei_parkiert_min_rel_m'] is not None
                        and m['frei_fest_min_rel_m'] - m['frei_parkiert_min_rel_m'] >= 0.5,
    'R05': lambda s, m: (m['n_suchgrenze'] or 0) >= 5,
    'R06': lambda s, m: any(k in (m['kunstbaute'] or '') for k in ('bridge', 'tunnel', 'covered')) or (m['ueber_unterirdisch_anteil'] or 0) >= 0.2,
    'R07': lambda s, m: NM[s][1] == 'VALIDIERT',
    'R08': lambda s, m: NM[s][1] == 'UNVALIDIERT',
    'R09': lambda s, m: NM[s][1] == 'GESPERRT' and NM[s][7] == 'UNZUREICHEND',
    'R10': lambda s, m: WICHT.get(s, 0) >= 25,
    'R11': lambda s, m: any(B91[s][p + '_breite'] == 'UNZUREICHEND' and m[p + '_breite'] != 'UNZUREICHEND' for p in 'abcd'),
    'R12': lambda s, m: True,
    'R13': lambda s, m: any(B91[s][p + '_breite'] == 'NICHT_ENTSCHEIDBAR' and m[p + '_breite'] == 'AUSREICHEND' for p in 'abcd'),
}
N = {'R01': 16, 'R02': 12, 'R03': 12, 'R04': 12, 'R05': 10, 'R06': 12, 'R07': 16, 'R08': 16, 'R09': 10, 'R10': 12,
     'R11': 99, 'R12': 20, 'R13': 16}
rng = random.Random(SEED)
gewaehlt, schichten, pool_n = [], {}, {}
for k in sorted(SCH):
    pool = sorted(s for s in (B93 if k == 'R11' else basis) if SCH[k](s, B93[s]))
    pool_n[k] = len(pool)
    rng.shuffle(pool)
    n = 0
    for s in pool:
        if n >= N[k]:
            break
        if s in schichten:
            continue
        schichten[s] = [k]; gewaehlt.append(s); n += 1
for s in gewaehlt:                                      # alle zutreffenden Schichten vermerken (+)
    for k in sorted(SCH):
        if k not in schichten[s] and k != 'R12' and SCH[k](s, B93[s]):
            schichten[s].append(k + '+')
zeilen, schl = [], []
for i, s in enumerate(gewaehlt, 1):
    m = B93[s]; pts = max(linien(m['geom']), key=len); L = laenge(pts)
    st = []
    for k in ('d_reserve_einzel_station_m', 'd_reserve_profil_station_m', 'engstelle_pos_m'):
        if m.get(k) is not None:
            st.append(float(m[k])); break
    if L >= 15:
        st.append(round(rng.uniform(5, L - 5), 1))
    if not st:
        st.append(round(L / 2, 1))
    for j, sv in enumerate(st):
        (x, y), (tx, ty) = punkt_bei(pts, sv)
        zeilen.append(dict(fall='F{:03d}'.format(i), querschnitt='Q{}'.format(j + 1), seg_id=s, split=split(s), schichten=' '.join(schichten[s]),
                           name=m['name'], gemeinde=m['gemeinde'], highway=m['highway'], laenge_m=round(L, 1), station_m=round(sv, 1),
                           art='kritisch' if j == 0 and len(st) == 2 or (len(st) == 1 and m.get('engstelle_pos_m') is not None) else 'zufall',
                           E=round(x, 2), N=round(y, 2), richtung_grad=round(math.degrees(math.atan2(tx, ty)) % 360, 1)))
    n = NM[s]
    schl.append(dict(fall='F{:03d}'.format(i), seg_id=s, split=split(s), schichten=' '.join(schichten[s]),
                     a_breite_2203=n[8], b_breite_2203=n[9], c_breite_2203=n[10], d_breite_2203=n[7],
                     a_status_2203=n[5], b_status_2203=n[4], c_status_2203=n[3], d_status_2203=n[1], d_grund_2203=(n[2] or '')[:200],
                     fahrbahn_median_m=m['fahrbahn_median_m'], frei_fest_min_m=m['frei_fest_min_rel_m'], untere_schranke_m=m['untere_schranke_m'],
                     untere_einzel_m=m['untere_schranke_einzel_m'], engstelle_pos_m=m['engstelle_pos_m'], engstelle_einzel_pos_m=m['engstelle_einzel_pos_m'],
                     rand=(m['rand_links'] or '') + ' / ' + (m['rand_rechts'] or ''),
                     **{p + '_breite_v91': B91[s][p + '_breite'] for p in 'abcd'}, **{p + '_breite_v93': m[p + '_breite'] for p in 'abcd'},
                     **{p + '_reserve_profil_m': m[p + '_reserve_profil_m'] for p in 'abcd'}, **{p + '_reserve_einzel_m': m[p + '_reserve_einzel_m'] for p in 'abcd'},
                     n_versetzt=m['n_achse_versetzt'], n_suchgrenze=m['n_suchgrenze'], n_ausserhalb=m['n_ausserhalb'], n_profile=m['n_profile']))
for name, rows in (('referenzset_v1.csv', zeilen), ('referenzset_v1_schluessel.csv', schl)):
    p = REF / name
    if p.exists():
        raise FileExistsError(p)
    with open(p, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, list(rows[0]), delimiter=';'); w.writeheader(); w.writerows(rows)
txt = ('Referenzset V1, Seed {}, Basis {} Abschnitte (Zone BEWERTUNG, >= 10 m; R11 ohne Einschraenkung)\nPool je Schicht: {}\nZiel je Schicht: {}\n'
       'Faelle {} (Validierung {}, Entwicklung {}), Querschnitte {}\n'
       'Quellen: BORS_Breite_V9_3_20261110_2141, BORS_Breite_V9_20261028_1829, BORS_Netzmaster_V9_20261106_2203, wichtigkeit_routen.csv\n').format(
    SEED, len(basis), pool_n, N, len(gewaehlt), sum(split(s) == 'V' for s in gewaehlt), sum(split(s) == 'E' for s in gewaehlt), len(zeilen))
(REF / 'referenzset_v1_meta.txt').write_text(txt, encoding='utf-8')
print(txt)
