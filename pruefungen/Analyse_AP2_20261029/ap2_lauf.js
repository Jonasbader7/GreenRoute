// AP2: alle Testpaare mit einem Web-Router rechnen (Modus VALIDIERT wie in der App, Rueckfall experimentell inklusive).
// Aufruf: node ap2_lauf.js <bors_router.js> <netz.json> <paare.json> <aus.json> [--v92d]
//   --v92d: Statuswechsel V9.2d (Hinderniskartei, below_default; 7 Abschnitte laut Netzmaster-Bericht 20261029_0931)
//           im Speicher auf das V9.2b-Netz anwenden, damit der Vergleich mit QGIS (Netzmaster V9.2d) fair ist.
const fs = require('fs');
const [, , ROUTER, NETZ, PAARE, AUS] = process.argv;
require(require('path').resolve(ROUTER));
const D = JSON.parse(fs.readFileSync(NETZ, 'utf8'));
if (process.argv.includes('--v92d')) {
  const W = { w4684618: { D: 2 }, w23586279: { B: 1, C: 1, D: 1 }, w25334273: { D: 2 }, w322946731: { D: 2 },
    w753741041: { C: 2, D: 2 }, w1337245698: { B: 1, C: 1, D: 1 }, w1558491001: { D: 2 } };
  const iS = D.attr_cols.indexOf('seg_id'); let n = 0;
  for (let f = 0; f < D.segs.length; f++) {
    const w = W[String(D.attr[f][iS]).split('_')[0]]; if (!w) continue;
    for (const [c, k] of Object.entries(w)) { const v = D.kosten.V[c][f]; D.kat[c][f] = k; D.kosten.V[c][f] = 0; D.kosten.E[c][f] = k === 1 ? v * D.konst.RISIKO_FAKTOR : 0; n++; }
  }
  console.log('V9.2d-Statuswechsel angewendet:', n);
}
const N = new BORS.Netz(D), R = new BORS.Router(N);
const paare = JSON.parse(fs.readFileSync(PAARE, 'utf8'));
const iS = D.attr_cols.indexOf('seg_id');
const out = []; const t0 = Date.now();
for (const p of paare) {
  const p1 = N.lv2rel(p.p1[0], p.p1[1]), p2 = N.lv2rel(p.p2[0], p.p2[1]);
  const res = R.berechne(p1, p2, 'VALIDIERT'), row = { id: p.id };
  for (const c of ['REF', 'A', 'B', 'C', 'D']) {
    const r = res[c];
    if (!r.ok) { row[c] = { ok: false, urs: r.ursache }; continue; }
    const d = r.diag || {};
    row[c] = { ok: true, L: r.laenge_m, mod: r.modell_min, fz: r.fahrzeit_min, modus: r.modus, urs: r.ursache || '',
      rueck: !!r.validiert_ergebnis, dom: r.dominanz_von || '', unval: r.unvalidiert_m || 0,
      ss: d.start_status || '', zs: d.ziel_status || '', f4: !!d.f4, rs: d.start_rest_m || 0, rz: d.ziel_rest_m || 0,
      malus: N.attr(r.rows[0].f, 'klick_malus') * (d.start_status ? 1 : 0) + N.attr(r.rows[r.rows.length - 1].f, 'klick_malus') * (d.ziel_status && d.ziel_status !== 'ZIEL_ZU_FUSS' ? 1 : 0),
      ka: Math.hypot(r.rows[0].pts[0][0] - p1[0], r.rows[0].pts[0][1] - p1[1]),
      ke: (q => Math.hypot(q[0] - p2[0], q[1] - p2[1]))(r.rows[r.rows.length - 1].pts.slice(-1)[0]),
      weg: r.rows.map(x => D.attr[x.f][iS] + ':' + x.a.toFixed(2) + '-' + x.b.toFixed(2)).join(' ') };
  }
  out.push(row);
}
fs.writeFileSync(AUS, JSON.stringify(out));
console.log('gerechnet:', out.length, 'Paare in', ((Date.now() - t0) / 1000).toFixed(0), 's');
