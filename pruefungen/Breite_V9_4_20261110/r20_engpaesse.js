// Engpaesse der Routen: welche ungeklaerten Abschnitte machen am haeufigsten eine Route ungesichert? Nur lesend.
// Aufruf: node r20_engpaesse.js <webapp_ordner> <ausgabe_prefix> [zufallspaare=500]
// Paare wie r14 (Seed 20261111): Wachen BF/RD -> 64 Zufallsziele, dazu Zufallspaare. Je Klasse A-D Modus VALIDIERT (wie die App).
// Ist das Ergebnis EXPERIMENTELL oder VALIDIERT_BIS_ZUFAHRT, zaehlt jeder ungeklaerte Abschnitt (kat 1) der Route:
//   routen = Anzahl Routen (Paar x Klasse), in denen er vorkommt; einzig = Routen, in denen er der EINZIGE ungeklaerte ist
//   (ihn zu klaeren macht diese Route direkt validiert bzw. bis Zufahrt kuerzer).
// Ausgabe: <prefix>.csv (seg_id;name;highway;laenge_m;routen;einzig;routen_A..D;grund_A..D), <prefix>.txt (Zusammenfassung).
const fs = require('fs');
const [dir, out, nP] = process.argv.slice(2); const NPAAR = +(nP || 500);
const g = {}; new Function('globalThis', 'window', fs.readFileSync(dir + '/bors_router.js', 'utf8'))(g, g);
const D = JSON.parse(fs.readFileSync(dir + '/netz.json', 'utf8')); const R = new g.BORS.Router(new g.BORS.Netz(D));
const K = ['A', 'B', 'C', 'D'], ai = D.attr_cols.indexOf('ausserhalb'), ni = D.attr_cols.indexOf('name'), hi = D.attr_cols.indexOf('highway_type'), LEN = {};
const rel = ([E, n]) => [E - D.x0, n - D.y0];
let seed = 20261111; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const innen = []; for (let f = 0; f < D.segs.length; f++) if (!D.attr[f][ai]) innen.push(f);
const pt = () => { const f = innen[Math.floor(rnd() * innen.length)], ids = D.segs[f][0][0], n = ids[Math.floor(rnd() * ids.length)]; return [D.nodes[2 * n] / 100 + (rnd() - 0.5) * 20, D.nodes[2 * n + 1] / 100 + (rnd() - 0.5) * 20]; };
const P = [];
const W = [['BF', [2598307.75, 1200148.75]], ['RD', [2598133.0, 1199905.375]]];
for (let i = 0; i < 64; i++) { const z = pt(); W.forEach(([w, p]) => P.push([w + '_' + i, rel(p), z, true])); }
for (let i = 0; i < NPAAR; i++) P.push(['Z' + i, pt(), pt(), false]);
const S = {}, modi = {};
const t0 = Date.now();
for (const [id, p1, p2, snap] of P) {
  let a = p1, b = p2;
  if (snap) { const x = R.snap(p1, 30), y = R.snap(p2, 30); if (!x || !y) continue; a = [x[0], x[1]]; b = [y[0], y[1]]; }
  const res = R.berechne(a, b, 'VALIDIERT');
  for (const c of K) {
    const r = res[c]; const m = r && r.ok ? r.modus : 'KEINE'; modi[c + ' ' + m] = (modi[c + ' ' + m] || 0) + 1;
    if (!r || !r.ok || r.modus === 'VALIDIERT') continue;
    const rows = r.rows; let i0 = 0, i1 = rows.length - 1;
    while (i0 < rows.length && D.kat[c][rows[i0].f] !== 0) i0++;        // fuehrende Zufahrt (ungeklaert ab Start)
    while (i1 >= 0 && D.kat[c][rows[i1].f] !== 0) i1--;                  // abschliessende Zufahrt (ungeklaert bis Ziel)
    const fs_ = [...new Set(rows.filter(q => D.kat[c][q.f] === 1).map(q => q.f))];
    const mitte = new Set(rows.filter((q, j) => j > i0 && j < i1 && D.kat[c][q.f] === 1).map(q => q.f));
    for (const q of rows) LEN[q.f] = (LEN[q.f] || 0) < q.L ? q.L : LEN[q.f];
    for (const f of fs_) {
      const s = S[f] = S[f] || { routen: 0, einzig: 0, durchgang: 0, k: { A: 0, B: 0, C: 0, D: 0 } };
      s.routen++; s.k[c]++; if (fs_.length === 1) s.einzig++; if (mitte.has(f)) s.durchgang++;
    }
  }
}
const z = Object.entries(S).sort((x, y) => (y[1].durchgang - x[1].durchgang) || (y[1].routen - x[1].routen));
const T = D.texte;
const zeilen = [['seg_id', 'name', 'highway', 'laenge_m', 'routen', 'einzig', 'durchgang', 'routen_A', 'routen_B', 'routen_C', 'routen_D', 'grund_A', 'grund_B', 'grund_C', 'grund_D']];
for (const [f, s] of z) zeilen.push([D.attr[f][0], D.attr[f][ni] || '', D.attr[f][hi], Math.round(LEN[f] || 0), s.routen, s.einzig, s.durchgang, s.k.A, s.k.B, s.k.C, s.k.D,
  ...K.map(c => D.kat[c][f] === 1 ? T[D.grund[c][f]].replace(/;/g, ',').slice(0, 200) : '')]);
fs.writeFileSync(out + '.csv', '﻿' + zeilen.map(r => r.join(';')).join('\n'), 'utf8');
const txt = ['Engpaesse ' + dir + ' | Paare ' + P.length + ' | ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s', 'Modus je Klasse: ' + JSON.stringify(modi),
  'ungeklaerte Abschnitte in ungesicherten Routen: ' + z.length, 'Top 40 nach Durchgang (routen | einzig | durchgang | A B C D | seg | name | Grund D bzw. erste Klasse):',
  ...z.slice(0, 40).map(([f, s]) => [s.routen, s.einzig, s.durchgang, K.map(c => s.k[c]).join(' '), D.attr[f][0], D.attr[f][ni] || '-', D.attr[f][hi], Math.round(LEN[f] || 0) + 'm',
    (T[D.grund[K.find(c => D.kat[c][f] === 1 && s.k[c]) || 'D'][f]] || '').slice(0, 110)].join(' | '))];
fs.writeFileSync(out + '.txt', txt.join('\n'), 'utf8'); console.log(txt.join('\n'));
