// AP2: Testpaare fuer den Einrasten-Fix. Teil O = 80 OSRM-Paare (Seed 4242, wie osrm.js),
// Teil E = 500 Ersatzfall-Paare (Seed 20261029): Start/Ziel bewusst an Abschnitten, die fuer C oder D im Modus
// VALIDIERT nicht offen sind (unvalidiert oder gesperrt), dazu Wache -> solche Abschnitte.
// Aufruf: node ap2_paare.js <netz.json> <paare.json>   (Koordinaten LV95 absolut)
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ac = {}; D.attr_cols.forEach((c, i) => ac[c] = i);
const attr = (f, c) => D.attr[f][ac[c]];
const nx = i => D.nodes[2 * i] / 100, ny = i => D.nodes[2 * i + 1] / 100;
const mid = f => { const ids = D.segs[f][0][0], i = ids[Math.floor(ids.length / 2)]; return [nx(i) + D.x0, ny(i) + D.y0]; };
const lcg = s => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };

const paare = [];
let rnd = lcg(4242);
const pool = []; for (let f = 0; f < D.segs.length; f++) if (!attr(f, 'ausserhalb') && ['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street'].includes(attr(f, 'highway_type'))) pool.push(f);
for (let k = 0; k < 80; k++) { const a = pool[Math.floor(rnd() * pool.length)], b = pool[Math.floor(rnd() * pool.length)]; paare.push({ id: 'O' + String(k).padStart(2, '0'), p1: mid(a), p2: mid(b) }); }

rnd = lcg(20261029);
const hart = []; for (let f = 0; f < D.segs.length; f++) if (!attr(f, 'ausserhalb') && (!D.kosten.V.C[f] || !D.kosten.V.D[f])) hart.push(f);
const pick = l => l[Math.floor(rnd() * l.length)];
const wachen = D.wachen.map(w => [w[1], w[2]]);
const mix = [['H', 'N', 200], ['N', 'H', 150], ['H', 'H', 100], ['W', 'H', 50]];
let n = 0;
for (const [a, b, anz] of mix) for (let i = 0; i < anz; i++) {
  const q = t => t === 'H' ? mid(pick(hart)) : t === 'N' ? mid(pick(pool)) : pick(wachen);
  paare.push({ id: 'E' + String(n++).padStart(3, '0'), typ: a + b, p1: q(a), p2: q(b) });
}
fs.writeFileSync(process.argv[3], JSON.stringify(paare));
console.log('Paare:', paare.length, '| Pool hart:', hart.length, '| normal:', pool.length, '| Wachen:', wachen.length);
