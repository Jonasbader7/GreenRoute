// BORS Benchmark REF gegen Fahrzeugklassen (5.11.2026)
// Normales node.js, kein QGIS. Liest nur: Web-Router (bors_router.js) und netz.json aus 04_WebApp/Entwicklung_V9_Netz_V9_2g.
// Frage: Wie oft fuehrt eine Route ohne Fahrzeugmasse (REF = Personenwagen nach Verkehrsregeln) ein Fahrzeug der Klasse
// A-D ueber einen Abschnitt, den BORS fuer diese Klasse sperrt oder nicht validiert - und findet BORS dann eine
// durchgehend geeignete Alternative?
// Aufruf: node benchmark_ref.js [--n 300] [--gezielt 100] [--seed 20261105] [--nur 0] [--out <Ordner>]
'use strict';
const fs = require('fs');
const path = require('path');

const ARG = {};
for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ROOT = path.resolve(__dirname, '..', '..', '..');
const WEB = path.join(ROOT, '04_WebApp', 'Entwicklung_V9_Netz_V9_2g');
const OUT = ARG.out ? path.resolve(ARG.out) : path.resolve(__dirname, '..', 'ergebnisse');
const N_VERTEILT = +(ARG.n || 300), N_GEZIELT = +(ARG.gezielt || 100), SEED = +(ARG.seed || 20261105), NUR = +(ARG.nur || 0);
const ZELLE_M = 500;
const KLASSEN = ['A', 'B', 'C', 'D'];
const OHNE_ZIEL = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link']);   // keine Einsatzorte auf Autobahn/Autostrasse

if (fs.existsSync(path.join(OUT, 'benchmark_fahrten.csv'))) { console.error('Abbruch: ' + OUT + ' enthaelt schon Ergebnisse (nichts ueberschreiben).'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ Laden
const g = {};
new Function('globalThis', 'window', fs.readFileSync(path.join(WEB, 'bors_router.js'), 'utf8'))(g, undefined);
const D = JSON.parse(fs.readFileSync(path.join(WEB, 'netz.json'), 'utf8'));
const N = new g.BORS.Netz(D), R = new g.BORS.Router(N);
const A = (f, c) => N.attr(f, c);
const T = i => D.texte[i] || '';

// Zufall mit Seed (mulberry32), damit die Stichprobe nachvollziehbar ist
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = rng(SEED);
const mischen = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// LV95 -> WGS84 (Naeherungsformel swisstopo, ca. 1 m), nur fuer die Kontroll-Links
function wgs(E, Nn) {
  const y = (E - 2600000) / 1e6, x = (Nn - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
  return [p * 100 / 36, l * 100 / 36];
}
const abs = ([x, y]) => [x + D.x0, y + D.y0];
const rel = ([E, Nn]) => [E - D.x0, Nn - D.y0];

// ------------------------------------------------------------------ Evidenz eines Sperrgrunds
// Nur «harte» Teile sperren (Gewicht:/Hoehe:/Breite:/Hindernis:). «ungeklaert», «nicht entscheidbar», «knapp», «abgeleitet»
// und «Hinweis» sperren nicht. Staerkste Evidenz zuerst.
const STUFEN = ['AMTLICH', 'SIGNAL_OSM_KSVB', 'MODELL_BREITE', 'SONSTIGE_SPERRE'];
function teilEvidenz(p) {
  const kopf = p.split(':')[0].trim();
  if (!/^(Gewicht|Hoehe|Breite|Hindernis)$/.test(kopf)) return null;
  if (/Tiefbau Stadt Bern|Hinderniskartei/.test(p)) return 'AMTLICH';
  if (kopf === 'Breite' && /Signal Hoechstbreite/.test(p)) return 'SIGNAL_OSM_KSVB';
  if (kopf === 'Breite') return 'MODELL_BREITE';
  if (/OSM|KSVB|Hoehenbegrenzer/.test(p)) return 'SIGNAL_OSM_KSVB';
  return 'SONSTIGE_SPERRE';
}
const evCache = {};
function evidenz(c, f) {   // -> {stufe, kriterium, text} fuer gesperrte Abschnitte
  const k = c + f; if (evCache[k]) return evCache[k];
  const txt = T(D.grund[c][f]); let best = null;
  for (const p of txt.split(' | ')) {
    const s = teilEvidenz(p); if (!s) continue;
    if (!best || STUFEN.indexOf(s) < STUFEN.indexOf(best.stufe)) best = { stufe: s, kriterium: p.split(':')[0].trim(), text: p.trim() };
  }
  return evCache[k] = best || { stufe: 'SONSTIGE_SPERRE', kriterium: '?', text: txt };
}

// Abbiegen: Knoten am Uebergang zweier Zeilen bestimmen und in der Tabelle der Klasse nachsehen
const TK = (u, a, b) => (u * 32768 + a) * 32768 + b;
function knotenBei(f, pi, pos) { const cum = N.feat[f].cum[pi]; for (let i = 0; i < cum.length; i++) if (Math.abs(cum[i] - pos) < 1e-6) return N.feat[f].ids[pi][i]; return -1; }
function unmoeglicheManoever(rows, c) {
  const t = N.abb[c], o = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i > 0 && rows[i - 1].f !== r.f) {
      const u = knotenBei(r.f, r.pi, r.a), k = TK(u, rows[i - 1].f, r.f), tx = t.ttext.get(k);
      if (u >= 0 && tx && /UNMOEGLICH/.test(tx)) o.push({ f: r.f, text: tx });
    }
    if (i === 0 || rows[i - 1].f !== r.f) {
      const tx = t.kurve.get(r.f * 2 + (r.b >= r.a ? 1 : 0)) ? t.ktext.get(r.f) : null;
      if (tx && /UNMOEGLICH/.test(tx)) o.push({ f: r.f, text: tx });
    }
  }
  return o;
}

// ------------------------------------------------------------------ Start
const W = D.wachen[0], START = [W[1] / 100, W[2] / 100];
const START_NAME = W[0];

// ------------------------------------------------------------------ Stichprobe 1: raeumlich verteilt
// Untersuchungsgebiet in 500-m-Zellen. Kandidaten: Abschnitte innerhalb des Gebiets, fuer REF befahrbar, kein Autobahn-/
// Autostrassentyp. Zellen mit Kandidaten werden zufaellig gezogen (jede Zelle hoechstens einmal), in der Zelle ein
// Abschnitt laengengewichtet und darauf eine zufaellige Stelle.
function punktAuf(f, s) {   // s in [0,1] entlang Gesamtlaenge
  const F = N.feat[f]; let rest = s * F.L;
  for (let pi = 0; pi < F.ids.length; pi++) {
    const cum = F.cum[pi], Lp = cum[cum.length - 1];
    if (rest <= Lp || pi === F.ids.length - 1) {
      for (let i = 0; i < cum.length - 1; i++) if (rest <= cum[i + 1] || i === cum.length - 2) {
        const t = cum[i + 1] > cum[i] ? Math.min(1, Math.max(0, (rest - cum[i]) / (cum[i + 1] - cum[i]))) : 0, a = F.ids[pi][i], b = F.ids[pi][i + 1];
        return [N.x[a] + t * (N.x[b] - N.x[a]), N.y[a] + t * (N.y[b] - N.y[a])];
      }
    }
    rest -= Lp;
  }
}
const zielTauglich = f => !A(f, 'ausserhalb') && D.kosten.V.REF[f] > 0 && !OHNE_ZIEL.has(A(f, 'highway_type')) && N.feat[f].L >= 5;
const zellen = new Map();
N.feat.forEach((F, f) => {
  if (!zielTauglich(f)) return;
  const m = punktAuf(f, 0.5), k = Math.floor(m[0] / ZELLE_M) + ':' + Math.floor(m[1] / ZELLE_M);
  if (!zellen.has(k)) zellen.set(k, []); zellen.get(k).push(f);
});
const zellListe = mischen([...zellen.keys()].sort());
const verteilt = [];
for (const k of zellListe.slice(0, N_VERTEILT)) {
  const fs_ = zellen.get(k), tot = fs_.reduce((s, f) => s + N.feat[f].L, 0); let z = rnd() * tot, f = fs_[fs_.length - 1];
  for (const x of fs_) { z -= N.feat[x].L; if (z <= 0) { f = x; break; } }
  verteilt.push({ stichprobe: 'VERTEILT', ziel: punktAuf(f, 0.1 + 0.8 * rnd()), anlass: 'Zelle ' + k });
}

// ------------------------------------------------------------------ Stichprobe 2: gezielt
// Kritische Stellen fuer C und D (je Strassenname hoechstens eine): amtliche Sperre, Signal OSM/KSVB, Modell Breite,
// unmoegliche Kurve (Schleppkurve). Ziel = Nachbarabschnitt hinter der Stelle, so dass die REF-Route durch sie fuehrt.
const QUOTE = { AMTLICH: 0.3, SIGNAL_OSM_KSVB: 0.25, MODELL_BREITE: 0.25, ABBIEGEN: 0.2 };
const kandidaten = { AMTLICH: [], SIGNAL_OSM_KSVB: [], MODELL_BREITE: [], ABBIEGEN: [] };
for (const c of ['D', 'C']) {
  D.kat[c].forEach((k, f) => {
    if (k !== 2 || A(f, 'ausserhalb') || !(D.kosten.V.REF[f] > 0)) return;
    const e = evidenz(c, f); if (kandidaten[e.stufe]) kandidaten[e.stufe].push({ c, f, stufe: e.stufe, text: e.text });
  });
  D.abb[c].kurve.forEach(([f, , , tx]) => {
    if (/UNMOEGLICH/.test(T(tx)) && !A(f, 'ausserhalb') && D.kosten.V.REF[f] > 0 && D.kat[c][f] !== 2) kandidaten.ABBIEGEN.push({ c, f, stufe: 'ABBIEGEN', text: T(tx) });
  });
}
const gezielt = [], schonName = new Set();
const refKosten = R.kosten('VALIDIERT', 'REF');
for (const stufe of Object.keys(QUOTE)) {
  const soll = Math.round(N_GEZIELT * QUOTE[stufe]); let ist = 0;
  for (const k of mischen(kandidaten[stufe].slice())) {
    if (ist >= soll || (NUR && gezielt.length >= NUR)) break;
    const name = A(k.f, 'name') || A(k.f, 'seg_id'); if (schonName.has(stufe + name)) continue;
    // Nachbarabschnitte an beiden Enden
    const F = N.feat[k.f], ends = new Set();
    F.ids.forEach(ids => { ends.add(ids[0]); ends.add(ids[ids.length - 1]); });
    const nachbarn = [];
    ends.forEach(u => N.und[u].forEach(([, fn]) => { if (fn !== k.f && zielTauglich(fn) && D.kat[k.c][fn] !== 2 && !nachbarn.includes(fn)) nachbarn.push(fn); }));
    let gefunden = null;
    for (const fn of nachbarn.slice(0, 6)) {
      const ziel = punktAuf(fn, 0.5), r = R.routeProfil('REF', START, ziel, 'VALIDIERT');
      if (r.ok && r.rows.some(x => x.f === k.f)) { gefunden = ziel; break; }
    }
    if (!gefunden) continue;
    schonName.add(stufe + name); ist++;
    gezielt.push({ stichprobe: 'GEZIELT', ziel: gefunden, anlass: stufe + ' ' + k.c + ': ' + name + ' (' + A(k.f, 'seg_id') + ') ' + k.text.slice(0, 120) });
  }
}

let fahrten = verteilt.concat(gezielt);
if (NUR) fahrten = verteilt.slice(0, NUR).concat(gezielt.slice(0, NUR));
console.log('Start:', START_NAME, '| Zellen mit Kandidaten:', zellen.size, '| verteilt:', verteilt.length, '| gezielt:', gezielt.length, '| gerechnet:', fahrten.length);

// ------------------------------------------------------------------ Auswertung je Fahrt und Klasse
const csvZ = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const zeilen = [], stellen = [];
const KOPF = ['fahrt_id', 'stichprobe', 'anlass', 'ziel_E', 'ziel_N', 'ziel_gemeinde', 'ziel_strasse', 'klasse',
  'ref_ok', 'ref_laenge_m', 'ref_fahrzeit_min',
  'ref_konflikt', 'ref_n_amtlich', 'ref_n_signal', 'ref_n_modell_breite', 'ref_n_sonstige', 'ref_m_gesperrt',
  'ref_n_abbiegen_unmoeglich', 'ref_m_ungeklaert', 'erste_sperre_strasse', 'erste_sperre_seg', 'erste_sperre_grund',
  'bors_ok', 'bors_modus', 'bors_ursache', 'bors_laenge_m', 'bors_fahrzeit_min', 'bors_m_ungeklaert', 'bors_m_gesperrt',
  'bors_n_abbiegen_unmoeglich', 'bors_dominanz_von', 'gleich_wie_ref', 'ueberlappung_pct', 'ergebnis',
  'google_maps', 'map_geo_admin_stelle'];
const t0 = Date.now();
fahrten.forEach((fa, i) => {
  const res = R.berechne(START, fa.ziel, 'VALIDIERT'), ref = res.REF;
  const zE = abs(fa.ziel), zs = N.nearest(fa.ziel[0], fa.ziel[1], 1, 50)[0];
  const fz = zs ? zs[1] : -1;
  const [la1, lo1] = wgs(...abs(START)), [la2, lo2] = wgs(...zE);
  const gm = 'https://www.google.com/maps/dir/?api=1&origin=' + la1.toFixed(6) + ',' + lo1.toFixed(6) + '&destination=' + la2.toFixed(6) + ',' + lo2.toFixed(6) + '&travelmode=driving';
  const refF = ref.ok ? ref.rows.map(r => r.f) : [];
  const refLen = new Map(); if (ref.ok) ref.rows.forEach(r => refLen.set(r.f, (refLen.get(r.f) || 0) + r.L));
  for (const c of KLASSEN) {
    const z = { fahrt_id: i + 1, stichprobe: fa.stichprobe, anlass: fa.anlass, ziel_E: zE[0].toFixed(1), ziel_N: zE[1].toFixed(1),
      ziel_gemeinde: fz >= 0 ? A(fz, 'gemeinde') : '', ziel_strasse: fz >= 0 ? (A(fz, 'name') || '') : '', klasse: c, ref_ok: ref.ok ? 1 : 0, google_maps: gm };
    let erste = null;
    if (ref.ok) {
      z.ref_laenge_m = ref.laenge_m.toFixed(0); z.ref_fahrzeit_min = ref.fahrzeit_min.toFixed(2);
      const n = { AMTLICH: 0, SIGNAL_OSM_KSVB: 0, MODELL_BREITE: 0, SONSTIGE_SPERRE: 0 }; let mG = 0, mU = 0; const gesehen = new Set();
      for (const r of ref.rows) {
        const k = D.kat[c][r.f];
        if (k === 2) {
          mG += r.L;
          if (!gesehen.has(r.f)) { gesehen.add(r.f); const e = evidenz(c, r.f); n[e.stufe]++;
            if (!erste || STUFEN.indexOf(e.stufe) < STUFEN.indexOf(erste.e.stufe)) erste = { f: r.f, e, pt: r.pts[0] };
            stellen.push({ fahrt_id: i + 1, stichprobe: fa.stichprobe, klasse: c, seg_id: A(r.f, 'seg_id'), strasse: A(r.f, 'name') || '', stufe: e.stufe, kriterium: e.kriterium, grund: e.text }); }
        } else if (k === 1) mU += r.L;
      }
      const ab = unmoeglicheManoever(ref.rows, c);
      Object.assign(z, { ref_n_amtlich: n.AMTLICH, ref_n_signal: n.SIGNAL_OSM_KSVB, ref_n_modell_breite: n.MODELL_BREITE, ref_n_sonstige: n.SONSTIGE_SPERRE,
        ref_m_gesperrt: mG.toFixed(0), ref_n_abbiegen_unmoeglich: ab.length, ref_m_ungeklaert: mU.toFixed(0) });
      z.ref_konflikt = n.AMTLICH ? 'GESPERRT_AMTLICH' : n.SIGNAL_OSM_KSVB ? 'GESPERRT_SIGNAL' : n.MODELL_BREITE ? 'GESPERRT_MODELL_BREITE' : n.SONSTIGE_SPERRE ? 'GESPERRT_SONSTIGE'
        : ab.length ? 'ABBIEGEN_UNMOEGLICH' : mU > 0 ? 'NUR_UNGEKLAERT' : 'KEIN_KONFLIKT';
      if (erste) { z.erste_sperre_strasse = A(erste.f, 'name') || ''; z.erste_sperre_seg = A(erste.f, 'seg_id'); z.erste_sperre_grund = erste.e.text;
        const p = abs(erste.pt); z.map_geo_admin_stelle = 'https://map.geo.admin.ch/?lang=de&center=' + p[0].toFixed(0) + ',' + p[1].toFixed(0) + '&z=12&crosshair=marker'; }
    } else z.ref_konflikt = 'REF_KEINE_ROUTE';
    const b = res[c];
    z.bors_ok = b.ok ? 1 : 0; z.bors_modus = b.ok ? b.modus : 'KEINE_ROUTE'; z.bors_ursache = b.ursache || ''; z.bors_dominanz_von = b.dominanz_von || '';
    if (b.ok) {
      z.bors_laenge_m = b.laenge_m.toFixed(0); z.bors_fahrzeit_min = b.fahrzeit_min.toFixed(2);
      z.bors_m_ungeklaert = b.rows.filter(r => D.kat[c][r.f] === 1).reduce((s, r) => s + r.L, 0).toFixed(0);
      z.bors_m_gesperrt = b.rows.filter(r => D.kat[c][r.f] === 2).reduce((s, r) => s + r.L, 0).toFixed(0);   // Plausibilitaet: muss 0 sein
      z.bors_n_abbiegen_unmoeglich = unmoeglicheManoever(b.rows, c).length;
      const bf = b.rows.map(r => r.f);
      z.gleich_wie_ref = ref.ok && bf.length === refF.length && bf.every((f, j) => f === refF[j]) ? 1 : 0;
      if (ref.ok) { const bl = new Map(); b.rows.forEach(r => bl.set(r.f, (bl.get(r.f) || 0) + r.L)); let gem = 0; bl.forEach((L, f) => gem += Math.min(L, refLen.get(f) || 0)); z.ueberlappung_pct = (100 * gem / Math.max(ref.laenge_m, 1)).toFixed(0); }
    }
    // Ergebnis: was haette BORS dem Fahrzeug angeboten?
    const gesperrt = z.ref_konflikt && z.ref_konflikt.startsWith('GESPERRT');
    if (!ref.ok) z.ergebnis = 'OHNE_VERGLEICH';
    else if (!gesperrt) z.ergebnis = z.ref_konflikt === 'KEIN_KONFLIKT' ? 'REF_UNPROBLEMATISCH' : 'REF_NUR_' + (z.ref_konflikt === 'NUR_UNGEKLAERT' ? 'UNGEKLAERT' : 'ABBIEGEN');
    else if (!b.ok) z.ergebnis = 'GESPERRT_KEINE_BORS_ROUTE';
    else if (b.modus === 'VALIDIERT' && !b.ursache) z.ergebnis = 'GESPERRT_BORS_DURCHGEHEND_VALIDIERT';
    else if (b.modus === 'VALIDIERT' && b.ursache === 'ZIEL_ZU_FUSS') z.ergebnis = 'GESPERRT_BORS_VALIDIERT_RESTWEG_ZU_FUSS';
    else if (b.modus === 'VALIDIERT_BIS_ZUFAHRT' || b.modus === 'VALIDIERT') z.ergebnis = 'GESPERRT_BORS_VALIDIERT_BIS_ZUFAHRT';
    else z.ergebnis = 'GESPERRT_BORS_MIT_UNGEKLAERTEN';
    zeilen.push(z);
  }
  if ((i + 1) % 25 === 0) console.log('  ' + (i + 1) + '/' + fahrten.length + ' Fahrten, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
});

// ------------------------------------------------------------------ Schreiben
const schreib = (name, kopf, rows) => fs.writeFileSync(path.join(OUT, name), '﻿' + [kopf.join(';')].concat(rows.map(r => kopf.map(k => csvZ(r[k])).join(';'))).join('\r\n') + '\r\n', 'utf8');
schreib('benchmark_fahrten.csv', KOPF, zeilen);
schreib('benchmark_sperrstellen.csv', ['fahrt_id', 'stichprobe', 'klasse', 'seg_id', 'strasse', 'stufe', 'kriterium', 'grund'], stellen);

// Kennzahlen je Stichprobe und Klasse
const kenn = {};
for (const sp of ['VERTEILT', 'GEZIELT']) for (const c of KLASSEN) {
  const z = zeilen.filter(x => x.stichprobe === sp && x.klasse === c), mit = z.filter(x => x.ref_ok);
  const cnt = k => z.filter(x => x.ref_konflikt === k).length, erg = k => z.filter(x => x.ergebnis === k).length;
  const ges = mit.filter(x => x.ref_konflikt.startsWith('GESPERRT'));
  const dz = ges.filter(x => x.bors_ok).map(x => (+x.bors_fahrzeit_min) - (+x.ref_fahrzeit_min)).sort((a, b) => a - b);
  const dl = ges.filter(x => x.bors_ok).map(x => (+x.bors_laenge_m) - (+x.ref_laenge_m)).sort((a, b) => a - b);
  const med = a => a.length ? a[Math.floor((a.length - 1) / 2)] : null;
  kenn[sp + '_' + c] = { stichprobe: sp, klasse: c, fahrten: z.length, ref_mit_route: mit.length,
    GESPERRT_AMTLICH: cnt('GESPERRT_AMTLICH'), GESPERRT_SIGNAL: cnt('GESPERRT_SIGNAL'), GESPERRT_MODELL_BREITE: cnt('GESPERRT_MODELL_BREITE'), GESPERRT_SONSTIGE: cnt('GESPERRT_SONSTIGE'),
    ABBIEGEN_UNMOEGLICH: cnt('ABBIEGEN_UNMOEGLICH'), NUR_UNGEKLAERT: cnt('NUR_UNGEKLAERT'), KEIN_KONFLIKT: cnt('KEIN_KONFLIKT'),
    ref_mit_amtlicher_sperre_irgendwo: mit.filter(x => +x.ref_n_amtlich > 0).length,
    BORS_DURCHGEHEND_VALIDIERT: erg('GESPERRT_BORS_DURCHGEHEND_VALIDIERT'), BORS_RESTWEG_ZU_FUSS: erg('GESPERRT_BORS_VALIDIERT_RESTWEG_ZU_FUSS'),
    BORS_VALIDIERT_BIS_ZUFAHRT: erg('GESPERRT_BORS_VALIDIERT_BIS_ZUFAHRT'), BORS_MIT_UNGEKLAERTEN: erg('GESPERRT_BORS_MIT_UNGEKLAERTEN'), BORS_KEINE_ROUTE: erg('GESPERRT_KEINE_BORS_ROUTE'),
    bors_gleich_wie_ref_alle: z.filter(x => x.gleich_wie_ref === 1).length,
    bors_route_mit_gesperrtem_m: z.filter(x => +x.bors_m_gesperrt > 0).length,
    umweg_fahrzeit_min_median: med(dz), umweg_fahrzeit_min_max: dz.length ? dz[dz.length - 1] : null,
    umweg_laenge_m_median: med(dl), umweg_laenge_m_max: dl.length ? dl[dl.length - 1] : null };
}
const meta = { erstellt: new Date().toISOString(), netz: D.netz, version: D.version, router: 'bors_router.js (Web, entspricht QGIS V9.2f)',
  start: START_NAME, start_lv95: abs(START), seed: SEED, zelle_m: ZELLE_M, zellen_mit_kandidaten: zellen.size,
  n_verteilt: verteilt.length, n_gezielt: gezielt.length, nur: NUR, kandidaten_gezielt: Object.fromEntries(Object.entries(kandidaten).map(([k, v]) => [k, v.length])),
  laufzeit_s: (Date.now() - t0) / 1000, profile: D.profile };
fs.writeFileSync(path.join(OUT, 'benchmark_kennzahlen.json'), JSON.stringify({ meta, kennzahlen: kenn }, null, 1), 'utf8');
console.log(JSON.stringify(meta));
for (const k of Object.keys(kenn)) console.log(JSON.stringify(kenn[k]));
