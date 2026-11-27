// BORS: Abgleich der Geoportal-Ebenen der Stadt Bern (Abruf mit 30_Stadt_Geoportal_Abruf_BORS.py) mit dem BORS-Netz V9.2g
// (netz.json der Web-App V9). Normales node.js, nur lesen. Aufruf: node abgleich_geoportal.js [--geo <Abrufordner>]
// Ergebnis: ../ergebnisse/*.csv und abgleich_kennzahlen.json (bricht ab, wenn es sie schon gibt).
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ROOT = path.resolve(__dirname, '..', '..', '..');
const STADT = path.join(ROOT, '02_Daten', '1_Rohdaten', 'Stadt_Bern');
const GEO = ARG.geo ? path.resolve(ARG.geo) : path.join(STADT, fs.readdirSync(STADT).filter(d => /^Geoportal_\d{8}_\d{4}$/.test(d)).sort().pop());
const WEB = path.join(ROOT, '04_WebApp', 'Entwicklung_V9_Netz_V9_2g');
const OUT = path.resolve(__dirname, '..', 'ergebnisse');
if (fs.existsSync(path.join(OUT, 'abgleich_kennzahlen.json'))) { console.error('Abbruch: Ergebnisse existieren schon.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const g = {}; new Function('globalThis', 'window', fs.readFileSync(path.join(WEB, 'bors_router.js'), 'utf8'))(g, undefined);
const D = JSON.parse(fs.readFileSync(path.join(WEB, 'netz.json'), 'utf8'));
const N = new g.BORS.Netz(D), A = (f, c) => N.attr(f, c);
const geo = n => JSON.parse(fs.readFileSync(path.join(GEO, n + '.geojson'), 'utf8')).features;
const T = i => D.texte[i] || '';
const ST = ['VALIDIERT', 'UNGEKLAERT', 'GESPERRT'];
const csvZ = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const schreib = (name, rows) => { const kopf = rows.length ? Object.keys(rows[0]) : ['leer']; fs.writeFileSync(path.join(OUT, name), '﻿' + [kopf.join(';')].concat(rows.map(r => kopf.map(k => csvZ(r[k])).join(';'))).join('\r\n') + '\r\n', 'utf8'); };
const K = { meta: { erstellt: new Date().toISOString(), geoportal: GEO, netz: D.netz } };

// Hilfen: Abschnitt verdichtet (alle 2 m) und Linien-Raster
function punkteAbschnitt(f, step) { const F = N.feat[f], o = []; F.ids.forEach(ids => { for (let i = 1; i < ids.length; i++) { const x0 = N.x[ids[i - 1]], y0 = N.y[ids[i - 1]], x1 = N.x[ids[i]], y1 = N.y[ids[i]], l = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(l / step)); for (let k = 0; k < n; k++) o.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]); } const z = ids[ids.length - 1]; o.push([N.x[z], N.y[z]]); }); return o; }
function linienRaster(feats, G) {
  const grid = new Map();
  feats.forEach((ft, idx) => { const gm = ft.geometry; if (!gm) return; const ps = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
    ps.forEach(p => { for (let i = 1; i < p.length; i++) { const x0 = p[i - 1][0] - D.x0, y0 = p[i - 1][1] - D.y0, x1 = p[i][0] - D.x0, y1 = p[i][1] - D.y0, l = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(l / 2));
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n, key = Math.floor(x / G) + ':' + Math.floor(y / G); if (!grid.has(key)) grid.set(key, []); grid.get(key).push([x, y, idx]); } } }); });
  return { G, grid };
}
function naechsteLinie(R, x, y, d) { const cx = Math.floor(x / R.G), cy = Math.floor(y / R.G); let best = null; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = R.grid.get((cx + i) + ':' + (cy + j)); if (a) for (const [px, py, idx] of a) { const dd = Math.hypot(px - x, py - y); if (dd <= d && (!best || dd < best[0])) best = [dd, idx]; } } return best; }
// Abschnitt -> Linienobjekt, wenn >= 80 % seiner Punkte <= d m an derselben Linie liegen
function zuordnen(R, f, d) { const pts = punkteAbschnitt(f, 2), z = new Map(); let n = 0; for (const [x, y] of pts) { const b = naechsteLinie(R, x, y, d); if (b) { n++; z.set(b[1], (z.get(b[1]) || 0) + 1); } } if (!pts.length || n / pts.length < 0.8) return null; let best = null; z.forEach((c, idx) => { if (!best || c > best[1]) best = [idx, c]; }); return { idx: best[0], anteil: n / pts.length }; }
const inStadt = f => !A(f, 'ausserhalb') && A(f, 'gemeinde') === 'Bern';

// ------------------------------------------------------------------ 1. Polleranlagen
const poller = geo('polleranlagen').map(ft => {
  const [E, Nn] = ft.geometry.coordinates, x = E - D.x0, y = Nn - D.y0, nn = N.nearest(x, y, 1, 15)[0], p = ft.properties;
  const o = { name: p.Name, regel: p.Ausnahmen_vom_Fahrverbot, typ: p.Typ_beschrieb, E: E.toFixed(1), N: Nn.toFixed(1) };
  if (!nn) return Object.assign(o, { seg_id: '', bewertung: 'KEIN_ABSCHNITT_15M' });
  const f = nn[1], pk = N.punkte.get(f) || [], txt = pk.map(q => T(q[3])).join(' | ');
  const pos = nn[2][3], nahe = pk.filter(q => q[0] === nn[2][1] && Math.abs(q[1] - pos) <= 15);
  Object.assign(o, { seg_id: A(f, 'seg_id'), strasse: A(f, 'name') || '', abstand_m: nn[0].toFixed(1), web_punkte_15m: nahe.length, web_punkte_texte: txt,
    fest: nahe.some(q => q[2]) ? 'ja' : '', REF: D.kosten.V.REF[f] > 0 ? 'befahrbar' : 'gesperrt', A: ST[D.kat.A[f]], D: ST[D.kat.D[f]] });
  o.bewertung = nahe.length ? 'IM_WEB_ALS_PUNKT' : 'FEHLT_IM_WEB';
  o.offen = /Dauersperre/.test(p.Ausnahmen_vom_Fahrverbot || '') ? 'Kann SRB oeffnen? (Dauersperre)' : 'Kann SRB oeffnen? Zeitfenster: ' + (p.Ausnahmen_vom_Fahrverbot || '');
  return o;
});
schreib('poller.csv', poller);
K.poller = { anzahl: poller.length, im_web_als_punkt: poller.filter(p => p.bewertung === 'IM_WEB_ALS_PUNKT').length, fehlt_im_web: poller.filter(p => p.bewertung === 'FEHLT_IM_WEB').length,
  dauersperre: poller.filter(p => /Dauersperre/.test(p.regel || '')).length, dauersperre_fehlt_im_web: poller.filter(p => /Dauersperre/.test(p.regel || '') && p.bewertung === 'FEHLT_IM_WEB').length };

// ------------------------------------------------------------------ 2. Bus- und Trolleybuslinien
const oev = geo('oev_linien'), bus = oev.filter(ft => /^(Bus|Trolleybus)$/.test(ft.properties.Verkehrsmittel_typ));
const RB = linienRaster(bus, 10), busZ = [];
N.feat.forEach((F, f) => {
  if (A(f, 'ausserhalb')) return;
  const ks = ['A', 'B', 'C', 'D'].filter(c => D.kat[c][f] !== 0); if (!ks.length) return;
  const z = zuordnen(RB, f, 4); if (!z) return;
  const l = bus[z.idx].properties;
  for (const c of ks) busZ.push({ seg_id: A(f, 'seg_id'), strasse: A(f, 'name') || '', gemeinde: A(f, 'gemeinde'), laenge_m: F.L.toFixed(0), klasse: c, status: ST[D.kat[c][f]],
    grund: T(D.grund[c][f]).slice(0, 200), linie: l.Linienname || l.Nummer_linie, verkehrsmittel: l.Verkehrsmittel_typ, betreiber: l.Betreiber, anteil_auf_linie: (100 * z.anteil).toFixed(0) });
});
schreib('buslinien_nicht_validiert.csv', busZ);
K.buslinien = {};
for (const c of ['A', 'B', 'C', 'D']) { const z = busZ.filter(r => r.klasse === c); K.buslinien[c] = { ungeklaert: z.filter(r => r.status === 'UNGEKLAERT').length, ungeklaert_km: +(z.filter(r => r.status === 'UNGEKLAERT').reduce((s, r) => s + +r.laenge_m, 0) / 1000).toFixed(1), gesperrt: z.filter(r => r.status === 'GESPERRT').length }; }

// ------------------------------------------------------------------ 3. Baustellen heute gegen netz.json (Stand 28.10.2026)
function inPoly(x, y, rings) { let inn = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inn = !inn; } return inn; }
const jetzt = Date.now(), bauFl = geo('baustellen').map(f => Object.assign(f, { art: 'Baustelle' })).concat(geo('installationsplaetze').map(f => Object.assign(f, { art: 'Installationsplatz' })));
const aktiv = bauFl.filter(ft => ft.properties.Startdate && ft.properties.Enddate && ft.properties.Startdate <= jetzt && ft.properties.Enddate >= jetzt);
const bauHeute = new Map();
for (const ft of aktiv) {
  const gm = ft.geometry, polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  for (const poly of polys) {
    const rings = poly.map(r => r.map(([E, Nn]) => [E - D.x0, Nn - D.y0])); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings[0].forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const cand = new Set(); for (let gx = Math.floor(x0 / N.G); gx <= Math.floor(x1 / N.G); gx++) for (let gy = Math.floor(y0 / N.G); gy <= Math.floor(y1 / N.G); gy++) { const s = N.grid.get(gx * 100000 + gy); if (s) s.forEach(f => cand.add(f)); }
    cand.forEach(f => { if (punkteAbschnitt(f, 2).some(([x, y]) => inPoly(x, y, rings))) { if (!bauHeute.has(f)) bauHeute.set(f, []); bauHeute.get(f).push(ft.art + ' ' + (ft.properties.Displaynumber || '') + ' ' + (ft.properties.Locality || '') + ' bis ' + new Date(ft.properties.Enddate).toISOString().slice(0, 10)); } });
  }
}
const bauWeb = new Set(D.bau.filter(b => /Stadt Bern/.test(b[2])).map(b => b[0]));
const bauZ = [];
new Set([...bauHeute.keys(), ...bauWeb]).forEach(f => bauZ.push({ seg_id: A(f, 'seg_id'), strasse: A(f, 'name') || '', in_netz_json_28_10: bauWeb.has(f) ? 'ja' : '', aktiv_heute: bauHeute.has(f) ? 'ja' : '',
  bewertung: bauWeb.has(f) && bauHeute.has(f) ? 'WEITER_AKTIV' : bauWeb.has(f) ? 'BEENDET_ODER_VERSCHOBEN' : 'NEU_SEIT_28_10', baustellen_heute: (bauHeute.get(f) || []).join(' | ') }));
schreib('baustellen_heute_gegen_web.csv', bauZ);
K.baustellen = { flaechen_gesamt: bauFl.length, aktiv_heute: aktiv.length, abschnitte_heute: bauHeute.size, abschnitte_web_28_10: bauWeb.size,
  weiter_aktiv: bauZ.filter(r => r.bewertung === 'WEITER_AKTIV').length, beendet: bauZ.filter(r => r.bewertung === 'BEENDET_ODER_VERSCHOBEN').length, neu: bauZ.filter(r => r.bewertung === 'NEU_SEIT_28_10').length };

// ------------------------------------------------------------------ 4. Steigung und 5. Hoechstgeschwindigkeit (Stadtstrassen)
const stg = geo('steigungen'), RS = linienRaster(stg, 10), hg = geo('hoechstgeschwindigkeit'), RH = linienRaster(hg, 10);
const stZ = [], vZ = []; let nS = 0, nH = 0;
N.feat.forEach((F, f) => {
  if (!inStadt(f) || F.L < 10) return;
  const z = zuordnen(RS, f, 4);
  if (z) { nS++; const s = Math.abs(+stg[z.idx].properties.Steigung), b = A(f, 'steigung_max_pct');
    if (b !== null && b !== undefined && Math.abs(s - b) >= 4) stZ.push({ seg_id: A(f, 'seg_id'), strasse: A(f, 'name') || '', stadt_steigung_pct: s.toFixed(1), bors_steigung_max_pct: (+b).toFixed(1), differenz: (b - s).toFixed(1),
      bors_hinweis_C: /Steigung/.test(T(D.grund.C[f])) ? 'ja' : '', status_D: ST[D.kat.D[f]] }); }
  const h = zuordnen(RH, f, 4);
  if (h && hg[h.idx].properties.V_sig) { nH++; vZ.push({ v_sig: +hg[h.idx].properties.V_sig, bors_kmh: +A(f, 'speed'), L: F.L }); }
});
schreib('steigung_abweichungen.csv', stZ);
const vs = {}; vZ.forEach(r => { const k = r.v_sig + ' km/h signalisiert'; vs[k] = vs[k] || { abschnitte: 0, km: 0, bors_kmh: {} }; vs[k].abschnitte++; vs[k].km += r.L / 1000; vs[k].bors_kmh[r.bors_kmh] = (vs[k].bors_kmh[r.bors_kmh] || 0) + 1; });
Object.values(vs).forEach(v => v.km = +v.km.toFixed(1));
K.steigung = { zugeordnet: nS, abweichung_ab_4_prozentpunkte: stZ.length, bors_hoeher: stZ.filter(r => +r.differenz > 0).length, bors_tiefer: stZ.filter(r => +r.differenz < 0).length };
K.hoechstgeschwindigkeit = { zugeordnet: nH, verteilung: vs };

fs.writeFileSync(path.join(OUT, 'abgleich_kennzahlen.json'), JSON.stringify(K, null, 1), 'utf8');
console.log(JSON.stringify(K, null, 1));
