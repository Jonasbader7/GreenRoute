// BORS Validierungsstichprobe: Auswertung der Erfassungen (5.11.2026). Normales node.js.
// Liest alle erfassung_*.csv (ausser der Vorlage) im Stichprobenordner, dazu Schluessel, Pruefliste, Reserve und Meta.
// Rechnet je Abschnitt und Klasse das Urteil nach der vorab festgelegten Regel (Stichprobenplan.md, Abschnitt 5) und
// vergleicht mit dem BORS-Zustand (Abschnitt 6). Schreibt in einen neuen Ordner auswertung_<Zeitstempel> (nichts ueberschreiben).
// Aufruf: node auswertung_stichprobe.js [--dir <Stichprobenordner>] [--out <Zielordner>]
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const DIR = path.resolve(ARG.dir || path.join(__dirname, '..', 'stichprobe'));
const jetzt = new Date(), pad = n => String(n).padStart(2, '0');
const STEMPEL = jetzt.getFullYear() + pad(jetzt.getMonth() + 1) + pad(jetzt.getDate()) + '_' + pad(jetzt.getHours()) + pad(jetzt.getMinutes());
const OUT = path.resolve(ARG.out || path.join(DIR, '..', 'auswertung_' + STEMPEL));
if (fs.existsSync(OUT)) { console.error('Abbruch: ' + OUT + ' existiert schon (nichts ueberschreiben).'); process.exit(1); }

// ------------------------------------------------------------------ Regeln (wie Netzmaster V9.2g)
// Bedarf = max(Karosserie + 2 x Reserve, Spiegel + 2 x 0.10 m); Reserve A 0.15 m, B-D 0.25 m; Hoehenreserve 0.10 m.
const KL = ['A', 'B', 'C', 'D'];
const P = { A: { kar: 1.94, bed: 2.39, h: 1.64, t: 3.1 }, B: { kar: 2.20, bed: 2.75, h: 2.95, t: 5.5 },
            C: { kar: 2.50, bed: 3.20, h: 3.20, t: 17.0 }, D: { kar: 2.56, bed: 3.26, h: 3.66, t: 28.44 } };
const H_RES = 0.10;
const TOL = { DESK: 0.50, VOR_ORT: 0.05 };        // Messunsicherheit Breite und geschaetzte/gemessene Hoehe
const RANG = { NICHT_PASSIERBAR: 3, UNKLAR: 2, GRENZWERTIG: 1, PASSIERBAR: 0 };
const SICH = { SICHER: 2, UNSICHER: 1, NICHT_ERKENNBAR: 0 };

// ------------------------------------------------------------------ Lesen
function lies(datei) {
  const roh = fs.readFileSync(datei, 'utf8').replace(/^﻿/, '');
  const zeilen = []; let feld = '', zeile = [], q = false;
  for (let i = 0; i < roh.length; i++) {
    const ch = roh[i];
    if (q) { if (ch === '"' && roh[i + 1] === '"') { feld += '"'; i++; } else if (ch === '"') q = false; else feld += ch; }
    else if (ch === '"') q = true;
    else if (ch === ';') { zeile.push(feld); feld = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && roh[i + 1] === '\n') i++; zeile.push(feld); feld = ''; if (zeile.some(x => x !== '')) zeilen.push(zeile); zeile = []; }
    else feld += ch;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); if (zeile.some(x => x !== '')) zeilen.push(zeile); }
  if (!zeilen.length) return [];
  const k = zeilen[0].map(s => s.trim());
  return zeilen.slice(1).map(z => { const o = {}; k.forEach((x, i) => o[x] = (z[i] || '').trim()); return o; });
}
const zahl = s => { if (s === undefined || s === null) return null; const t = String(s).replace(',', '.').replace(/[^0-9.\-]/g, ''); return t === '' || isNaN(+t) ? null : +t; };
const jaNein = s => /^(ja|j|yes|x|1|true)$/i.test(String(s || '').trim());

const schl = new Map(lies(path.join(DIR, 'SCHLUESSEL_nicht_an_Pruefende.csv')).map(r => [r.nr, r]));
const liste = new Map(lies(path.join(DIR, 'pruefliste_blind.csv')).concat(lies(path.join(DIR, 'reserve_blind.csv'))).map(r => [r.nr, r]));
const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'stichprobe_meta.json'), 'utf8'));
const NH = Object.fromEntries(meta.schichten.map(s => [s.id, s.N]));
const SCHICHTEN = meta.schichten.map(s => s.id);

const dateien = fs.readdirSync(DIR).filter(f => /^erfassung_.*\.csv$/i.test(f) && !/vorlage/i.test(f));
const warn = [], erf = [];
for (const d of dateien) lies(path.join(DIR, d)).forEach((r, i) => {
  r._datei = d; r._zeile = i + 2;
  const wo = d + ' Zeile ' + r._zeile;
  if (!r.nr) { warn.push(wo + ': ohne nr, ignoriert'); return; }
  const k = schl.get(r.nr);
  if (!k) { warn.push(wo + ': nr ' + r.nr + ' nicht in der Stichprobe, ignoriert'); return; }
  if (r.seg_id && r.seg_id !== k.seg_id) warn.push(wo + ': seg_id ' + r.seg_id + ' passt nicht zu ' + r.nr + ' (' + k.seg_id + ')');
  r.methode = (r.methode || '').toUpperCase().replace(/[\s-]/g, '_');
  if (!TOL[r.methode]) { warn.push(wo + ': methode "' + r.methode + '" unbekannt (DESK oder VOR_ORT), als DESK gewertet'); r.methode = 'DESK'; }
  r.sicherheit = (r.sicherheit || '').toUpperCase().replace(/\s/g, '_');
  if (!(r.sicherheit in SICH)) { warn.push(wo + ': sicherheit "' + r.sicherheit + '" unbekannt, als UNSICHER gewertet'); r.sicherheit = 'UNSICHER'; }
  if (!r.pruefer) warn.push(wo + ': pruefer fehlt');
  erf.push(r);
});

// ------------------------------------------------------------------ Urteil je Erfassung und Klasse
function urteil(r, c) {
  if (/^nein$/i.test(r.pruefbar)) return { u: 'NICHT_PRUEFBAR', warum: r.grund_nicht_pruefbar || '' };
  if (r.sicherheit === 'NICHT_ERKENNBAR') return { u: 'UNKLAR', warum: 'nicht erkennbar' };
  const p = P[c], tol = TOL[r.methode], teile = [];
  // Breite
  const wF = zahl(r.engste_breite_fest_m), wP0 = zahl(r.breite_mit_parkierung_m), park = jaNein(r.parkfelder);
  const wP = wP0 !== null ? wP0 : (park ? null : wF);
  if (wF === null && wP === null) teile.push(['UNKLAR', 'Breite fehlt']);
  else if (wF !== null && wF + tol < p.kar) teile.push(['NICHT_PASSIERBAR', 'feste Breite ' + wF + ' m + ' + tol + ' < Karosserie ' + p.kar]);
  else if (wP !== null && wP - tol >= p.bed) teile.push(['PASSIERBAR', 'Breite ' + wP + ' m - ' + tol + ' >= Bedarf ' + p.bed]);
  else if (wP !== null && wP + tol < p.bed && wF !== null && wF - tol >= p.kar) teile.push(['GRENZWERTIG', 'Breite zwischen Karosserie ' + p.kar + ' und Bedarf ' + p.bed]);
  else teile.push(['UNKLAR', 'Breite innerhalb der Messunsicherheit (' + (wP !== null ? wP : wF) + ' m, +/- ' + tol + ')']);
  // Hoehe
  const hS = zahl(r.schild_hoechsthoehe_m), hM = zahl(r.lichte_hoehe_m), quelle = (r.hoehe_quelle || '').toUpperCase();
  if (hS !== null) { if (hS < p.h) teile.push(['NICHT_PASSIERBAR', 'Schild Hoehe ' + hS + ' < ' + p.h]); else if (hS < p.h + H_RES) teile.push(['GRENZWERTIG', 'Schild Hoehe knapp']); }
  if (jaNein(r.ueberbauung_oder_unterfuehrung) && hS === null) {
    if (hM === null) teile.push(['UNKLAR', 'Ueberbauung ohne Hoehenangabe']);
    else { const th = quelle === 'SCHILD' ? 0 : tol;
      if (hM + th < p.h) teile.push(['NICHT_PASSIERBAR', 'lichte Hoehe ' + hM + ' < ' + p.h]);
      else if (hM - th >= p.h + H_RES) { /* passierbar */ }
      else if (hM + th < p.h + H_RES && hM - th >= p.h) teile.push(['GRENZWERTIG', 'Hoehe ohne Reserve']);
      else teile.push(['UNKLAR', 'Hoehe innerhalb der Messunsicherheit']); }
  }
  // Gewicht, Breitensignal, Hindernis
  const tS = zahl(r.schild_hoechstgewicht_t); if (tS !== null && tS < p.t) teile.push(['NICHT_PASSIERBAR', 'Schild Gewicht ' + tS + ' t < ' + p.t]);
  const bS = zahl(r.schild_hoechstbreite_m); if (bS !== null && bS < p.kar) teile.push(['NICHT_PASSIERBAR', 'Schild Breite ' + bS + ' < Karosserie ' + p.kar]);
  if (jaNein(r.hindernis_fest)) teile.push(['NICHT_PASSIERBAR', 'festes Hindernis']);
  const top = teile.reduce((a, b) => RANG[b[0]] > RANG[a[0]] ? b : a, ['PASSIERBAR', '']);
  return { u: top[0], warum: teile.filter(t => t[0] === top[0]).map(t => t[1]).join('; ') };
}

// Massgebende Erfassung je Nr: VOR_ORT vor DESK, dann hoehere Sicherheit, dann frueheres Datum, dann Pruefer
const jeNr = new Map(); erf.forEach(r => { if (!jeNr.has(r.nr)) jeNr.set(r.nr, []); jeNr.get(r.nr).push(r); });
const ordnung = (a, b) => (b.methode === 'VOR_ORT') - (a.methode === 'VOR_ORT') || SICH[b.sicherheit] - SICH[a.sicherheit] || (a.datum || '').localeCompare(b.datum || '') || (a.pruefer || '').localeCompare(b.pruefer || '');

// Evidenz der BORS-Sperre (wie Benchmark)
function stufe(grund) {
  let best = null;
  for (const p of String(grund || '').split(' | ')) {
    const kopf = p.split(':')[0].trim(); if (!/^(Gewicht|Hoehe|Breite|Hindernis)$/.test(kopf)) continue;
    const s = /Tiefbau Stadt Bern|Hinderniskartei/.test(p) ? 'AMTLICH' : (kopf === 'Breite' && !/Signal/.test(p)) ? 'MODELL_BREITE' : /OSM|KSVB|Hoehenbegrenzer|Signal/.test(p) ? 'SIGNAL_OSM_KSVB' : 'SONSTIGE';
    const o = ['AMTLICH', 'SIGNAL_OSM_KSVB', 'MODELL_BREITE', 'SONSTIGE']; if (!best || o.indexOf(s) < o.indexOf(best)) best = s;
  }
  return best || 'SONSTIGE';
}

const urteile = [], ausfall = [];
for (const [nr, rs] of jeNr) {
  const k = schl.get(nr), r = rs.slice().sort(ordnung)[0];
  if (/^nein$/i.test(r.pruefbar) && !rs.some(x => !/^nein$/i.test(x.pruefbar))) { ausfall.push({ nr, schicht: k.schicht, grund: r.grund_nicht_pruefbar || '' }); continue; }
  const m = rs.filter(x => !/^nein$/i.test(x.pruefbar)).sort(ordnung)[0];
  for (const c of KL) {
    const u = urteil(m, c), st = k['status_' + c];
    let feld;
    if (st === 'VALIDIERT') feld = { PASSIERBAR: 'RICHTIG', GRENZWERTIG: 'KNAPP', NICHT_PASSIERBAR: 'FALSCH_SICHER', UNKLAR: 'OFFEN' }[u.u];
    else if (st === 'GESPERRT') feld = { PASSIERBAR: 'ZU_VORSICHTIG', GRENZWERTIG: 'ZU_VORSICHTIG_KNAPP', NICHT_PASSIERBAR: 'RICHTIG', UNKLAR: 'OFFEN' }[u.u];
    else feld = { PASSIERBAR: 'WAERE_VALIDIERBAR', GRENZWERTIG: 'UNGEKLAERT_KNAPP', NICHT_PASSIERBAR: 'SPERRE_FEHLT', UNKLAR: 'OFFEN' }[u.u];
    urteile.push({ nr, seg_id: k.seg_id, schicht: k.schicht, klasse: c, bors_status: st, bors_stufe: st === 'GESPERRT' ? stufe(k['grund_' + c]) : '',
      urteil: u.u, feld, warum: u.warum, methode: m.methode, sicherheit: m.sicherheit, pruefer: m.pruefer, n_erfassungen: rs.length,
      strasse: (liste.get(nr) || {}).strasse || '', gemeinde: (liste.get(nr) || {}).gemeinde || '', bors_grund: k['grund_' + c],
      breite_fest_m: zahl(m.engste_breite_fest_m), breite_park_m: zahl(m.breite_mit_parkierung_m), mopube_median_m: zahl(k.breite_median_m), mopube_untere_m: zahl(k.untere_schranke_m), fahrverbot: m.schild_fahrverbot || '' });
  }
}
const offeneNr = [...schl.values()].filter(k => k.nr.startsWith('P') && !jeNr.has(k.nr)).map(k => k.nr);

// ------------------------------------------------------------------ Statistik
function lnC(n, k) { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; }
function cdf(n, x, p) { if (p <= 0) return 1; if (p >= 1) return x >= n ? 1 : 0; let s = 0; for (let k = 0; k <= x; k++) s += Math.exp(lnC(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)); return Math.min(1, s); }
function grenzeOben(n, x, a) { if (x >= n) return 1; let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (cdf(n, x, m) > a) lo = m; else hi = m; } return hi; }
function grenzeUnten(n, x, a) { if (x <= 0) return 0; return 1 - grenzeOben(n, n - x, a); }
const cp = (x, n) => n ? { x, n, p: x / n, unten95: grenzeUnten(n, x, 0.025), oben95: grenzeOben(n, x, 0.025), oben95_einseitig: grenzeOben(n, x, 0.05) } : { x, n, p: null };
const pct = v => v === null || v === undefined ? '–' : (100 * v).toFixed(1) + ' %';

const K = { meta: { erstellt: jetzt.toISOString(), stichprobe: DIR, erfassungsdateien: dateien, erfassungen: erf.length, abschnitte_erfasst: jeNr.size,
  abschnitte_ausgewertet: new Set(urteile.map(u => u.nr)).size, ausfall: ausfall.length, noch_offen_P: offeneNr.length, warnungen: warn.length } };

// Matrix je Klasse x Schicht
K.matrix = {};
for (const c of KL) for (const h of SCHICHTEN) {
  const z = urteile.filter(u => u.klasse === c && u.schicht === h); if (!z.length) continue;
  const m = {}; z.forEach(u => { const key = u.bors_status + ' / ' + u.urteil; m[key] = (m[key] || 0) + 1; }); K.matrix[c + '_' + h] = m;
}
// Falsch sicher je Klasse und Schicht (Nenner: validiert und beurteilt, ohne OFFEN)
K.falsch_sicher = {};
for (const c of KL) {
  const proSchicht = {}; let zaehler = 0, nenner = 0;
  for (const h of SCHICHTEN) {
    const z = urteile.filter(u => u.klasse === c && u.schicht === h && u.bors_status === 'VALIDIERT');
    const beurteilt = z.filter(u => u.feld !== 'OFFEN'), f = beurteilt.filter(u => u.feld === 'FALSCH_SICHER').length, kn = beurteilt.filter(u => u.feld === 'KNAPP').length;
    const nh = urteile.filter(u => u.klasse === c && u.schicht === h).length;
    if (!z.length) continue;
    proSchicht[h] = Object.assign(cp(f, beurteilt.length), { knapp: kn, offen: z.length - beurteilt.length, validiert_in_stichprobe: z.length, ausgewertet_in_schicht: nh });
    if (nh && beurteilt.length) { const w = NH[h] / nh; zaehler += w * f; nenner += w * beurteilt.length; }
  }
  K.falsch_sicher[c] = { je_schicht: proSchicht, gewichtet_gesamt: nenner ? zaehler / nenner : null };
}
// Zu vorsichtig (gesperrt, aber passierbar) je Klasse und Evidenzstufe
K.zu_vorsichtig = {};
for (const c of KL) {
  const z = urteile.filter(u => u.klasse === c && u.bors_status === 'GESPERRT' && u.feld !== 'OFFEN'); if (!z.length) continue;
  const o = { gesamt: cp(z.filter(u => u.feld === 'ZU_VORSICHTIG').length, z.length), knapp: z.filter(u => u.feld === 'ZU_VORSICHTIG_KNAPP').length, je_stufe: {} };
  for (const s of [...new Set(z.map(u => u.bors_stufe))]) { const zs = z.filter(u => u.bors_stufe === s); o.je_stufe[s] = cp(zs.filter(u => u.feld === 'ZU_VORSICHTIG').length, zs.length); }
  o.mit_fahrverbot_vermerk = z.filter(u => u.fahrverbot).length;
  K.zu_vorsichtig[c] = o;
}
// Aufloesung ungeklaert
K.ungeklaert = {};
for (const c of KL) {
  const z = urteile.filter(u => u.klasse === c && u.bors_status === 'UNVALIDIERT'); if (!z.length) continue;
  const n = z.length, cnt = f => z.filter(u => u.feld === f).length;
  K.ungeklaert[c] = { n, passierbar: cp(cnt('WAERE_VALIDIERBAR'), n), knapp: cnt('UNGEKLAERT_KNAPP'), nicht_passierbar: cp(cnt('SPERRE_FEHLT'), n), offen: cnt('OFFEN') };
}
// Breite: MOPUBE gegen Pruefmessung (eine Zeile je Nr, Klasse egal)
K.breite = {};
const jeNrU = [...new Map(urteile.map(u => [u.nr, u])).values()];
for (const mth of ['DESK', 'VOR_ORT']) {
  const z = jeNrU.filter(u => u.methode === mth && u.breite_fest_m !== null && u.mopube_median_m !== null);
  const d = z.map(u => u.mopube_median_m - u.breite_fest_m);
  const zu = jeNrU.filter(u => u.methode === mth && u.mopube_untere_m !== null && (u.breite_park_m !== null || u.breite_fest_m !== null));
  const unter = zu.filter(u => (u.breite_park_m !== null ? u.breite_park_m : u.breite_fest_m) < u.mopube_untere_m).length;
  const mw = d.length ? d.reduce((s, x) => s + x, 0) / d.length : null;
  K.breite[mth] = { n: d.length, differenz_mopube_minus_messung_mittel_m: mw, streuung_m: d.length > 1 ? Math.sqrt(d.reduce((s, x) => s + (x - mw) ** 2, 0) / (d.length - 1)) : null,
    messung_unter_unterer_schranke: cp(unter, zu.length), erwartet: 'ca. 5 % (k = 1.645, einseitig)' };
}
// Uebereinstimmung zweier Pruefender (DESK, Klasse D und Breite)
function kappa(paare) {
  const kat = Object.keys(RANG), n = paare.length; if (!n) return null;
  const po = paare.filter(([a, b]) => a === b).length / n;
  const pe = kat.reduce((s, k) => s + (paare.filter(p => p[0] === k).length / n) * (paare.filter(p => p[1] === k).length / n), 0);
  return { n, uebereinstimmung: po, kappa: pe < 1 ? (po - pe) / (1 - pe) : 1 };
}
const paare = [], bpaare = [], dvo = [], bdvo = [];
for (const [nr, rs] of jeNr) {
  const desk = rs.filter(r => r.methode === 'DESK' && !/^nein$/i.test(r.pruefbar)).sort(ordnung);
  const pr = [...new Map(desk.map(r => [r.pruefer, r])).values()];
  if (pr.length >= 2) { paare.push([urteil(pr[0], 'D').u, urteil(pr[1], 'D').u]); const a = zahl(pr[0].engste_breite_fest_m), b = zahl(pr[1].engste_breite_fest_m); if (a !== null && b !== null) bpaare.push(a - b); }
  const vo = rs.filter(r => r.methode === 'VOR_ORT' && !/^nein$/i.test(r.pruefbar));
  if (vo.length && desk.length) { dvo.push([urteil(desk[0], 'D').u, urteil(vo[0], 'D').u]); const a = zahl(desk[0].engste_breite_fest_m), b = zahl(vo[0].engste_breite_fest_m); if (a !== null && b !== null) bdvo.push(a - b); }
}
const mittelAbs = a => a.length ? a.reduce((s, x) => s + Math.abs(x), 0) / a.length : null;
K.zuverlaessigkeit = { zwei_pruefende_klasse_D: kappa(paare), zwei_pruefende_breite_mittlere_abs_differenz_m: mittelAbs(bpaare),
  desk_gegen_vor_ort_klasse_D: kappa(dvo), desk_gegen_vor_ort_breite_mittlere_abs_differenz_m: mittelAbs(bdvo) };
// Zur Kontrolle der Hauptaussage (Plan Abschnitt 6): obere einseitige 95 %-Grenze falsch sicher S1a Klasse D < 10 %
const s1a = (K.falsch_sicher.D.je_schicht || {}).S1a;
K.hauptaussage_S1a_D = s1a ? { fehler: s1a.x, beurteilt: s1a.n, oben95_einseitig: s1a.oben95_einseitig, kriterium_unter_10_prozent: s1a.oben95_einseitig < 0.10,
  vollstaendig: s1a.n + s1a.offen >= (meta.schichten.find(s => s.id === 'S1a') || {}).n } : null;

// ------------------------------------------------------------------ Schreiben
fs.mkdirSync(OUT, { recursive: true });
const csvZ = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const schreib = (name, rows) => { if (!rows.length) { fs.writeFileSync(path.join(OUT, name), '﻿(leer)\r\n'); return; } const kopf = Object.keys(rows[0]); fs.writeFileSync(path.join(OUT, name), '﻿' + [kopf.join(';')].concat(rows.map(r => kopf.map(k => csvZ(r[k])).join(';'))).join('\r\n') + '\r\n', 'utf8'); };
schreib('urteile.csv', urteile);
schreib('fehler_falsch_sicher.csv', urteile.filter(u => u.feld === 'FALSCH_SICHER'));
schreib('zu_vorsichtig.csv', urteile.filter(u => u.feld === 'ZU_VORSICHTIG' || u.feld === 'ZU_VORSICHTIG_KNAPP'));
schreib('vor_ort_noetig.csv', [...new Map(urteile.filter(u => u.methode === 'DESK' && (u.sicherheit !== 'SICHER' || u.urteil === 'UNKLAR')).map(u => [u.nr, { nr: u.nr, seg_id: u.seg_id, strasse: u.strasse, gemeinde: u.gemeinde, sicherheit: u.sicherheit, grund: u.warum }])).values()]);
schreib('ausfall.csv', ausfall);
fs.writeFileSync(path.join(OUT, 'warnungen.txt'), warn.join('\r\n') + '\r\n', 'utf8');
fs.writeFileSync(path.join(OUT, 'kennzahlen.json'), JSON.stringify(K, null, 1), 'utf8');

// Kurzbericht
const L = [];
L.push('# Auswertung Validierungsstichprobe (' + jetzt.toLocaleString('de-CH') + ')', '');
L.push('Erfassungen: ' + erf.length + ' aus ' + dateien.length + ' Datei(en). Abschnitte ausgewertet: ' + K.meta.abschnitte_ausgewertet + ', nicht pruefbar: ' + ausfall.length + ', noch offen (P-Nummern ohne Erfassung): ' + offeneNr.length + '. Warnungen: ' + warn.length + ' (warnungen.txt).', '');
L.push('## Falsch sicher (validiert, aber nicht passierbar)', '', '| Klasse | Schicht | beurteilt | falsch sicher | Rate | 95 %-Intervall | obere Grenze einseitig | knapp | offen |', '|---|---|---|---|---|---|---|---|---|');
for (const c of KL) for (const [h, v] of Object.entries(K.falsch_sicher[c].je_schicht)) L.push('| ' + c + ' | ' + h + ' | ' + v.n + ' | ' + v.x + ' | ' + pct(v.p) + ' | ' + pct(v.unten95) + ' – ' + pct(v.oben95) + ' | ' + pct(v.oben95_einseitig) + ' | ' + v.knapp + ' | ' + v.offen + ' |');
L.push('', 'Gewichtet ueber das Netz (N/n): ' + KL.map(c => c + ' ' + pct(K.falsch_sicher[c].gewichtet_gesamt)).join(', ') + '.');
if (K.hauptaussage_S1a_D) L.push('', '**Hauptaussage (vorab festgelegt):** S1a, Klasse D: ' + K.hauptaussage_S1a_D.fehler + ' Fehler bei ' + K.hauptaussage_S1a_D.beurteilt + ', obere Grenze ' + pct(K.hauptaussage_S1a_D.oben95_einseitig) + ' -> Kriterium < 10 % ' + (K.hauptaussage_S1a_D.kriterium_unter_10_prozent ? 'ERFUELLT' : 'NICHT erfuellt') + (K.hauptaussage_S1a_D.vollstaendig ? '' : ' (Stichprobe noch nicht vollstaendig)') + '.');
L.push('', '## Zu vorsichtig (gesperrt, aber passierbar)', '');
for (const [c, v] of Object.entries(K.zu_vorsichtig)) L.push('- ' + c + ': ' + v.gesamt.x + ' von ' + v.gesamt.n + ' (' + pct(v.gesamt.p) + '), knapp ' + v.knapp + '; je Stufe: ' + Object.entries(v.je_stufe).map(([s, x]) => s + ' ' + x.x + '/' + x.n).join(', ') + (v.mit_fahrverbot_vermerk ? '; mit Fahrverbot-Vermerk ' + v.mit_fahrverbot_vermerk : ''));
L.push('', '## Ungeklaerte Abschnitte', '');
for (const [c, v] of Object.entries(K.ungeklaert)) L.push('- ' + c + ': ' + v.n + ' Abschnitte, passierbar ' + v.passierbar.x + ' (' + pct(v.passierbar.p) + '), knapp ' + v.knapp + ', nicht passierbar ' + v.nicht_passierbar.x + ' (' + pct(v.nicht_passierbar.p) + '), offen ' + v.offen);
L.push('', '## Breite MOPUBE gegen Pruefmessung', '');
for (const [m, v] of Object.entries(K.breite)) L.push('- ' + m + ': n = ' + v.n + ', MOPUBE minus Messung im Mittel ' + (v.differenz_mopube_minus_messung_mittel_m === null ? '–' : v.differenz_mopube_minus_messung_mittel_m.toFixed(2) + ' m') + ', Streuung ' + (v.streuung_m === null ? '–' : v.streuung_m.toFixed(2) + ' m') + '; Messung unter der unteren Schranke: ' + v.messung_unter_unterer_schranke.x + ' von ' + v.messung_unter_unterer_schranke.n + ' (' + pct(v.messung_unter_unterer_schranke.p) + ', erwartet ca. 5 %)');
const Z = K.zuverlaessigkeit, kt = k => k ? 'n = ' + k.n + ', Uebereinstimmung ' + pct(k.uebereinstimmung) + ', kappa ' + k.kappa.toFixed(2) : '–';
L.push('', '## Zuverlaessigkeit der Pruefung', '', '- Zwei Pruefende (Urteil D): ' + kt(Z.zwei_pruefende_klasse_D) + '; Breite mittlere Abweichung ' + (Z.zwei_pruefende_breite_mittlere_abs_differenz_m === null ? '–' : Z.zwei_pruefende_breite_mittlere_abs_differenz_m.toFixed(2) + ' m'),
  '- Desk gegen vor Ort (Urteil D): ' + kt(Z.desk_gegen_vor_ort_klasse_D) + '; Breite mittlere Abweichung ' + (Z.desk_gegen_vor_ort_breite_mittlere_abs_differenz_m === null ? '–' : Z.desk_gegen_vor_ort_breite_mittlere_abs_differenz_m.toFixed(2) + ' m'));
L.push('', '## Dateien', '', '`urteile.csv` (je Abschnitt und Klasse), `fehler_falsch_sicher.csv`, `zu_vorsichtig.csv`, `vor_ort_noetig.csv`, `ausfall.csv`, `warnungen.txt`, `kennzahlen.json`.', '',
  'Nur ausgewertet, was erfasst ist. Gefundene Fehler erst nach Abschluss als Befund in BORS_Befunde.csv uebernehmen (Plan Abschnitt 6).');
fs.writeFileSync(path.join(OUT, 'auswertung.md'), L.join('\n') + '\n', 'utf8');
console.log(L.join('\n'));
