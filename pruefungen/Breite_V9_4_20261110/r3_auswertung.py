# -*- coding: utf-8 -*-
"""Auswertung Referenzset V1 (Orthofoto-Ablesung) gegen Breitenentscheide verschiedener Staende. Nur lesend.
Aufruf: python -I r3_auswertung.py <referenz_ordner> <ausgabe_prefix> name=<netzmaster.gpkg> [name=<netzmaster.gpkg> ...]
Referenz je Querschnitt und Klasse (nur Ablesungen K/U, nicht im Knoten, mit Wert):
  P  passierbar:      fest_min >= Bedarf + 0.50 m (Orthofoto-Zuschlag wie Befundregel V9.2f)
  N  nicht passierbar: fest_max < Karosseriebreite
  E  eng:             fest_max < Bedarf (Bedarf ohne Spiegel ueber Trottoir), aber >= Karosserie
  G  Grenzbereich:    sonst
  Parkierung: frei_sichtbar < Bedarf -> Vermerk 'parkiert eng'
Kategorien je Fall und Klasse (Modell = <p>_breite_v9 des Netzmasters):
  FF_hart    Modell AUSREICHEND, ein Querschnitt N          (falsche Freigabe, Karosserie passt nicht)
  FF_bedarf  Modell AUSREICHEND, ein Querschnitt E          (falsche Freigabe gegen den Bedarf mit Reserve)
  FF_park    Modell AUSREICHEND, sichtbar parkierte Fahrzeuge lassen weniger als den Bedarf
  OK_frei    Modell AUSREICHEND, alle lesbaren Querschnitte P
  UN_krit    Modell NICHT_ENTSCHEIDBAR, kritischer Querschnitt P und dort nicht parkiert eng (Verdacht unnoetig ungeklaert)
  NE_bestaet Modell NICHT_ENTSCHEIDBAR, ein Querschnitt N/E (zu Recht nicht freigegeben)
  SP_bestaet / SP_fraglich  Modell UNZUREICHEND und Querschnitt N/E bzw. P
  OFFEN      alles andere (nicht lesbar, Grenzbereich)
Grenzen: eine Ablesung je Querschnitt, nicht der ganze Abschnitt; Orthofoto ist nicht vor Ort gemessen."""
import csv, sqlite3, sys
from collections import Counter, defaultdict
from pathlib import Path

REF = Path(sys.argv[1]); OUTP = sys.argv[2]
VAR = [a.split('=', 1) for a in sys.argv[3:]]
K = {'A': 1.94, 'B': 2.20, 'C': 2.50, 'D': 2.56}
BED = {'A': 2.39, 'B': 2.75, 'C': 3.20, 'D': 3.26}          # max(K + 2 rK, S + 2 x 0.10), ohne Spiegel ueber Trottoir
MARGE = 0.50
schl = {z['fall']: z for z in csv.DictReader(open(REF / 'referenzset_v1_schluessel.csv', encoding='utf-8-sig'), delimiter=';')}
qs = {(z['fall'], z['querschnitt']): z for z in csv.DictReader(open(REF / 'referenzset_v1.csv', encoding='utf-8-sig'), delimiter=';')}
abl = {(z['fall'], z['querschnitt']): z for z in csv.DictReader(open(REF / 'ablesung_orthofoto_v1.csv', encoding='utf-8'), delimiter=';')}


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def ref_q(a, P):
    if a['klar'] not in ('K', 'U') or a['achse'] == 'Knoten' or f(a['fest_min']) is None:
        return None, False
    lo, hi, fr = f(a['fest_min']), f(a['fest_max']), f(a['frei_sichtbar'])
    park = fr is not None and fr < BED[P]
    if hi < K[P]:
        return 'N', park
    if hi < BED[P]:
        return 'E', park
    if lo >= BED[P] + MARGE:
        return 'P', park
    return 'G', park


def modell(gpkg, sids):
    c = sqlite3.connect('file:{}?mode=ro'.format(Path(gpkg).as_posix()), uri=True)
    cols = [r[1] for r in c.execute('pragma table_info(netz_v5)')]
    out = {}
    for r in c.execute('select * from netz_v5 where seg_id in ({})'.format(','.join('?' * len(sids))), list(sids)):
        m = dict(zip(cols, r))
        out[m['seg_id']] = m
    return out


sids = {z['seg_id'] for z in schl.values()}
ERG = {}
zeilen = []
for name, gp in VAR:
    M = modell(gp, sids)
    for fall, s in schl.items():
        sid = s['seg_id']; m = M[sid]
        qq = sorted(k for k in abl if k[0] == fall)
        for P in 'ABCD':
            p = P.lower()
            e = m[p + '_breite_v9']; st = m[p + '_v9_status']
            refs = [(k[1], qs[k]['art']) + ref_q(abl[k], P) for k in qq]
            r_alle = [r for _, _, r, _ in refs if r]
            park = any(pk for _, _, _, pk in refs)
            krit = [r for q, art, r, _ in refs if art == 'kritisch']
            krit_park = any(pk for q, art, r, pk in refs if art == 'kritisch')
            if e == 'AUSREICHEND':
                kat = 'FF_hart' if 'N' in r_alle else 'FF_bedarf' if 'E' in r_alle else 'FF_park' if park else \
                      'OK_frei' if r_alle and all(r == 'P' for r in r_alle) else 'OFFEN'
            elif e == 'NICHT_ENTSCHEIDBAR':
                kat = 'NE_bestaet' if any(r in ('N', 'E') for r in r_alle) else \
                      'UN_krit' if krit and krit[0] == 'P' and not krit_park else 'OFFEN'
            else:
                kat = 'SP_bestaet' if any(r in ('N', 'E') for r in r_alle) else 'SP_fraglich' if 'P' in r_alle else 'OFFEN'
            ERG[(name, fall, P)] = kat
            zeilen.append(dict(variante=name, fall=fall, seg_id=sid, split=s['split'], schichten=s['schichten'], klasse=P, modell_breite=e,
                               modell_status=st, referenz=' '.join('{}:{}{}'.format(q, r or '-', '*' if pk else '') for q, _, r, pk in refs),
                               kategorie=kat, grund=(m[p + '_breite_v9_grund'] or '')[:160]))
with open(OUTP + '_faelle.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, list(zeilen[0]), delimiter=';'); w.writeheader(); w.writerows(zeilen)
txt = []
for split in ('E', 'V', 'alle'):
    txt.append('== Split {} =='.format(split))
    for name, _ in VAR:
        for P in 'ABCD':
            c = Counter(ERG[(name, fall, P)] for fall, s in schl.items() if split == 'alle' or s['split'] == split)
            txt.append('{:10s} {} {}'.format(name, P, ' '.join('{}={}'.format(k, c[k]) for k in
                       ('FF_hart', 'FF_bedarf', 'FF_park', 'OK_frei', 'UN_krit', 'NE_bestaet', 'SP_bestaet', 'SP_fraglich', 'OFFEN'))))
open(OUTP + '_zusammenfassung.txt', 'w', encoding='utf-8').write('\n'.join(txt) + '\n')
print('\n'.join(txt))
