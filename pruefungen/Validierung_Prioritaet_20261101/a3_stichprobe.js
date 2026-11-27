// Stichprobe mit dem echten Web-Router (V9.2c): Hauptwache -> zufaellige Ziele, Ergebnisart je Klasse.
// Szenarien: Ist-Zustand, Top-3 / Top-25 / Top-100 der Lueckenliste (wirkung.json) als validiert angenommen.
// Aufruf: node a3_stichprobe.js <webapp-ordner> <wirkung.json> <anzahl>
const fs = require('fs'), path = require('path');
const dir = process.argv[2], W = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), ANZ = +process.argv[4] || 200;
require(path.join(dir, 'bors_router.js'));
const roh = fs.readFileSync(path.join(dir, 'netz.json'), 'utf8');
let seed = 20261101; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const D0 = JSON.parse(roh), N0 = new BORS.Netz(D0);
const fi = D0.attr_cols.indexOf('seg_id'), ai = D0.attr_cols.indexOf('ausserhalb'), si = D0.attr_cols.indexOf('ist_service');
const kand = []; D0.attr.forEach((a, f) => { if (!a[ai]) kand.push(f); });
const ziele = [];
while (ziele.length < ANZ) {   // Ziel nach Laenge gewichtet: zufaelliger Punkt auf einem zufaelligen Abschnitt
  const f = kand[Math.floor(rnd() * kand.length)], F = N0.feat[f];
  if (rnd() * 300 > F.L) continue;
  const ids = F.ids[0], i = Math.floor(rnd() * (ids.length - 1)), t = rnd();
  ziele.push([N0.x[ids[i]] + t * (N0.x[ids[i + 1]] - N0.x[ids[i]]), N0.y[ids[i]] + t * (N0.y[ids[i + 1]] - N0.y[ids[i]])]);
}
const wa = D0.wachen[0], p1 = [wa[1] / 100, wa[2] / 100];
const idx = new Map(D0.attr.map((a, f) => [a[fi], f]));
function lauf(n) {
  const D = JSON.parse(roh);
  for (const c of 'ABCD') for (const e of W.klassen[c].liste.slice(0, n)) {
    const f = idx.get(e.seg_id); if (D.kat[c][f] !== 1) continue;
    D.kat[c][f] = 0; D.kosten.E[c][f] /= D.konst.RISIKO_FAKTOR; D.kosten.V[c][f] = D.kosten.E[c][f];
  }
  const R = new BORS.Router(new BORS.Netz(D)), z = {};
  for (const p2 of ziele) {
    const res = R.berechne(p1, p2, 'VALIDIERT');
    for (const c of 'ABCD') { const r = res[c]; const k = !r.ok ? 'KEINE_ROUTE' : r.modus; z[c] = z[c] || {}; z[c][k] = (z[c][k] || 0) + 1; }
  }
  return z;
}

// Ist-Zustand: Haeufigkeit unvalidierter Abschnitte in Hauptroute (V-Lauf) und Alternative (E-Lauf)
const R = new BORS.Router(N0), H = {}, Z = {};
const t0 = Date.now();
ziele.forEach((p2, zi) => {
  const V = R.berechne(p1, p2, 'VALIDIERT'), E = R.berechne(p1, p2, 'EXPERIMENTELL');
  for (const c of 'ABCD') {
    const v = V[c], e = E[c]; Z[c] = Z[c] || { haupt: {}, alt_mit_gelb: 0, alt_gelb_m: 0, n: 0 }; const z = Z[c]; z.n++;
    const k = !v.ok ? 'KEINE_ROUTE' : v.modus; z.haupt[k] = (z.haupt[k] || 0) + 1;
    const add = (f, wo, L) => { const key = c + ':' + f; const h = H[key] = H[key] || { c, f, haupt: 0, alt: 0, m: 0 }; h[wo]++; h.m += L; };
    if (v.ok) { const seen = new Set(); v.rows.forEach(x => { if (x.kat === 1 && !seen.has(x.f)) { seen.add(x.f); add(x.f, 'haupt', x.L); } }); }
    if (e.ok) { const g = e.rows.filter(x => x.kat === 1); if (g.length) { z.alt_mit_gelb++; z.alt_gelb_m += g.reduce((s, x) => s + x.L, 0); }
      const seen = new Set(); g.forEach(x => { if (!seen.has(x.f)) { seen.add(x.f); add(x.f, 'alt', x.L); } }); }
  }
  if (zi % 25 === 24) console.error(zi + 1, ((Date.now() - t0) / 1000).toFixed(0) + ' s');
});
const sa = D0.attr_cols.indexOf.bind(D0.attr_cols);
const liste = Object.values(H).map(h => ({ klasse: h.c, seg_id: D0.attr[h.f][fi], name: D0.attr[h.f][sa('name')], gemeinde: D0.attr[h.f][sa('gemeinde')], hw: D0.attr[h.f][sa('highway_type')],
  laenge_m: Math.round(N0.feat[h.f].L), in_hauptroute: h.haupt, in_alternative: h.alt }));
fs.writeFileSync(process.argv[5] || 'stichprobe.json', JSON.stringify({ ziele: ziele.length, Z, liste }));
for (const c of 'ABCD') console.log(c, JSON.stringify(Z[c]));
