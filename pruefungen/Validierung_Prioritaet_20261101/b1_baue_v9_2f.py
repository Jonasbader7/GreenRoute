# Erzeugt 26_Netzmaster_V9_2f_BORS.py aus 26_Netzmaster_V9_2d_BORS.py (jede Ersetzung muss genau einmal passen)
import sys
from pathlib import Path
A = Path(sys.argv[1])
src = (A / '26_Netzmaster_V9_2d_BORS.py').read_text(encoding='utf-8')
ziel = A / '26_Netzmaster_V9_2f_BORS.py'
assert not ziel.exists(), 'existiert schon'


def ers(alt, neu):
    global src
    assert src.count(alt) == 1, (src.count(alt), alt[:80])
    src = src.replace(alt, neu)


ers('''"""BORS 26 (V9.2d_BORS, 29.10.2026): Logik identisch mit 26_Netzmaster_V9_2d.py, nur die Pfade kommen aus der Ablage BORS
  (Quelle/Ausgabe 02_Daten/2_Aktuell_V9, Hinderniskartei 02_Daten/1_Rohdaten/Kanton_Bern, Hilfsmodule 01_Skripte/Aktuell).
STARTEN (QGIS-Python-Konsole, Ablage BORS):
    from pathlib import Path
    p = Path.home() / 'OneDrive' / 'Desktop' / 'BORS' / '01_Skripte' / 'Aktuell' / '26_Netzmaster_V9_2d_BORS.py'
    exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'))
''', '''"""BORS 26 (V9.2f_BORS, 1.11.2026): wie V9.2d_BORS, zusaetzlich geprueft Befunde aus 02_Daten/2_Aktuell_V9/BORS_Befunde.csv.
STARTEN (QGIS-Python-Konsole, Ablage BORS):
    from pathlib import Path
    p = Path.home() / 'OneDrive' / 'Desktop' / 'BORS' / '01_Skripte' / 'Aktuell' / '26_Netzmaster_V9_2f_BORS.py'
    exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'))
Ohne Datei oder mit leerer Datei ist das Ergebnis Feld fuer Feld gleich wie V9.2d (neue Spalten <p>_v9_befund leer).
BORS_Befunde.csv (Semikolon, UTF-8), eine Zeile je Abschnitt und Kriterium:
  seg_id      z.B. w296489152
  klassen     Fahrzeugklassen, fuer die der Befund gilt, z.B. ABCD oder CD
  kriterium   BREITE | HOEHE | GEWICHT | HINDERNIS
  befund      PASSIERBAR | NICHT_PASSIERBAR
  messwert    BREITE: engste freie Breite Randstein-Randstein in m; HOEHE: lichte Hoehe in m (beide Pflicht bei PASSIERBAR);
              GEWICHT: belegte Tragfaehigkeit in t (freiwillig); HINDERNIS: leer
  methode     FELD (vor Ort gemessen) | ORTHOFOTO (am Bildschirm gemessen) | FACHSTELLE (schriftliche Auskunft)
  beleg       Foto, Dokument oder Quelle;  geprueft_von;  datum (JJJJ-MM-TT);  bemerkung (frei)
Regeln:
  - PASSIERBAR hebt nur die Gruende "ungeklaert/nicht entscheidbar" dieses Kriteriums auf. VALIDIERT wird ein Abschnitt
    erst, wenn alle Gruende aufgehoben sind. Eine Sperre (GESPERRT) hebt ein Befund nie auf, der Widerspruch steht im Protokoll.
  - BREITE: Messwert >= Bedarf der Klasse (wie Breitenentscheid V9.2). Bei ORTHOFOTO zusaetzlich + ORTHO_MARGE_M (Annahme
    0.50 m: Lage der beiden Raender je ca. +-0.25 m auf SWISSIMAGE 10 cm). Sonst wird der Befund fuer diese Klasse abgelehnt.
  - HOEHE: Messwert >= Fahrzeughoehe + HOEHE_RESERVE (0.10 m). GEWICHT mit Messwert: Messwert >= Fahrzeuggewicht.
  - NICHT_PASSIERBAR sperrt den Abschnitt fuer die genannten Klassen.
  - Ungueltige Zeilen (Pflichtfeld leer, unbekannter Wert, unbekannte seg_id) werden nicht angewendet und im Bericht gemeldet.
  - Herkunft bleibt sichtbar: <p>_breite_v9_beleg = FELD | ORTHOFOTO | FACHSTELLE, Text in <p>_v9_grund und <p>_v9_befund.
Ausgabe zusaetzlich: <Netzmaster>_Befunde_Protokoll.csv (je Befund und Klasse: uebernommen / abgelehnt / ohne Wirkung).
BORS 26 (V9.2d_BORS, 29.10.2026): Logik identisch mit 26_Netzmaster_V9_2d.py, nur die Pfade kommen aus der Ablage BORS
  (Quelle/Ausgabe 02_Daten/2_Aktuell_V9, Hinderniskartei 02_Daten/1_Rohdaten/Kanton_Bern, Hilfsmodule 01_Skripte/Aktuell).
''')

ers('''HK_GLEICHER_NAME_M, HK_ANDERER_NAME_M = 40.0, 15.0     # V9.2d: Zuordnung Hinderniskartei -> Abschnitt
''', '''HK_GLEICHER_NAME_M, HK_ANDERER_NAME_M = 40.0, 15.0     # V9.2d: Zuordnung Hinderniskartei -> Abschnitt
ORTHO_MARGE_M = 0.50                                    # V9.2f: Zuschlag Breite bei Messung auf dem Orthofoto (Annahme)
BEFUND_KRIT = ('BREITE', 'HOEHE', 'GEWICHT', 'HINDERNIS')
BEFUND_ART = ('PASSIERBAR', 'NICHT_PASSIERBAR')
BEFUND_METHODE = ('FELD', 'ORTHOFOTO', 'FACHSTELLE')
''')

ers('''log('Quelle {} + {} + {} -> {}'.format(SRC.name, BR.name, HKD.name, OUT.name))
''', '''BEF = P_AKTUELL / 'BORS_Befunde.csv'
log('Quelle {} + {} + {} -> {}'.format(SRC.name, BR.name, HKD.name, OUT.name))
''')

# Befunde einlesen und pruefen (nach dem Lesen des Netzes, vor der Bewertung)
ers('''V8K = defaultdict(dict)
''', '''# V9.2f: gepruefte Befunde einlesen und auf Vollstaendigkeit pruefen
BEFUNDE = defaultdict(list)
bef_fehler = []
_alle_sid = {r[0] for r in db.execute('select seg_id from netz_v5 where ist_routingtyp = 1')}
if BEF.exists():
    with open(str(BEF), encoding='utf-8-sig', newline='') as fh:
        for nr, z in enumerate(csv.DictReader(fh, delimiter=';'), 2):
            z = {k.strip().lower(): (v or '').strip() for k, v in z.items() if k}
            if not any(z.values()):
                continue
            sid, kl, kr_, bf, mw, me = (z.get(k, '') for k in ('seg_id', 'klassen', 'kriterium', 'befund', 'messwert', 'methode'))
            kl, kr_, bf, me = kl.upper().replace(' ', '').replace(',', ''), kr_.upper(), bf.upper(), me.upper()
            try:
                mwf = float(mw.replace(',', '.')) if mw else None
            except ValueError:
                mwf = 'x'
            fehler = []
            if sid not in _alle_sid:
                fehler.append('seg_id unbekannt')
            if not kl or set(kl) - set('ABCD'):
                fehler.append('klassen nicht aus ABCD')
            if kr_ not in BEFUND_KRIT:
                fehler.append('kriterium nicht ' + '/'.join(BEFUND_KRIT))
            if bf not in BEFUND_ART:
                fehler.append('befund nicht ' + '/'.join(BEFUND_ART))
            if me not in BEFUND_METHODE:
                fehler.append('methode nicht ' + '/'.join(BEFUND_METHODE))
            if mwf == 'x':
                fehler.append('messwert keine Zahl')
            elif bf == 'PASSIERBAR' and kr_ in ('BREITE', 'HOEHE') and mwf is None:
                fehler.append('messwert fehlt (Pflicht bei {} PASSIERBAR)'.format(kr_))
            if not z.get('geprueft_von'):
                fehler.append('geprueft_von fehlt')
            try:
                datetime.strptime(z.get('datum', ''), '%Y-%m-%d')
            except ValueError:
                fehler.append('datum nicht JJJJ-MM-TT')
            if fehler:
                bef_fehler.append('Zeile {} ({}): {}'.format(nr, sid or '-', ', '.join(fehler)))
                continue
            BEFUNDE[sid].append(dict(klassen=kl, krit=kr_, befund=bf, wert=mwf, methode=me, beleg=z.get('beleg', ''),
                                     von=z['geprueft_von'], datum=z['datum'], bem=z.get('bemerkung', '')))
log('Befunde {}: {} gueltig, {} ungueltig'.format(BEF.name if BEF.exists() else '(keine Datei)', sum(len(v) for v in BEFUNDE.values()), len(bef_fehler)))
for t in bef_fehler:
    log('  NICHT ANGEWENDET ' + t)


def kriterium_von(grund):
    """V9.2f: Kriterium und Stufe eines Grundes (Texte wie oben erzeugt)."""
    for pref, kr_, stufe in (('Breite nicht entscheidbar', 'BREITE', 1), ('Breite:', 'BREITE', 2),
                             ('Gewicht ungeklaert', 'GEWICHT', 1), ('Gewicht:', 'GEWICHT', 2),
                             ('Hoehe ungeklaert', 'HOEHE', 1), ('Hoehe knapp', 'HOEHE', 1), ('Hoehe:', 'HOEHE', 2),
                             ('Hindernis ungeklaert', 'HINDERNIS', 1), ('Hindernis:', 'HINDERNIS', 2),
                             ('Freigabe/Sperre R2', 'SPERRE', 2), ('Befund ', 'BEFUND', 2)):
        if grund.startswith(pref):
            return kr_, stufe
    raise ValueError('Grund ohne Kriterium: ' + grund[:60])


STUFE = ('VALIDIERT', 'UNVALIDIERT', 'GESPERRT')
bef_prot, bef_wechsel, bef_wechsel_liste = [], Counter(), []

V8K = defaultdict(dict)
''')

ers('''            '{}_v9_status TEXT'.format(p), '{}_v9_grund TEXT'.format(p)]
''', '''            '{}_v9_status TEXT'.format(p), '{}_v9_grund TEXT'.format(p), '{}_v9_befund TEXT'.format(p)]
''')

ers('''        if st is not None and GEWICHT[P] > STEIGUNG_T:
''', '''        # V9.2f: gepruefte Befunde. Selbstkontrolle: Status = hoechste Stufe der Gruende (muss vor den Befunden stimmen)
        stufen = [kriterium_von(x) for x in gruende]
        assert STUFE[max([s for _, s in stufen] or [0])] == status, (sid, P, status, gruende)
        bef_txt, vor_bef = [], status
        bedarf = (bed if bed else max(MASSE[P]['breite_karosserie_m'] + 2 * RESERVE[P], MASSE[P]['breite_spiegel_m'] + 2 * RES_SPIEGEL))
        for b in BEFUNDE.get(sid, ()):
            if P not in b['klassen']:
                continue
            kurz = '{} {} ({}, {}, {}{})'.format(b['krit'].capitalize(), b['befund'].lower().replace('_', ' '), b['methode'].lower(), b['datum'], b['von'],
                                                 ', ' + b['beleg'][:40] if b['beleg'] else '')
            ergebnis = ''
            if b['befund'] == 'NICHT_PASSIERBAR':
                gruende.append('Befund ' + kurz + (': ' + b['bem'][:60] if b['bem'] else ''))
                if b['krit'] == 'BREITE':
                    e, beleg = 'UNZUREICHEND', b['methode']
                ergebnis = 'uebernommen (gesperrt)'
            else:
                if b['krit'] == 'BREITE':
                    noetig = bedarf + (ORTHO_MARGE_M if b['methode'] == 'ORTHOFOTO' else 0.0)
                    if b['wert'] < noetig - 1e-9:
                        ergebnis = 'abgelehnt: {:.2f} m < noetig {:.2f} m (Bedarf {:.2f} m{})'.format(
                            b['wert'], noetig, bedarf, ' + Orthofoto-Zuschlag {:.2f} m'.format(ORTHO_MARGE_M) if b['methode'] == 'ORTHOFOTO' else '')
                elif b['krit'] == 'HOEHE' and b['wert'] < MASSE[P]['hoehe_m'] + HOEHE_RESERVE - 1e-9:
                    ergebnis = 'abgelehnt: {:.2f} m < Fahrzeughoehe {:.2f} m + Reserve {:.2f} m'.format(b['wert'], MASSE[P]['hoehe_m'], HOEHE_RESERVE)
                elif b['krit'] == 'GEWICHT' and b['wert'] is not None and b['wert'] < t - 1e-9:
                    ergebnis = 'abgelehnt: {:.1f} t < Fahrzeuggewicht {:.1f} t'.format(b['wert'], t)
                if not ergebnis:
                    offen = [x for x in gruende if kriterium_von(x) == (b['krit'], 1)]
                    hart = [x for x in gruende if kriterium_von(x) == (b['krit'], 2)]
                    gruende = [x for x in gruende if x not in offen]
                    if b['krit'] == 'BREITE' and not hart:
                        e, beleg = 'AUSREICHEND', b['methode']
                        gr = 'Befund {} {}: {:.2f} m >= Bedarf {:.2f} m; vorher: {}'.format(b['methode'].lower(), b['datum'], b['wert'], bedarf, gr[:150])
                    if hart:
                        ergebnis = 'Widerspruch: Modell sperrt ({}), bleibt gesperrt'.format(hart[0][:80])
                    elif offen:
                        ergebnis = 'uebernommen ({} Grund aufgehoben)'.format(len(offen))
                    else:
                        ergebnis = 'ohne Wirkung (kein offener Grund fuer dieses Kriterium)'
                    if offen or not hart:
                        bef_txt.append(kurz)
            bef_prot.append([sid, nm or '', P, b['krit'], b['befund'], b['wert'] if b['wert'] is not None else '', b['methode'], b['datum'], b['von'], ergebnis])
        if bef_txt or any(kriterium_von(x)[0] == 'BEFUND' for x in gruende):
            status = STUFE[max([kriterium_von(x)[1] for x in gruende] or [0])]
            if status != vor_bef:
                bef_wechsel[(P, vor_bef, status)] += 1
                bef_wechsel_liste.append('{} {} {} ({:.0f} m): {} -> {}'.format(P, sid, nm or '', L or 0, vor_bef, status))
                if zone == 'BEWERTUNG':
                    km[(P, 'befund', status)] += (L or 0) / 1000
        rec[p + '_v9_befund'] = ' | '.join(bef_txt)[:300] or None
        if bef_txt:
            hinweise.insert(0, 'nach Befund: ' + ' | '.join(bef_txt))
        if st is not None and GEWICHT[P] > STEIGUNG_T:
''')

ers('''        rec[p + '_v9_status'] = status; rec[p + '_v9_grund'] = (' | '.join(gruende + hinweise) or 'validiert (Breite nachgewiesen, keine Hinweise auf Hoehe/Gewicht/Hindernis)')[:300]
''', '''        rec[p + '_v9_status'] = status
        rec[p + '_v9_grund'] = (('validiert ' if status == 'VALIDIERT' and not gruende and bef_txt else '') + ' | '.join(gruende + hinweise)
                                or 'validiert (Breite nachgewiesen, keine Hinweise auf Hoehe/Gewicht/Hindernis)')[:300]
''')

ers('''db.execute("INSERT INTO bors_meta (schluessel, wert) VALUES ('v9_2d', ?)", ('{} aus {} + {} + {}'.format(STAMP, SRC.name, BR.name, HKD.name),))
''', '''db.execute("INSERT INTO bors_meta (schluessel, wert) VALUES ('v9_2d', ?)", ('{} aus {} + {} + {}'.format(STAMP, SRC.name, BR.name, HKD.name),))
db.execute("INSERT INTO bors_meta (schluessel, wert) VALUES ('v9_2f', ?)", ('{} Befunde aus {}: {} gueltig, {} ungueltig'.format(
    STAMP, BEF.name if BEF.exists() else '(keine Datei)', sum(len(v) for v in BEFUNDE.values()), len(bef_fehler)),))
''')

ers('''log('')
log('Ergebnis Zielgebiet (km):')
''', '''log('')
log('V9.2f Statuswechsel durch Befunde (Abschnitte): {}'.format(
    ', '.join('{} {}->{}: {}'.format(P, a, z, n) for (P, a, z), n in sorted(bef_wechsel.items())) or 'keine'))
for z in bef_wechsel_liste:
    log('  ' + z)
with open(str(NMDIR / (OUT.stem + '_Befunde_Protokoll.csv')), 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh, delimiter=';')
    w.writerow(['seg_id', 'name', 'klasse', 'kriterium', 'befund', 'messwert', 'methode', 'datum', 'geprueft_von', 'ergebnis'])
    w.writerows(bef_prot)
for r in bef_prot:
    if not r[-1].startswith('uebernommen'):
        log('  Befund {} {} {}: {}'.format(r[0], r[2], r[3], r[-1]))
log('')
log('Ergebnis Zielgebiet (km):')
''')

ers('''        km[(P, 'v9_2d', 'UNVALIDIERT')], km[(P, 'v9_2d', 'GESPERRT')]))
''', '''        km[(P, 'v9_2d', 'UNVALIDIERT')], km[(P, 'v9_2d', 'GESPERRT')]))
    log('  {} durch Befunde (V9.2f): jetzt validiert {:.2f} | unvalidiert {:.2f} | gesperrt {:.2f}'.format(
        P, km[(P, 'befund', 'VALIDIERT')], km[(P, 'befund', 'UNVALIDIERT')], km[(P, 'befund', 'GESPERRT')]))
''')

ziel.write_text(src, encoding='utf-8')
print('geschrieben', ziel, len(src.splitlines()), 'Zeilen')
