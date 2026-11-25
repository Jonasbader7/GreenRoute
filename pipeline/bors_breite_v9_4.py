# -*- coding: utf-8 -*-
"""BORS V9.4 - Fahrkorridor je Fahrzeug (reines Python + numpy, ohne GDAL/QGIS). 10./11.11.2026.

Wird NACH bors_breite_v9_3.py per exec() geladen (nutzt dessen Parameter und Funktionen) von 25_Breite_V9_4_BORS.py,
26_Netzmaster_V9_2i_BORS.py und test_breite_v9_4.py.

Warum: V9.1-V9.3 vergleichen je Querprofil eine Breite mit dem Bedarf (robust: zweitkleinster Wert aus 3 Profilen) und
pruefen den Zusammenhang nur paarweise (Intervallueberlappung). Das beweist keinen durchgehenden Fahrweg: kurze Engstellen
fallen durch den Filter, ein Fahrbahnwechsel ohne Ueberlappung wurde uebersprungen, und die Fahrzeuglaenge spielte keine Rolle.

GEPRUEFTE BEWEGUNG (Modell "Korridor", genau das und nicht mehr):
  - Querlage u senkrecht zur geglaetteten OSM-Achse (Querprofile ohne Drehung, 1 m Abstand), Raster 0.025 m.
    Ist die Achse schief zur Fahrbahn (kleinste Breite bei gedrehtem Profil, Winkel w), wird u mit cos(w) gestaucht.
  - Fahrzeug = starres Rechteck (Laenge L, Karosserie K) parallel zur Achse; Spiegelebene getrennt (Breite S).
    An jeder Station muss der Karosseriestreifen [c - K/2 - rK, c + K/2 + rK] in der freien Flaeche fuer die Karosserie
    liegen UND der Spiegelstreifen [c - S/2 - rS, c + S/2 + rS] in der freien Flaeche fuer Spiegel - und zwar an allen
    Stationen, die das Fahrzeug gleichzeitig ueberdeckt (Fenster der Fahrzeuglaenge), immer an derselben Station.
  - Das starre Fahrzeug darf schraeg zur Achse liegen (Neigung 0, +-0.05, +-0.10 m/m, d. h. bis ca. 6 Grad) und seine
    Querlage um hoechstens 0.10 m je Meter aendern. Ein Seitenwechsel hinter einem Hindernis ist damit nur moeglich, wenn
    er mit der ganzen Fahrzeuglaenge in der freien Flaeche Platz hat.
  - Kurven der Achse: Zuschlag der Schleppkurve bei stationaerer Kreisfahrt (wie bors_schleppkurve):
    R_a = sqrt((R + K/2)^2 + (Radstand + Ueberhang vorne)^2), Zuschlag = R_a - (R - K/2) - K. Wird nur gemeldet, nie gesperrt.
  - NICHT geprueft: Abbiegen an Knoten (eigenes Modell 22_Abbiegen), Gegenverkehr, Rangieren, Bewegungen mit groesserem
    Lenkeinschlag als oben, Hoehe ueber 0 m ausser der Trennung Karosserie/Spiegel.
  - Freie Flaeche Karosserie = AV-Fahrbahn (Strasse/Weg; bei service auch uebrige befestigte), nur Fahrbahnstuecke, die die
    Achse beruehren oder hoechstens ACHSE_TOL_M daneben liegen (kein Ausweichen auf eine Parallelstrasse), minus feste
    Hindernisse (AV-Einzelobjekte, aus der Geometrie auf die Stationen projiziert, nicht nur wo ein Profil sie trifft),
    minus Baumsperrstreifen, minus Parkfelder im gewaehlten Szenario.
  - Freie Flaeche Spiegel = dieselbe; nur im Szenario SPIEGEL_NIEDRIG zusaetzlich angrenzende Trottoir-/Inselstreifen.
    Ob dort in Spiegelhoehe Raum frei ist (Kandelaber, Signale, Baeume), ist mit offenen Daten nicht belegt
    -> Spiegel ueber Trottoir/Insel ist ein eigenes Szenario und begruendet keine Freigabe.
  - Unsicherheit: Reserve = groesster Zuschlag delta, mit dem der Korridor noch besteht (Stufen DELTA_STUFEN), untere
    Schranke = delta - k_abschnitt * sigma_breite. k_abschnitt gilt fuer den ganzen Abschnitt (Sidak ueber m unabhaengige
    Randpunkte im engen Bereich): k = Phi^-1(0.95^(1/m)); m = Anzahl AV-Stuetzpunkte der Fahrbahnraender dort, wo die
    oertliche Reserve hoechstens 2 sigma ueber der engsten Stelle liegt. Absolute Lagefehler (beide Raender gleich
    verschoben) aendern den Korridor nicht und werden nicht abgezogen.
"""
import math
from statistics import NormalDist

import numpy as np

GITTER_M = 0.025
SCHRITT_ZELLEN = 4                       # 4 x 0.025 = 0.10 m Querverschiebung je 1 m Station (passt zur Fahrzeuglage +-0.10 m/m)
DELTA_STUFEN = np.round(np.concatenate([[-1.5, -1.0, -0.75], np.arange(-0.5, 1.0001, 0.05), [1.25, 1.5, 2.0]]), 2)   # Reserve-Stufen (m)
KNOTEN_M = 8.0                           # Abschnittsenden: Knotenbereich (wie RAND_M), hoechstens ein Viertel der Laenge
LUECKE_UEBERBRUECKEN_M = 3.0             # innere Messluecke bis 3 m: gerade Durchfahrt mit Lage vor UND nach der Luecke
P_ABSCHNITT = 0.95                       # Ziel: Wahrscheinlichkeit, dass der GANZE enge Bereich reicht
K_MAX = 3.29                             # Obergrenze k (m sehr gross)
SPIEGEL_NIEDRIG = {'Trottoir', 'Verkehrsinsel'}
VERTIKAL_HART = {'Gebäude', 'EO:Mauer', 'EO:Pfeiler', 'EO:Treppe', 'EO:Brunnen', 'EO:Sockel', 'EO:Mast', 'EO:Bauwerk', 'EO:Denkmal', 'EO:Fels'}
KORRIDOR_VERSION = 'V9.4 Korridor (Fenster Fahrzeuglaenge, 0.05 m/m Querverschiebung, Raster 0.025 m, Sidak je Abschnitt)'


def k_abschnitt(m, p=P_ABSCHNITT):
    """Einseitiges k, damit m unabhaengige Randpunkte gemeinsam mit Wahrscheinlichkeit p innerhalb der Schranke liegen."""
    m = max(1, int(m))
    return min(K_MAX, NormalDist().inv_cdf(p ** (1.0 / m)))


def kurven_zuschlag(R, K, radstand, ueberhang_vorne):
    """Mehrbreite der ueberstrichenen Flaeche bei Kreisfahrt (Hinterachsmitte auf Radius R) gegenueber Geradeausfahrt."""
    if R is None or not np.isfinite(R) or R > 400:
        return 0.0
    R = max(R, K / 2 + 0.5)
    ri = R - K / 2.0
    ra = math.hypot(R + K / 2.0, radstand + ueberhang_vorne)
    return max(0.0, ra - ri - K)


def radien(N, basis=4):
    """Kruemmungsradius der Achse je Station aus der Richtungsaenderung der Normalen ueber +-basis Stationen (1 m)."""
    n = len(N)
    R = np.full(n, np.inf)
    if n < 3:
        return R
    for i in range(n):
        a, b = max(0, i - basis), min(n - 1, i + basis)
        if b - a < 2:
            continue
        d = math.atan2(N[a, 0] * N[b, 1] - N[a, 1] * N[b, 0], N[a, 0] * N[b, 0] + N[a, 1] * N[b, 1])
        if abs(d) > 1e-6:
            R[i] = (b - a) / abs(d)
    return R


def gitter(halb):
    return np.arange(-halb, halb + 1e-9, GITTER_M)


def freiraum(intervalle_je_station, U):
    """Je Station Liste freier Intervalle (a, b) -> (n, G) Abstand der Zellmitte zum naeheren Intervallrand (m), -1 = nicht frei.
    Ein Streifen der Halbbreite h passt mit Mitte in Zelle k, wenn freiraum[k] >= h (exakt bis auf die Lage der Zellmitte:
    die Breite wird hoechstens um GITTER_M unterschaetzt)."""
    D = np.full((len(intervalle_je_station), len(U)), -1.0, dtype=np.float32)
    for i, ivs in enumerate(intervalle_je_station):
        for a, b in ivs:
            if b - a <= 1e-6:
                continue
            m = (U >= a) & (U <= b)
            if m.any():
                D[i, m] = np.maximum(D[i, m], np.minimum(U[m] - a, b - U[m]))
    return D


NEIGUNG_ZELLEN = (-4, -2, 0, 2, 4)          # Fahrzeuglage gegen die Achse: 0, +-0.05, +-0.10 m/m (Raster 0.025 m)


def _schiebe(D, z):
    """Spalten um z Zellen verschieben (Rand: nicht frei)."""
    if z == 0:
        return D
    out = np.full_like(D, -1.0)
    if z > 0:
        out[:, z:] = D[:, :-z]
    else:
        out[:, :z] = D[:, -z:]
    return out


def fenster_min(D, k, neigung=0):
    """Gleitendes Minimum ueber +-k Stationen entlang einer Geraden mit 'neigung' Zellen je Station: das starre Fahrzeug
    ueberdeckt diese Stationen gleichzeitig, schraeg zur Achse liegend (Station i+j -> Querlage + j*neigung)."""
    if k <= 0:
        return D.copy()
    n = D.shape[0]
    out = D.copy()
    for j in range(1, k + 1):
        if j >= n:
            break
        out[j:] = np.minimum(out[j:], _schiebe(D[:-j], j * neigung))
        out[:-j] = np.minimum(out[:-j], _schiebe(D[j:], -j * neigung))
    return out


def fenster_min_lagen(D, k):
    """Groesster Freiraum ueber alle zulaessigen Fahrzeuglagen (Neigungen) -> (n, G)."""
    return np.max([fenster_min(D, k, z) for z in NEIGUNG_ZELLEN], axis=0)


def korridor(FK, FS, aktiv, halb_k, halb_s, fenster_k, zuschlag=None, stufen=DELTA_STUFEN):
    """Fahrkorridor fuer alle Zuschlagsstufen gleichzeitig.
    FK, FS: (n, G) Freiraum (m) fuer Karosserie- bzw. Spiegelebene (freiraum()).
    aktiv: (n,) bool - Stationen, die geprueft werden (Knotenbereiche/ueberbrueckte Luecken vorher behandeln).
    halb_k, halb_s: Halbbreite Karosserie + Reserve bzw. Spiegel + Reserve (m). zuschlag: (n,) Kurvenzuschlag (m, Gesamtbreite).
    -> dict(ok[stufe], bruch[stufe] (erste Station ohne Fortsetzung, -1 = ok), leer[stufe] (an der Bruchstelle passt das
       Fahrzeug in keiner Querlage = Engstelle; sonst Seitenwechsel), reserve (groesste bestehende Stufe oder nan))"""
    n, G = FK.shape
    z = np.zeros(n) if zuschlag is None else np.asarray(zuschlag, float)
    aktiv = np.asarray(aktiv, bool)
    if (~aktiv).any():                                   # inaktive Stationen (Knoten, abgeleitet) stellen keine Bedingung
        FK, FS = FK.copy(), FS.copy()
        FK[~aktiv] = 99.0; FS[~aktiv] = 99.0
    sp = np.nonzero((FK[aktiv] >= 0).any(axis=0))[0] if aktiv.any() else np.zeros(0, int)   # nur Spalten mit Flaeche
    if len(sp) == 0:
        S = len(stufen)
        return dict(ok=np.zeros(S, bool), bruch=np.full(S, -1), leer=np.ones(S, bool), reserve=float('nan'), keine_station=not np.any(aktiv))
    FK, FS = FK[:, sp[0]:sp[-1] + 1], FS[:, sp[0]:sp[-1] + 1]
    wk, ws = fenster_min_lagen(FK, fenster_k), fenster_min_lagen(FS, fenster_k)
    zf = fenster_max(z, fenster_k)
    S = len(stufen)
    hk = halb_k + stufen[:, None] / 2.0 + zf[None, :] / 2.0          # (S, n) benoetigte Halbbreite (m)
    hs = halb_s + stufen[:, None] / 2.0 + zf[None, :] / 2.0
    ok = np.ones(S, bool); bruch = np.full(S, -1); leer = np.zeros(S, bool)
    reach = None
    for i in range(n):
        if not aktiv[i]:
            continue
        gueltig = (wk[i][None, :] >= hk[:, i][:, None]) & (ws[i][None, :] >= hs[:, i][:, None])      # (S, G)
        if reach is None:
            reach = gueltig
        else:
            d = reach.copy()
            for s_ in range(1, SCHRITT_ZELLEN + 1):
                d[:, s_:] |= reach[:, :-s_]; d[:, :-s_] |= reach[:, s_:]
            neu = d & gueltig
            tot = ~neu.any(axis=1) & ok
            if tot.any():
                bruch[tot] = i; leer[tot] = ~gueltig[tot].any(axis=1); ok[tot] = False
                neu[tot] = gueltig[tot]              # nach dem Bruch neu beginnen (weitere Stellen finden, Ergebnis bleibt nicht ok)
            reach = neu
        if reach is not None:
            tot = ~reach.any(axis=1) & ok
            if tot.any():
                bruch[tot] = i; leer[tot] = True; ok[tot] = False
    if reach is None:                               # keine aktive Station
        return dict(ok=np.zeros(S, bool), bruch=bruch, leer=leer, reserve=float('nan'), keine_station=True)
    gut = np.nonzero(ok)[0]
    return dict(ok=ok, bruch=bruch, leer=leer, reserve=float(stufen[gut].max()) if len(gut) else float('nan'), keine_station=False)


def fenster_max(z, k):
    out = np.asarray(z, float).copy()
    for j in range(1, k + 1):
        if j >= len(out):
            break
        out[j:] = np.maximum(out[j:], z[:-j]); out[:-j] = np.maximum(out[:-j], z[j:])
    return out


def engstellen_laeufe(FK, FS, aktiv, halb_k, halb_s, zuschlag=None, delta=0.0):
    """Stationen, an denen das Fahrzeug (ohne Fenster) in keiner Querlage Platz hat -> Liste (i0, i1) zusammenhaengend."""
    n, G = FK.shape
    z = np.zeros(n) if zuschlag is None else zuschlag
    hk = halb_k + delta / 2 + z / 2
    hs = halb_s + delta / 2 + z / 2
    eng = np.array([aktiv[i] and not ((FK[i] >= hk[i]) & (FS[i] >= hs[i])).any() for i in range(n)])
    return laeufe(eng)


def laeufe(b):
    out, i, n = [], 0, len(b)
    while i < n:
        if b[i]:
            j = i
            while j < n and b[j]:
                j += 1
            out.append((i, j - 1)); i = j
        else:
            i += 1
    return out


def projiziere_punkte(P, N0, X, Y, halb):
    """Punkte (X, Y) auf die naechste Station -> (station_index, u) ; Punkte weiter als halb+1 m quer oder hinter dem
    Abschnittsende (laengs > 0.75 m vom Profil) werden verworfen (index -1)."""
    X = np.asarray(X, float); Y = np.asarray(Y, float)
    if len(X) == 0 or len(P) == 0:
        return np.zeros(0, int), np.zeros(0)
    dx = X[None, :] - P[:, 0][:, None]; dy = Y[None, :] - P[:, 1][:, None]
    d2 = dx * dx + dy * dy
    i = np.argmin(d2, axis=0)
    j = np.arange(len(X))
    u = dx[i, j] * N0[i, 0] + dy[i, j] * N0[i, 1]
    laengs = -dx[i, j] * N0[i, 1] + dy[i, j] * N0[i, 0]
    i = np.where((np.abs(u) <= halb + 1.0) & (np.abs(laengs) <= 0.75), i, -1)
    return i, u


def verdichte_ringe(ringe_xy, schritt=0.25):
    """Kanten (x0,y0,x1,y1) -> Punkte alle 'schritt' m (inkl. Endpunkte)."""
    xs, ys = [], []
    for x0, y0, x1, y1 in ringe_xy:
        L = math.hypot(x1 - x0, y1 - y0)
        k = max(1, int(math.ceil(L / schritt)))
        t = np.linspace(0.0, 1.0, k + 1)
        xs.append(x0 + t * (x1 - x0)); ys.append(y0 + t * (y1 - y0))
    if not xs:
        return np.zeros(0), np.zeros(0)
    return np.concatenate(xs), np.concatenate(ys)


def _f(m, k):
    v = m.get(k)
    return None if v in (None, '') else float(v)


def ereignis_text(ereig, klasse, typ=None, max_n=2):
    """ereig: Liste (klasse, typ, von, bis, breite) eines Abschnitts -> kurzer Text mit Lage und Laenge."""
    z = [e for e in ereig if e[0] in (klasse, '-') and (typ is None or e[1] == typ)]
    t = ['{} {:.0f}-{:.0f} m ({:.0f} m{})'.format('Engstelle' if e[1] == 'ENGSTELLE' else 'Messluecke' if e[1] == 'MESSLUECKE' else e[1].lower(),
                                                 e[2], e[3], e[3] - e[2], ', frei {:.2f} m'.format(e[4]) if e[4] is not None else '') for e in z[:max_n]]
    return '; '.join(t) + (' (+{} weitere)'.format(len(z) - max_n) if len(z) > max_n else '')


def entscheid_v9_4(e, gr, m, p, ereig=(), laenge=None):
    """V9.4: Breitenentscheid einer Klasse mit dem Fahrkorridor (fuer 26_Netzmaster_V9_2i). -> (e, gr, beleg_hinweis, wirkung)
    e/gr = Entscheid nach V9.2g (Schranken je Abschnitt). Regeln:
      - UNZUREICHEND bleibt (Sperre nur aus der robusten Messung V9.1 mit harten Raendern, nie aus dem Korridor).
      - AUSREICHEND nur, wenn der Korridor mit Parkfeldern belegt, ohne Spiegel ueber Trottoir/Insel und nach Abzug von
        k_abschnitt * sigma besteht (<p>_k_untere_m >= 0). Sonst NICHT_ENTSCHEIDBAR mit Ursache, Station und Laenge.
      - NICHT_ENTSCHEIDBAR -> AUSREICHEND, wenn der Korridor besteht (z. B. Bruecke ueber Bauwerk abgeleitet, Messluecke
        geometrisch ueberbrueckt, Messung zuvor auf der falschen Fahrbahn); Grund nennt den alten Grund ('gelockert').
      - Alte Breitendatei ohne Korridorfelder -> unveraendert.
    beleg_hinweis = 'ABGELEITET', wenn die Freigabe auf Bauwerksbreite (Bruecke/Tunnel) beruht."""
    if (p + '_k_untere_m') not in m or not m.get(p + '_k_ursache'):
        return e, gr, None, 'ohne Korridor'
    if e == 'UNZUREICHEND':
        return e, gr, None, 'Sperre bleibt'
    urs = m.get(p + '_k_ursache') or ''
    if urs == 'KNOTEN':
        return e, gr, None, 'nur Knotenbereich'
    u, r, st = _f(m, p + '_k_untere_m'), _f(m, p + '_k_reserve_m'), _f(m, p + '_k_station_m')
    abg = (_f(m, 'k_bauwerk_abgeleitet_m') or 0) > 0
    beleg = 'ABGELEITET' if abg else None
    zus = ' (Breite auf Bruecke/im Tunnel aus AV-Bauwerk - 3.0 m abgeleitet)' if abg else ''
    if u is not None and u >= 0:
        txt = 'Fahrkorridor nachgewiesen: Reserve {:.2f} m, nach Abzug Messunsicherheit {:.2f} m (k={}, {} Randpunkte){}'.format(
            r, u, m.get(p + '_k_k'), m.get(p + '_k_m'), zus)
        if e == 'AUSREICHEND':
            return 'AUSREICHEND', txt + '; ' + gr[:120], beleg, 'bestaetigt'
        return 'AUSREICHEND', txt + '; gelockert, vorher: ' + gr[:120], beleg, 'gelockert'
    # Korridor nicht nachgewiesen -> Ursache
    lr, sp, ok_ = _f(m, p + '_k_leer_reserve_m'), _f(m, p + '_k_spiegel_niedrig_reserve_m'), _f(m, p + '_k_ohne_kurve_reserve_m')
    lage = ereignis_text(ereig, p.upper()) if ereig else ''
    if r is not None and r >= 0:
        t = ('Reserve {:.2f} m an Station {:.0f} m liegt innerhalb der Messunsicherheit des engen Bereichs (k={}, {} Randpunkte, '
             'sigma {:.2f} m)').format(r, st, m.get(p + '_k_k'), m.get(p + '_k_m'), _f(m, p + '_k_sigma_m') or 0)
    elif lr is not None and lr >= 0:
        t = 'nur bei freien Parkfeldern passierbar (mit belegten Parkfeldern kein Korridor, Station {:.0f} m)'.format(st)
    elif sp is not None and sp >= 0:
        t = 'nur mit Spiegel ueber Trottoir/Insel passierbar (Station {:.0f} m); freier Raum in Spiegelhoehe nicht belegt'.format(st)
    elif ok_ is not None and ok_ >= 0:
        t = 'Kurve bei Station {:.0f} m: mit Schleppkurven-Zuschlag kein Korridor - Kurve vor Ort/Orthofoto pruefen'.format(st)
    elif urs == 'SCHIKANE':
        t = ('wechselseitige Hindernisse/Parkfelder bei Station {:.0f} m: das Fahrzeug passt an jeder Stelle einzeln, eine Durchfahrt '
             'mit der ganzen Fahrzeuglaenge ist im Korridormodell nicht nachgewiesen (Schleppkurve/vor Ort pruefen)').format(st)
    elif urs == 'SEITENWECHSEL':
        t = 'durchgehender Fahrkorridor nicht nachgewiesen bei Station {:.0f} m (freier Raum/Fahrbahn wechselt die Seite)'.format(st)
    elif urs == 'MESSLUECKE':
        t = 'Messluecke ohne Fahrbahnflaeche bei Station {:.0f} m'.format(st)
    else:
        t = 'Engstelle bei Station {:.0f} m: Fahrzeug passt dort in keiner Querlage{}'.format(
            st, ' (Reserve {:.2f} m)'.format(r) if r is not None else '')
    if lage:
        t += ' [' + lage + ']'
    if laenge:
        t += ' (Abschnitt {:.0f} m)'.format(laenge)
    if e == 'AUSREICHEND':
        return 'NICHT_ENTSCHEIDBAR', 'Korridor: ' + t, None, 'herabgestuft'
    return 'NICHT_ENTSCHEIDBAR', 'Korridor: ' + t + ' | vorher: ' + gr[:100], None, 'bleibt'
