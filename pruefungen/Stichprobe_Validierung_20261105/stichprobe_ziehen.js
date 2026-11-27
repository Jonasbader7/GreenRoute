// BORS Validierungsstichprobe (5.11.2026): geschichtete Zufallsstichprobe von Abschnitten fuer die unabhaengige,
// blinde Pruefung der Netzmaster-Zustaende. Normales node.js, liest nur netz.json (Netz V9.2g, Web V9).
// Aufruf: node stichprobe_ziehen.js [--seed 20261105]
// Ausgabe (Ordner ../stichprobe):
//   pruefliste_blind.csv / .kml   fuer die Pruefenden: ohne BORS-Zustand, gemischte Reihenfolge
//   reserve_blind.csv             Ersatz in fester Reihenfolge je Schicht (nur wenn ein Abschnitt nicht pruefbar ist)
//   erfassung_vorlage.csv         leeres Erfassungsblatt (eine Zeile je Pruefung)
//   SCHLUESSEL_nicht_an_Pruefende.csv  Schicht, Zustand A-D und Gruende je Nr (erst nach der Pruefung oeffnen)
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const SEED = +(ARG.seed || 20261105);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const NETZ = path.join(ROOT, '04_WebApp', 'Entwicklung_V9_Netz_V9_2g', 'netz.json');
const OUT = path.resolve(__dirname, '..', 'stichprobe');
if (fs.existsSync(path.join(OUT, 'pruefliste_blind.csv'))) { console.error('Abbruch: Stichprobe existiert schon (nichts ueberschreiben).'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// Schichten (Partition aller Abschnitte im Untersuchungsgebiet) und Umfang
const SCHICHTEN = [
  { id: 'S1a', text: 'D validiert, oeffentliche Strasse', n: 60, reserve: 30, f: (b, d, sv) => d === 0 && !sv },
  { id: 'S1b', text: 'D validiert, Zufahrt (service)', n: 20, reserve: 10, f: (b, d, sv) => d === 0 && sv },
  { id: 'S2', text: 'B validiert, D ungeklaert', n: 20, reserve: 10, f: (b, d) => d === 1 && b === 0 },
  { id: 'S3', text: 'B und D ungeklaert', n: 30, reserve: 15, f: (b, d) => d === 1 && b !== 0 },
  { id: 'S4', text: 'D gesperrt', n: 30, reserve: 15, f: (b, d) => d === 2 },
];
const N_DOPPELT = 20;   // so viele Abschnitte pruefen zwei Personen unabhaengig (Uebereinstimmung)

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = rng(SEED);
const mischen = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const D = JSON.parse(fs.readFileSync(NETZ, 'utf8'));
const ac = {}; D.attr_cols.forEach((c, i) => ac[c] = i);
const A = (f, c) => D.attr[f][ac[c]];
const X = i => D.nodes[2 * i] / 100 + D.x0, Y = i => D.nodes[2 * i + 1] / 100 + D.y0;
function geom(f) { return D.segs[f][0].map(p => p.map(i => [X(i), Y(i)])); }
function laenge(f) { let L = 0; for (const p of geom(f)) for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function mitte(f) {   // Punkt auf halber Laenge
  const g = geom(f), L = laenge(f); let r = L / 2;
  for (const p of g) for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (r <= l) { const t = l ? r / l : 0; return [p[i - 1][0] + t * (p[i][0] - p[i - 1][0]), p[i - 1][1] + t * (p[i][1] - p[i - 1][1])]; } r -= l; }
  const p = g[g.length - 1]; return p[p.length - 1];
}
function wgs(E, Nn) {   // LV95 -> WGS84, Naeherung swisstopo (ca. 1 m)
  const y = (E - 2600000) / 1e6, x = (Nn - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
  return [p * 100 / 36, l * 100 / 36];
}

// Grundgesamtheit: alle Abschnitte innerhalb des Untersuchungsgebiets, Laenge >= 5 m (kuerzere sind Knotenstuecke)
const pop = {}; SCHICHTEN.forEach(s => pop[s.id] = []);
let ausgeschlossenKurz = 0;
D.attr.forEach((a, f) => {
  if (A(f, 'ausserhalb')) return;
  if (laenge(f) < 5) { ausgeschlossenKurz++; return; }
  const b = D.kat.B[f], d = D.kat.D[f], sv = A(f, 'highway_type') === 'service';
  const s = SCHICHTEN.find(s => s.f(b, d, sv)); pop[s.id].push(f);
});

// Ziehen: einfache Zufallsauswahl ohne Zuruecklegen je Schicht; die Reserve ist die Fortsetzung derselben Zufallsfolge
const haupt = [], reserve = [];
for (const s of SCHICHTEN) {
  const z = mischen(pop[s.id].slice().sort((a, b) => a - b));
  z.slice(0, s.n).forEach(f => haupt.push({ f, s }));
  z.slice(s.n, s.n + s.reserve).forEach((f, i) => reserve.push({ f, s, rang: i + 1 }));
}
mischen(haupt);                                   // gemischte Reihenfolge: die Nummer verraet die Schicht nicht
haupt.forEach((h, i) => h.nr = 'P' + String(i + 1).padStart(3, '0'));
reserve.forEach((r, i) => r.nr = 'R' + String(i + 1).padStart(3, '0'));
const doppelt = new Set(mischen(haupt.map(h => h.nr)).slice(0, N_DOPPELT));

const csvZ = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const schreib = (name, kopf, rows) => fs.writeFileSync(path.join(OUT, name), '﻿' + [kopf.join(';')].concat(rows.map(r => kopf.map(k => csvZ(r[k])).join(';'))).join('\r\n') + '\r\n', 'utf8');

function blind(h) {
  const f = h.f, [E, Nn] = mitte(f), [la, lo] = wgs(E, Nn);
  return { nr: h.nr, seg_id: A(f, 'seg_id'), strasse: A(f, 'name') || '(ohne Namen)', gemeinde: A(f, 'gemeinde'), strassentyp: A(f, 'highway_type'),
    laenge_m: laenge(f).toFixed(0), mitte_E: E.toFixed(1), mitte_N: Nn.toFixed(1), zweitpruefung: doppelt.has(h.nr) ? 'ja' : '',
    orthofoto: 'https://map.geo.admin.ch/?lang=de&center=' + E.toFixed(0) + ',' + Nn.toFixed(0) + '&z=13&bgLayer=ch.swisstopo.swissimage&crosshair=marker',
    streetview: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + la.toFixed(6) + ',' + lo.toFixed(6) };
}
const KB = ['nr', 'seg_id', 'strasse', 'gemeinde', 'strassentyp', 'laenge_m', 'mitte_E', 'mitte_N', 'zweitpruefung', 'orthofoto', 'streetview'];
const hb = haupt.map(blind).sort((a, b) => a.nr.localeCompare(b.nr));
schreib('pruefliste_blind.csv', KB, hb);
schreib('reserve_blind.csv', ['nr', 'ersatz_fuer_gruppe', 'rang'].concat(KB.slice(1)), reserve.map(r => Object.assign(blind(r), { nr: r.nr, ersatz_fuer_gruppe: 'G' + (SCHICHTEN.indexOf(r.s) + 1), rang: r.rang })));
// Gruppe G1..G5 statt Schichtname: Pruefende sehen beim Ersatz nur die Gruppe, nicht den Zustand. Zuordnung im Schluessel.

// Schluessel (nicht an Pruefende)
const T = i => D.texte[i] || '';
const schl = haupt.concat(reserve).map(h => { const f = h.f, o = { nr: h.nr, seg_id: A(f, 'seg_id'), schicht: h.s.id, gruppe: 'G' + (SCHICHTEN.indexOf(h.s) + 1), schicht_text: h.s.text };
  for (const c of ['A', 'B', 'C', 'D']) { o['status_' + c] = ['VALIDIERT', 'UNVALIDIERT', 'GESPERRT'][D.kat[c][f]]; o['grund_' + c] = T(D.grund[c][f]); }
  o.breite_median_m = A(f, 'v9_fahrbahn_median_m'); o.untere_schranke_m = A(f, 'v9_untere_schranke_m'); o.sigma_m = A(f, 'v9_sigma_m'); return o; });
schreib('SCHLUESSEL_nicht_an_Pruefende.csv', Object.keys(schl[0]), schl);

// Leeres Erfassungsblatt
const KE = ['nr', 'seg_id', 'pruefer', 'datum', 'methode', 'pruefbar', 'grund_nicht_pruefbar',
  'engste_breite_fest_m', 'breite_mit_parkierung_m', 'ort_engste_stelle', 'parkfelder', 'ueberbauung_oder_unterfuehrung', 'lichte_hoehe_m', 'hoehe_quelle',
  'schild_hoechstgewicht_t', 'schild_hoechsthoehe_m', 'schild_hoechstbreite_m', 'schild_fahrverbot', 'hindernis_fest', 'hindernis_oeffenbar',
  'bruecke', 'steigung_auffaellig', 'kurve_eng', 'aufnahmedatum_bild', 'beleg', 'sicherheit', 'bemerkung'];
schreib('erfassung_vorlage.csv', KE, []);

// KML fuer map.geo.admin (Zeichnung importieren): Abschnitte als Linien mit Nr
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const pm = haupt.slice().sort((a, b) => a.nr.localeCompare(b.nr)).map(h => {
  const lines = geom(h.f).map(p => '<LineString><coordinates>' + p.map(([E, Nn]) => { const [la, lo] = wgs(E, Nn); return lo.toFixed(7) + ',' + la.toFixed(7); }).join(' ') + '</coordinates></LineString>').join('');
  return '<Placemark><name>' + h.nr + '</name><description>' + esc((A(h.f, 'name') || '(ohne Namen)') + ', ' + A(h.f, 'gemeinde')) + '</description><styleUrl>#s</styleUrl><MultiGeometry>' + lines + '</MultiGeometry></Placemark>';
}).join('\n');
fs.writeFileSync(path.join(OUT, 'pruefliste_blind.kml'), '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>BORS Stichprobe (blind)</name><Style id="s"><LineStyle><color>ff00a5ff</color><width>6</width></LineStyle></Style>\n' + pm + '\n</Document></kml>\n', 'utf8');

const meta = { erstellt: new Date().toISOString(), netz: D.netz, seed: SEED, ausgeschlossen_kuerzer_5m: ausgeschlossenKurz,
  schichten: SCHICHTEN.map(s => ({ id: s.id, gruppe: 'G' + (SCHICHTEN.indexOf(s) + 1), text: s.text, N: pop[s.id].length, n: s.n, reserve: s.reserve })), zweitpruefung: N_DOPPELT };
fs.writeFileSync(path.join(OUT, 'stichprobe_meta.json'), JSON.stringify(meta, null, 1), 'utf8');
console.log(JSON.stringify(meta, null, 1));
const typ = {}; haupt.forEach(h => { const k = h.s.id + ' ' + A(h.f, 'gemeinde'); typ[k] = (typ[k] || 0) + 1; });
console.log(Object.entries(typ).sort().map(([k, v]) => k + ': ' + v).join(' | '));
