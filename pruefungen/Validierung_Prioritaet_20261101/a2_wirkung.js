// Wirkung unvalidierter Abschnitte auf Routen ab der Hauptwache (Naeherung: Dijkstra ohne Abbiege-/Hinderniskosten)
// Ziel = jeder Abschnitt im Untersuchungsgebiet. Pro Ziel: validiert erreichbar (V), nur Zufahrt unvalidiert (Z),
// Luecke mitten im Weg (L: unvalidierter Abschnitt vor dem letzten validierten). Rangliste = Luecken-Abschnitte nach
// Ziel-km, die durch sie fuehren. Gierig: je 25 Abschnitte validieren, neu rechnen.
// Aufruf: node a2_wirkung.js <webapp-ordner> <ausgabe.json>
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
require(path.join(dir, 'bors_router.js'));
const D = JSON.parse(fs.readFileSync(path.join(dir, 'netz.json'), 'utf8'));
const N = new BORS.Netz(D);
const nn = N.x.length;

class Heap { constructor() { this.a = []; } push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= x[0]) break; a[i] = a[p]; i = p; } a[i] = x; }
  pop() { const a = this.a, t = a[0], l = a.pop(); if (a.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= a.length) break; if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++; if (a[c][0] >= l[0]) break; a[i] = a[c]; i = c; } a[i] = l; } return t; } get size() { return this.a.length; } }

function dijkstra(src, kosten) {
  const dist = new Float64Array(nn).fill(Infinity), pf = new Int32Array(nn).fill(-1), pn = new Int32Array(nn).fill(-1);
  const h = new Heap(); src.forEach(s => { dist[s] = 0; h.push([0, s]); });
  while (h.size) { const [d, u] = h.pop(); if (d > dist[u]) continue;
    for (const [v, f, , , , L] of N.out[u]) { const k = kosten[f]; if (!k) continue; const nd = d + L * k; if (nd < dist[v]) { dist[v] = nd; pf[v] = f; pn[v] = u; h.push([nd, v]); } } }
  return { dist, pf, pn };
}
const w = D.wachen[0], wx = w[1] / 100, wy = w[2] / 100;
let best = null;
N.feat.forEach(F => F.ids.forEach(ids => ids.forEach(i => { const d = Math.hypot(N.x[i] - wx, N.y[i] - wy); if (!best || d < best[0]) best = [d, i]; })));
const src = [best[1]];
const attr = (f, c) => N.attr(f, c);
const ziele = []; N.feat.forEach((F, f) => { if (!attr(f, 'ausserhalb')) ziele.push(f); });
const ends = f => { const ids = N.feat[f].ids; return [ids[0][0], ids[ids.length - 1][ids[ids.length - 1].length - 1]]; };

function klassifiziere(kat, V, E) {
  const rv = dijkstra(src, V), re = dijkstra(src, E);
  const r = { V: 0, Z: 0, Z200: 0, L: 0, X: 0, G: 0, durch: new Map(), wirk: new Map(), schneller: new Map() };
  for (const f of ziele) {
    const km = N.feat[f].L / 1000;
    if (kat[f] === 2) { r.G += km; continue; }
    const [a, b] = ends(f), dv = Math.min(rv.dist[a], rv.dist[b]), de = Math.min(re.dist[a], re.dist[b]);
    if (de === Infinity) { r.X += km; continue; }
    let n = re.dist[a] <= re.dist[b] ? a : b; const seq = [f];
    while (re.pf[n] >= 0) { seq.push(re.pf[n]); n = re.pn[n]; }
    seq.reverse();
    if (kat[f] === 0 && dv < Infinity) {
      r.V += km;
      if (de < dv * 0.8 && dv - de > 60) new Set(seq.filter(g => kat[g] === 1)).forEach(g => r.schneller.set(g, (r.schneller.get(g) || 0) + km));
      continue;
    }
    let lv = -1; seq.forEach((g, i) => { if (kat[g] === 0) lv = i; });
    const s = new Set(), sd = new Set(); let zuf = 0;
    seq.forEach((g, i) => { if (kat[g] !== 1) return; s.add(g); if (i < lv) sd.add(g); else zuf += N.feat[g].L; });
    s.forEach(g => r.wirk.set(g, (r.wirk.get(g) || 0) + km));
    sd.forEach(g => r.durch.set(g, (r.durch.get(g) || 0) + km));
    if (sd.size === 0) { r.Z += km; if (zuf <= 200) r.Z200 += km; } else r.L += km;
  }
  return r;
}
const rund = x => +x.toFixed(1);
const out = { wache: w[0], start_abstand_m: best[0], netz: D.netz, klassen: {} };
for (const c of ['A', 'B', 'C', 'D']) {
  const kat = D.kat[c].slice(), V = D.kosten.V[c].slice(), E = D.kosten.E[c].slice();
  const r0 = klassifiziere(kat, V, E);
  const liste = [], kurve = [{ n: 0, aufwand_km: 0, V: rund(r0.V), Z: rund(r0.Z), L: rund(r0.L) }];
  let r = r0, aufwand = 0;
  for (let schritt = 0; schritt < 20; schritt++) {
    const top = [...r.durch.entries()].sort((p, q) => q[1] - p[1]).slice(0, 25);
    if (!top.length) break;
    for (const [g, v] of top) {
      liste.push({ rang: liste.length + 1, seg_id: attr(g, 'seg_id'), name: attr(g, 'name'), gemeinde: attr(g, 'gemeinde'), hw: attr(g, 'highway_type'), svc: attr(g, 'service_type'),
        laenge_m: Math.round(N.feat[g].L), luecke_km: +v.toFixed(2), schneller_km: +(r0.schneller.get(g) || 0).toFixed(2) });
      aufwand += N.feat[g].L / 1000;
      kat[g] = 0; E[g] = E[g] / D.konst.RISIKO_FAKTOR; V[g] = E[g];
    }
    r = klassifiziere(kat, V, E);
    kurve.push({ n: liste.length, aufwand_km: rund(aufwand), V: rund(r.V), Z: rund(r.Z), L: rund(r.L) });
  }
  out.klassen[c] = { start: { V: rund(r0.V), Z: rund(r0.Z), Z200: rund(r0.Z200), L: rund(r0.L), X: rund(r0.X), G: rund(r0.G), luecken_abschnitte: r0.durch.size }, kurve, liste,
    schneller: [...r0.schneller.entries()].sort((p, q) => q[1] - p[1]).slice(0, 100).map(([g, v]) => ({ seg_id: attr(g, 'seg_id'), name: attr(g, 'name'), gemeinde: attr(g, 'gemeinde'), laenge_m: Math.round(N.feat[g].L), schneller_km: +v.toFixed(2) })) };
  console.log(c, JSON.stringify(out.klassen[c].start), JSON.stringify(kurve.filter((k, i) => [0, 1, 2, 4, 8, 12, 16, 20].includes(i))));
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
