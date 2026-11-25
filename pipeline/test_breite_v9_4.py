# -*- coding: utf-8 -*-
"""Regressionstests bors_breite_v9_4.py (Fahrkorridor) - normales Python + numpy, keine Rohdaten.
    python test_breite_v9_4.py      -> je Pruefung PASS / FAIL, Exit-Code 1 bei FAIL
Geprueft: gerade Strasse, kurze Engstelle (kein Medianfilter), Seitenwechsel mit/ohne Platz, Fahrzeuglaenge (Slalom),
getrennte Fahrbahnen/Fahrbahnwechsel, Messluecke, Knotenbereich, Parkierung belegt/frei, Karosserie- und Spiegelebene,
Kurvenzuschlag, Sidak-k, Invarianten (groesseres Fahrzeug nie guenstiger), Entscheidregel (nie Sperre, nie Sperre aufheben)."""
import random
import sys
from pathlib import Path

import numpy as np

HIER = Path(__file__).resolve().parent
ns = {}
exec(compile((HIER / 'bors_breite_v9_3.py').read_text(encoding='utf-8'), 'bors_breite_v9_3.py', 'exec'), ns)
exec(compile((HIER / 'bors_breite_v9_4.py').read_text(encoding='utf-8'), 'bors_breite_v9_4.py', 'exec'), ns)
ERG = []
U = ns['gitter'](20.0)
fr, kor, lauf_eng = ns['freiraum'], ns['korridor'], ns['engstellen_laeufe']


def pruefe(name, ok, info=''):
    ERG.append(bool(ok))
    print('{} {}{}'.format('PASS' if ok else 'FAIL', name, '  ' + str(info) if not ok else ''))


def res(F, halb_k=1.53, halb_s=None, L=10.0, aktiv=None, FS=None, z=None):
    n = len(F)
    D = fr(F, U)
    DS = D if FS is None else fr(FS, U)
    a = np.ones(n, bool) if aktiv is None else np.asarray(aktiv, bool)
    return kor(D, DS, a, halb_k, halb_k if halb_s is None else halb_s, int(np.ceil(L / 2)), z)


# 1 gerade Strasse 4.0 m, Fahrzeug 2.56 + 2 x 0.25 = 3.06 -> Reserve 0.94 -> groesste Stufe <= 0.94 ist 0.9
r = res([[(-2.0, 2.0)]] * 40)
pruefe('gerade 4.0 m: Korridor besteht, Reserve-Stufe 0.9 (Stufen 0.05 m)', r['ok'][list(ns['DELTA_STUFEN']).index(0.0)] and abs(r['reserve'] - 0.9) < 1e-9, r['reserve'])
r = res([[(-1.5, 1.5)]] * 40)
pruefe('gerade 3.0 m: kein Korridor fuer 3.06 m (Reserve -0.1)', r['reserve'] == -0.1, r['reserve'])
# 2 kurze Engstelle: eine Station 2.9 m in 4 m Strasse -> darf nicht weggefiltert werden
F = [[(-2.0, 2.0)]] * 20 + [[(-1.45, 1.45)]] + [[(-2.0, 2.0)]] * 19
r = res(F)
pruefe('kurze Engstelle (1 Station) wird nicht gemittelt', r['reserve'] < 0, r['reserve'])
pruefe('Engstelle als Lauf mit Lage gemeldet', lauf_eng(fr(F, U), fr(F, U), np.ones(40, bool), 1.53, 1.53) == [(20, 20)])
# 3 Pfeiler mitten in 8 m Strasse: zwei Gassen je 3.8 m -> Fahrzeug faehrt in einer Gasse
F = [[(-4.0, 4.0)]] * 15 + [[(-4.0, -0.2), (0.2, 4.0)]] * 3 + [[(-4.0, 4.0)]] * 22
pruefe('Pfeiler in der Mitte: Gasse 3.8 m reicht', res(F)['reserve'] >= 0.5, res(F)['reserve'])
# 4 Seitenwechsel ohne Platz: links frei bis Station 20, dann nur rechts, Ueberlappung 1 m
F = [[(-3.5, 0.5)]] * 20 + [[(-0.5, 3.5)]] * 20
pruefe('Seitenwechsel ohne gemeinsamen Raum -> kein Korridor', not res(F)['ok'][list(ns['DELTA_STUFEN']).index(0.0)])
r = res(F)
i0 = list(ns['DELTA_STUFEN']).index(0.0)
pruefe('Seitenwechsel: Ursache nicht Engstelle (Fahrzeug passt je Station)', r['leer'][i0] == False or r['bruch'][i0] >= 0, (r['bruch'][i0], r['leer'][i0]))
# 5 allmaehlicher Versatz 0.04 m/m in 3.5 m breiter Gasse -> faehrt mit
F = [[(-1.75 + 0.04 * i, 1.75 + 0.04 * i)] for i in range(60)]
pruefe('schraege Gasse 0.04 m/m (Achse schief): Korridor mit voller Reserve 0.4', res(F, L=7.0)['reserve'] >= 0.3, res(F, L=7.0)['reserve'])
F = [[(-1.75 + 0.3 * i, 1.75 + 0.3 * i)] for i in range(30)]
pruefe('Versatz 0.3 m/m (mehr als 6 Grad gegen die Achse): kein Korridor bei Stufe 0', not res(F, L=7.0)['ok'][i0])
F = [[(-1.75, 1.75)]] * 15 + [[(-1.75 + 1.0, 1.75 + 1.0)]] * 15
pruefe('Sprung 1 m auf 1 m Laenge (Kante, kein Platz zum Versetzen): kein Korridor fuer 3.06 m', not res(F, L=7.0)['ok'][i0])
# 6 Fahrzeuglaenge: Slalom (Hindernisse wechselseitig alle 4 m) - kurzes Fahrzeug ja, langes nein
F = []
for i in range(48):
    F.append([(-2.2, 1.0)] if (i // 4) % 2 == 0 else [(-1.0, 2.2)])
rk = res(F, halb_k=0.97 + 0.15, L=2.0)      # Personenwagen kurz
rl = res(F, halb_k=1.28 + 0.25, L=10.0)     # Drehleiter lang
pruefe('Slalom: kurzes Fahrzeug Reserve > langes Fahrzeug', (rk['reserve'] if rk['reserve'] == rk['reserve'] else -9) > (rl['reserve'] if rl['reserve'] == rl['reserve'] else -9), (rk['reserve'], rl['reserve']))
# 7 getrennte Fahrbahnen (Achse auf Mittelinsel): beidseits 3.5 m, durchgehend -> besteht in einer Fahrbahn
F = [[(-4.5, -1.0), (1.0, 4.5)]] * 40
pruefe('getrennte Fahrbahnen 3.5 m: Korridor in einer Fahrbahn', res(F)['reserve'] >= 0.3, res(F)['reserve'])
# Fahrbahn wechselt die Seite (nur jeweils eine vorhanden, keine Verbindung) -> kein Korridor
F = [[(-4.5, -1.0)]] * 20 + [[(1.0, 4.5)]] * 20
pruefe('Fahrbahnwechsel ohne Verbindung: kein Korridor (nicht uebersprungen)', not res(F)['ok'][i0])
# 8 Messluecke (keine Fahrbahn) im aktiven Bereich -> kein Korridor; im Knotenbereich (inaktiv) -> besteht
F = [[(-2.0, 2.0)]] * 15 + [[]] * 5 + [[(-2.0, 2.0)]] * 20
pruefe('Messluecke aktiv: kein Korridor', not res(F)['ok'][i0])
akt = [True] * 15 + [False] * 5 + [True] * 20
pruefe('Luecke als Knoten markiert (inaktiv): Korridor besteht', res(F, aktiv=akt)['ok'][i0])
r = res([[]] * 10, aktiv=[False] * 10)
pruefe('nur Knotenbereich: keine Aussage (nicht ok)', r.get('keine_station') and not r['ok'].any())
# 9 Parkierung: frei 4.5 m, belegt 2.5 m -> D belegt nein, frei ja
Fleer = [[(-2.25, 2.25)]] * 30
Fbel = [[(-0.25, 2.25)]] * 30
pruefe('Parkfelder belegt: kein Korridor fuer D', not res(Fbel)['ok'][i0])
pruefe('Parkfelder frei: Korridor fuer D', res(Fleer)['ok'][i0])
# 10 Karosserie vs Spiegel: Karosserie 2.56 + 0.5 = 3.06 passt in 3.2 m, Spiegel 3.06 + 0.2 = 3.26 nicht
FK = [[(-1.6, 1.6)]] * 30
pruefe('Spiegel passt nicht (gleicher Raum): kein Korridor', not res(FK, halb_k=1.53, halb_s=1.63)['ok'][i0])
FS = [[(-1.85, 1.85)]] * 30                     # Spiegelraum ueber Trottoir +0.25 je Seite
pruefe('Spiegelraum ueber Trottoir: Korridor (eigenes Szenario)', res(FK, halb_k=1.53, halb_s=1.63, FS=FS)['ok'][i0])
FS2 = [[(-1.85, 1.85)]] * 14 + [[(-1.6, 1.6)]] + [[(-1.85, 1.85)]] * 15     # Mast am Rand an einer Station
pruefe('Spiegel und Karosserie an derselben Station geprueft (Mast)', not res(FK, halb_k=1.53, halb_s=1.63, FS=FS2)['ok'][i0])
# 11 Kurvenzuschlag
kz = ns['kurven_zuschlag']
pruefe('Kurvenzuschlag gerade = 0', kz(float('inf'), 2.56, 4.9, 1.5) == 0.0)
pruefe('Kurvenzuschlag waechst bei kleinerem Radius', kz(15, 2.56, 4.9, 1.5) > kz(30, 2.56, 4.9, 1.5) > kz(100, 2.56, 4.9, 1.5) > 0)
pruefe('Kurvenzuschlag waechst mit Radstand', kz(20, 2.5, 4.5, 1.6) > kz(20, 2.5, 3.8, 1.25))
z = np.array([0.0] * 10 + [1.0] * 10 + [0.0] * 10)
pruefe('Kurvenzuschlag kann Korridor verhindern', res([[(-2.0, 2.0)]] * 30)['ok'][i0] and not res([[(-2.0, 2.0)]] * 30, z=z)['ok'][i0])
# 12 Sidak
ka = ns['k_abschnitt']
pruefe('k_abschnitt(1) = 1.645', abs(ka(1) - 1.645) < 0.001, ka(1))
pruefe('k_abschnitt monoton und begrenzt', ka(1) < ka(5) < ka(50) <= ns['K_MAX'], (ka(5), ka(50)))
# 13 Invariante: groesseres Fahrzeug (Breite, Spiegel, Laenge, Kurvenzuschlag) nie guenstiger - 300 Zufallsfaelle
rng = random.Random(20261111)
verstoss = 0
for _ in range(300):
    n = rng.randint(8, 40)
    F = []
    for i in range(n):
        a = rng.uniform(-4, -0.5); b = rng.uniform(0.5, 4)
        st = [(a, b)]
        if rng.random() < 0.3:
            m = rng.uniform(a, b); st = [(a, m - 0.2), (m + 0.2, b)]
        if rng.random() < 0.05:
            st = []
        F.append(st)
    hk = rng.uniform(0.9, 1.4); L = rng.uniform(4, 11)
    zz = np.array([rng.choice([0.0, 0.0, 0.3]) for _ in range(n)])
    r1 = res(F, halb_k=hk, L=L, z=zz)['reserve']
    r2 = res(F, halb_k=hk + rng.uniform(0, 0.4), halb_s=hk + rng.uniform(0.0, 0.6), L=L + rng.uniform(0, 4), z=zz * 1.5)['reserve']
    v1 = -99 if r1 != r1 else r1; v2 = -99 if r2 != r2 else r2
    if v2 > v1 + 1e-9:
        verstoss += 1
pruefe('Invariante 300 Faelle: groesseres Fahrzeug nie hoehere Reserve', verstoss == 0, verstoss)
# Invariante: zusaetzliches Hindernis nie guenstiger
verstoss = 0
for _ in range(200):
    n = rng.randint(8, 30)
    F = [[(rng.uniform(-4, -1), rng.uniform(1, 4))] for _ in range(n)]
    G = [list(x) for x in F]
    j = rng.randrange(n); a, b = G[j][0]; m = rng.uniform(a, b)
    G[j] = [(a, m - 0.3), (m + 0.3, b)]
    r1, r2 = res(F)['reserve'], res(G)['reserve']
    if (-99 if r2 != r2 else r2) > (-99 if r1 != r1 else r1) + 1e-9:
        verstoss += 1
pruefe('Invariante 200 Faelle: zusaetzliches Hindernis nie guenstiger', verstoss == 0, verstoss)
# 14 Entscheidregel
ent = ns['entscheid_v9_4']
m = dict(a_k_untere_m=0.3, a_k_reserve_m=0.5, a_k_station_m=10.0, a_k_ursache='OK', a_k_k=2.0, a_k_m=3, a_k_sigma_m=0.14,
         a_k_leer_reserve_m=None, a_k_spiegel_niedrig_reserve_m=None, a_k_ohne_kurve_reserve_m=None, k_bauwerk_abgeleitet_m=0)
pruefe('Entscheid: UNZUREICHEND bleibt, auch wenn Korridor besteht', ent('UNZUREICHEND', 'x', m, 'a')[0] == 'UNZUREICHEND')
pruefe('Entscheid: ohne Korridorfelder unveraendert', ent('AUSREICHEND', 'x', {'untere_schranke_m': 3}, 'a')[:2] == ('AUSREICHEND', 'x'))
e, g, b, w = ent('NICHT_ENTSCHEIDBAR', 'alt', m, 'a')
pruefe('Entscheid: NE -> AUSREICHEND bei Korridor (gelockert, alter Grund genannt)', e == 'AUSREICHEND' and w == 'gelockert' and 'alt' in g, (e, w))
m2 = dict(m, a_k_untere_m=-0.1, a_k_reserve_m=0.1)
e, g, b, w = ent('AUSREICHEND', 'alt', m2, 'a')
pruefe('Entscheid: Reserve in der Messunsicherheit -> NE', e == 'NICHT_ENTSCHEIDBAR' and 'Messunsicherheit' in g, g)
m3 = dict(m, a_k_untere_m=-0.6, a_k_reserve_m=-0.4, a_k_leer_reserve_m=0.5)
pruefe('Entscheid: nur bei freien Parkfeldern -> NE mit Szenario', 'freien Parkfeldern' in ent('AUSREICHEND', 'x', m3, 'a')[1])
m4 = dict(m, a_k_untere_m=-0.6, a_k_reserve_m=-0.2, a_k_spiegel_niedrig_reserve_m=0.1)
pruefe('Entscheid: Spiegel ueber Trottoir begruendet keine Freigabe', ent('AUSREICHEND', 'x', m4, 'a')[0] == 'NICHT_ENTSCHEIDBAR')
m5 = dict(m, k_bauwerk_abgeleitet_m=40)
pruefe('Entscheid: Bruecke ueber Bauwerk -> Beleg ABGELEITET', ent('NICHT_ENTSCHEIDBAR', 'x', m5, 'a')[2] == 'ABGELEITET')
e, g, b, w = ent('AUSREICHEND', 'x', dict(m, a_k_untere_m=None, a_k_reserve_m=None, a_k_ursache='MESSLUECKE'), 'a',
                 [('-', 'MESSLUECKE', 40.0, 52.0, None)], 300.0)
pruefe('Entscheid: Messluecke mit Lage und Laenge im Grund', e == 'NICHT_ENTSCHEIDBAR' and '40-52 m (12 m' in g and 'Abschnitt 300 m' in g, g)
print('{} PASS / {} FAIL'.format(sum(ERG), len(ERG) - sum(ERG)))
sys.exit(0 if all(ERG) else 1)
