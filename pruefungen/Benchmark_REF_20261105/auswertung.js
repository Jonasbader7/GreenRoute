// BORS Benchmark REF: Nachauswertung der Ergebnisse von benchmark_ref.js (5.11.2026). Normales node.js.
// 1. Empfindlichkeit Klasse D: Welche D-Sperren auf REF-Routen faellen weg, wenn statt Wasserwerfer (28.44 t, 3.66 m)
//    das G-TLF 16 (26 t, 3.40 m) massgebend waere? Naeherung ueber die Grenzwerte im Sperrgrund, KEIN Netzmaster-Lauf
//    (Breite und uebrige Kriterien bleiben wie heute).
// 2. Moeglich regulatorische Gewichtssignale: OSM-Hoechstgewicht <= 3.5 t (oft Fahrverbot, nicht Tragfaehigkeit).
// 3. Faelle fuer die Praesentation in drei Gruppen.
'use strict';
const fs = require('fs'), path = require('path');
const E = path.resolve(__dirname, '..', 'ergebnisse');
if (fs.existsSync(path.join(E, 'auswertung_kennzahlen.json'))) { console.error('Abbruch: Auswertung existiert schon.'); process.exit(1); }
function lies(n) {
  const t = fs.readFileSync(path.join(E, n), 'utf8').replace(/^﻿/, '').trim().split(/\r\n/), k = t[0].split(';');
  return t.slice(1).map(l => { const v = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) { const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ';') { v.push(cur); cur = ''; } else cur += ch; }
    v.push(cur); const o = {}; k.forEach((x, i) => o[x] = v[i]); return o; });
}
const F = lies('benchmark_fahrten.csv'), S = lies('benchmark_sperrstellen.csv');
const csvZ = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const schreib = (name, kopf, rows) => fs.writeFileSync(path.join(E, name), '﻿' + [kopf.join(';')].concat(rows.map(r => kopf.map(k => csvZ(r[k])).join(';'))).join('\r\n') + '\r\n', 'utf8');

// Grenzwert aus dem Sperrgrund
function grenze(grund) {
  let m = grund.match(/^Gewicht: (?:Hoechstgewicht|Signal) ([0-9.]+) t/); if (m) return { art: 'GEWICHT', wert: +m[1] };
  m = grund.match(/^Hoehe: (?:Hoechsthoehe|Signal) ([0-9.]+) m/); if (m) return { art: 'HOEHE', wert: +m[1] };
  m = grund.match(/^Hindernis: Hoehenbegrenzer ([0-9.]+) m/); if (m) return { art: 'HOEHE', wert: +m[1] };
  return { art: 'ANDERE', wert: null };
}
const GTLF = { t: 26.0, h: 3.40 };
const bleibtMitGTLF = s => { const g = grenze(s.grund); if (g.art === 'GEWICHT') return g.wert < GTLF.t; if (g.art === 'HOEHE') return g.wert < GTLF.h; return true; };
const regulatorischMoeglich = s => s.stufe === 'SIGNAL_OSM_KSVB' && /^Gewicht: Hoechstgewicht ([0-9.]+) t .*OSM_SIGNAL/.test(s.grund) && grenze(s.grund).wert <= 3.5;

const out = {};
for (const sp of ['VERTEILT', 'GEZIELT']) {
  // 1. Empfindlichkeit D
  const dGes = F.filter(f => f.stichprobe === sp && f.klasse === 'D' && f.ref_konflikt.startsWith('GESPERRT'));
  let bleibt = 0, bleibtAmtl = 0; const wegfall = {};
  for (const f of dGes) {
    const st = S.filter(s => s.fahrt_id === f.fahrt_id && s.klasse === 'D');
    const rest = st.filter(bleibtMitGTLF);
    if (rest.length) { bleibt++; if (rest.some(s => s.stufe === 'AMTLICH')) bleibtAmtl++; }
    st.filter(s => !bleibtMitGTLF(s)).forEach(s => { const k = s.strasse + ' (' + s.grund.split('(')[0].trim() + ')'; wegfall[k] = (wegfall[k] || 0) + 1; });
  }
  // 2. regulatorisch moegliche Signale
  const reg = {};
  for (const c of ['B', 'C', 'D']) {
    const ges = F.filter(f => f.stichprobe === sp && f.klasse === c && f.ref_konflikt.startsWith('GESPERRT'));
    const nurReg = ges.filter(f => { const st = S.filter(s => s.fahrt_id === f.fahrt_id && s.klasse === c); return st.length && st.every(regulatorischMoeglich); });
    reg[c] = { gesperrt: ges.length, nur_moeglich_regulatorisch: nurReg.length };
  }
  out[sp] = { D_gesperrt_heute: dGes.length, D_gesperrt_mit_GTLF16_naeherung: bleibt, davon_amtlich: bleibtAmtl,
    D_wegfallende_stellen: Object.entries(wegfall).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ': ' + v), regulatorisch: reg };
}

// 3. Praesentationsfaelle
const fall = (gruppe, f, warum) => ({ gruppe, fahrt_id: f.fahrt_id, stichprobe: f.stichprobe, klasse: f.klasse, ziel: (f.ziel_strasse || '(ohne Name)') + ', ' + f.ziel_gemeinde,
  ziel_E: f.ziel_E, ziel_N: f.ziel_N, ref_konflikt: f.ref_konflikt, stelle: f.erste_sperre_strasse, grund: f.erste_sperre_grund, ref_min: f.ref_fahrzeit_min, ref_m: f.ref_laenge_m,
  bors_modus: f.bors_modus, bors_min: f.bors_fahrzeit_min, bors_m: f.bors_laenge_m, bors_m_ungeklaert: f.bors_m_ungeklaert, ueberlappung_pct: f.ueberlappung_pct, warum, google_maps: f.google_maps, map_geo_admin_stelle: f.map_geo_admin_stelle });
const faelle = [];
// Gruppe 1: amtlich belegt, BORS durchgehend validiert, Route deutlich anders; je Stelle einer, C bevorzugt (Grenze gilt auch fuer G-TLF 16)
const g1 = F.filter(f => f.ref_konflikt === 'GESPERRT_AMTLICH' && f.ergebnis === 'GESPERRT_BORS_DURCHGEHEND_VALIDIERT' && +f.ueberlappung_pct < 80)
  .sort((a, b) => (a.klasse === 'C' ? 0 : 1) - (b.klasse === 'C' ? 0 : 1) || (+a.bors_fahrzeit_min - +a.ref_fahrzeit_min) - (+b.bors_fahrzeit_min - +b.ref_fahrzeit_min));
const schon = new Set();
for (const f of g1) { if (schon.has(f.erste_sperre_strasse)) continue; schon.add(f.erste_sperre_strasse); faelle.push(fall('1_AMTLICH_ANDERE_ROUTE', f, 'amtliche Grenze auf der REF-Route, BORS durchgehend validiert')); if (schon.size >= 6) break; }
// Gruppe 2: BORS vorsichtig - REF nur ungeklaert oder BORS nur mit ungeklaerten Abschnitten
const g2a = F.filter(f => f.stichprobe === 'VERTEILT' && f.klasse === 'D' && f.ergebnis === 'GESPERRT_BORS_MIT_UNGEKLAERTEN');
const g2b = F.filter(f => f.stichprobe === 'VERTEILT' && f.klasse === 'C' && f.ref_konflikt === 'NUR_UNGEKLAERT' && f.bors_modus === 'EXPERIMENTELL' && +f.bors_m_ungeklaert > 0)
  .sort((a, b) => +b.bors_m_ungeklaert - +a.bors_m_ungeklaert);
g2a.slice(0, 2).forEach(f => faelle.push(fall('2_VORSICHTIG', f, 'REF gesperrt, BORS findet nur eine Route mit ungeklaerten Abschnitten (gelb, x2)')));
g2b.slice(0, 2).forEach(f => faelle.push(fall('2_VORSICHTIG', f, 'keine durchgehend validierte Route: BORS zeigt ungeklaerte Abschnitte offen an, behauptet kein Hindernis')));
// Gruppe 3: identisch, D, verteilt, laengere Fahrten
const g3 = F.filter(f => f.stichprobe === 'VERTEILT' && f.klasse === 'D' && f.gleich_wie_ref === '1' && f.ref_konflikt === 'KEIN_KONFLIKT').sort((a, b) => +b.ref_laenge_m - +a.ref_laenge_m);
g3.slice(0, 3).forEach(f => faelle.push(fall('3_IDENTISCH', f, 'REF und BORS fahren Abschnitt fuer Abschnitt gleich')));
schreib('faelle_praesentation.csv', Object.keys(faelle[0]), faelle);

// Abbiegen (Modell Schleppkurve): REF gegen BORS
const abb = {};
for (const sp of ['VERTEILT', 'GEZIELT']) for (const c of ['B', 'C', 'D']) {
  const z = F.filter(f => f.stichprobe === sp && f.klasse === c && f.ref_ok === '1');
  abb[sp + '_' + c] = { ref_mit_unmoeglichem_manoever: z.filter(f => +f.ref_n_abbiegen_unmoeglich > 0).length, bors_mit_unmoeglichem_manoever: z.filter(f => +f.bors_n_abbiegen_unmoeglich > 0).length, fahrten: z.length };
}
// Zeitdifferenz-Vorzeichen: BORS-Modellfahrzeit kuerzer als REF (Sonderrecht, keine Verkehrsregeln ausser Einbahn)
const vz = {};
for (const sp of ['VERTEILT', 'GEZIELT']) for (const c of ['A', 'B', 'C', 'D']) {
  const z = F.filter(f => f.stichprobe === sp && f.klasse === c && f.ref_ok === '1' && f.bors_ok === '1');
  vz[sp + '_' + c] = { bors_kuerzer: z.filter(f => +f.bors_fahrzeit_min < +f.ref_fahrzeit_min - 0.05).length, gleich: z.filter(f => Math.abs(+f.bors_fahrzeit_min - +f.ref_fahrzeit_min) <= 0.05).length, bors_laenger: z.filter(f => +f.bors_fahrzeit_min > +f.ref_fahrzeit_min + 0.05).length };
}
const res = { empfindlichkeit_D_und_regulatorisch: out, abbiegen: abb, fahrzeit_vorzeichen: vz, faelle: faelle.length };
fs.writeFileSync(path.join(E, 'auswertung_kennzahlen.json'), JSON.stringify(res, null, 1), 'utf8');
console.log(JSON.stringify(res, null, 1));
faelle.forEach(f => console.log(f.gruppe, f.fahrt_id, f.klasse, f.ziel, '|', f.stelle, '|', (f.grund || '').slice(0, 70), '|', f.ref_min, '->', f.bors_min, f.bors_modus, f.ueberlappung_pct + '%'));
