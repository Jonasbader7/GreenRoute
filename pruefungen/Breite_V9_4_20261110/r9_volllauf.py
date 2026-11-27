# -*- coding: utf-8 -*-
"""Kontrollierter Volllauf 25_Breite_V9_4_BORS (alle Abschnitte) mit Lauf-Protokoll.
Aufruf: python r9_volllauf.py <BORS_ROOT> <protokoll_ordner>
Schreibt vor dem Lauf <protokoll_ordner>/lauf_<zeit>_start.json (Code-Hashes, Eingaben mit Groesse/SHA256, Parameter),
nach dem Lauf lauf_<zeit>_ende.json (Ausgabedatei, Groesse, Tabellen und Zeilenzahlen, Dauer). Erfolg nur, wenn die Ausgabe
lesbar ist und breite_v9 alle Abschnitte des Netzes enthaelt."""
import hashlib, json, sqlite3, sys, time, traceback
from datetime import datetime
from pathlib import Path

ROOT, PROT = Path(sys.argv[1]), Path(sys.argv[2]); PROT.mkdir(parents=True, exist_ok=True)
ID = datetime.now().strftime('%Y%m%d_%H%M%S')
AKT, SK = ROOT / '02_Daten' / '2_Aktuell_V9', ROOT / '01_Skripte' / 'Aktuell'


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


code = {f: sha(SK / f) for f in ('bors_geo.py', 'bors_bewertung_v8.py', 'bors_breite_v9_3.py', 'bors_breite_v9_4.py', '25_Breite_V9_4_BORS.py',
                                 'bors_pfade.py', 'BORS_Fahrzeuge_V1.csv')}
ein = {}
for p in [AKT / 'av_export_20261028_1447.gpkg', AKT / 'BORS_Netzmaster_V8_20261028_1357.gpkg',
          AKT / 'Vorstufen' / 'parkierung_v5_BORS_Netz_V2_20261027_1534.gpkg', ROOT / '02_Daten' / '1_Rohdaten' / 'Stadt_Bern' / 'baumkataster.gpkg']:
    ein[str(p.relative_to(ROOT))] = dict(groesse=p.stat().st_size, sha256=sha(p))
vorher = set(AKT.glob('BORS_Breite_V9_4_*.gpkg'))
start = dict(lauf_id=ID, start=datetime.now().isoformat(timespec='seconds'), code=code, eingaben=ein, python=sys.version,
             parameter='siehe bors_meta der Ausgabe (KORRIDOR_VERSION, DELTA_STUFEN, NEIGUNG_ZELLEN, KNOTEN_M, P_ABSCHNITT, PARK_LAGE_M, BAUWERK_ABZUG_M)')
(PROT / 'lauf_{}_start.json'.format(ID)).write_text(json.dumps(start, indent=1, ensure_ascii=False), encoding='utf-8')
t0 = time.time()
ende = dict(lauf_id=ID)
try:
    g = {'BORS_ROOT': ROOT, '__name__': '__main__'}
    p = SK / '25_Breite_V9_4_BORS.py'
    exec(compile(p.read_text(encoding='utf-8'), str(p), 'exec'), g)
    neu = sorted(set(AKT.glob('BORS_Breite_V9_4_*.gpkg')) - vorher)
    assert len(neu) == 1, 'genau eine neue Ausgabe erwartet: {}'.format(neu)
    out = neu[0]
    c = sqlite3.connect('file:{}?mode=ro'.format(out.as_posix()), uri=True)
    tab = {t: c.execute('select count(*) from "{}"'.format(t)).fetchone()[0] for (t,) in c.execute('select table_name from gpkg_contents')}
    nm = sqlite3.connect('file:{}?mode=ro'.format((AKT / 'BORS_Netzmaster_V8_20261028_1357.gpkg').as_posix()), uri=True)
    soll = nm.execute('select count(*) from netz_v5 where ist_routingtyp = 1').fetchone()[0]
    ok = tab.get('breite_v9') == soll and c.execute('pragma integrity_check').fetchone()[0] == 'ok'
    ende.update(status='OK' if ok else 'FEHLER: Zeilenzahl/Integritaet', ausgabe=str(out.relative_to(ROOT)), groesse=out.stat().st_size,
                sha256=sha(out), tabellen=tab, soll_abschnitte=soll, meta=dict(c.execute('select schluessel, wert from bors_meta').fetchall()))
except Exception:
    ende.update(status='FEHLER', fehler=traceback.format_exc())
ende.update(ende=datetime.now().isoformat(timespec='seconds'), dauer_s=round(time.time() - t0))
(PROT / 'lauf_{}_ende.json'.format(ID)).write_text(json.dumps(ende, indent=1, ensure_ascii=False), encoding='utf-8')
print('LAUF', ID, ende['status'], ende.get('ausgabe'), ende['dauer_s'], 's')
