// Router-Regression Web: zwei Web-App-Ordner (alt, neu) mit demselben Router, gleiche Start/Ziel-Paare. Nur lesend.
// Aufruf: node r14_web_regression.js <ordner_alt> <ordner_neu> <ausgabe_prefix> [paare=500]
// Paare: Beispiele S1-S4 (Koordinaten wie index.html V15-V17), Wachen (BF Murtenstrasse 98, RD Murtenstrasse 111) zu
// 64 Zufallszielen, dazu <paare> Zufallspaare (Seed 20261111, Punkte auf Abschnitten im Gebiet, wie invarianten2.js).
// Je Paar und Klasse A-D, Modus VALIDIERT (wie die App): ok, Modus, Fahrzeit, Laenge, ungeklaerte Meter, gesperrt in Route.
// Ausgaben: <prefix>_paare.csv (alle Zeilen), <prefix>.txt (Zusammenfassung).
const fs = require('fs');
const [dA, dN, out, nP] = process.argv.slice(2); const NPAAR = +(nP || 500);
function lade(dir) {
  const g = {}; new Function('globalThis', 'window', fs.readFileSync(dir + '/bors_router.js', 'utf8'))(g, g);
  const D = JSON.parse(fs.readFileSync(dir + '/netz.json', 'utf8')); return { D, R: new g.BORS.Router(new g.BORS.Netz(D)) };
}
const A = lade(dA), N = lade(dN);
if (A.D.x0 !== N.D.x0 || A.D.y0 !== N.D.y0 || A.D.segs.length !== N.D.segs.length) throw new Error('Graph verschieden');
const D = A.D, K = ['A', 'B', 'C', 'D'], ai = D.attr_cols.indexOf('ausserhalb'), ni = D.attr_cols.indexOf('name');
const rel = ([E, n]) => [E - D.x0, n - D.y0];
let seed = 20261111; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const innen = []; for (let f = 0; f < D.segs.length; f++) if (!D.attr[f][ai]) innen.push(f);
const pt = () => { const f = innen[Math.floor(rnd() * innen.length)], ids = D.segs[f][0][0], n = ids[Math.floor(rnd() * ids.length)]; return [D.nodes[2 * n] / 100 + (rnd() - 0.5) * 20, D.nodes[2 * n + 1] / 100 + (rnd() - 0.5) * 20]; };
const P = [];
[['S1', [2597177, 1194109], [2593852, 1194776]], ['S2', [2602092, 1203136], [2600060, 1201156]], ['S3', [2601199, 1205630], [2598652, 1204099]],
 ['S4', [2601184, 1205344], [2601161, 1204367]]].forEach(([id, s, z]) => P.push([id, rel(s), rel(z), true]));
const W = [['BF', [2598307.75, 1200148.75]], ['RD', [2598133.0, 1199905.375]]];
for (let i = 0; i < 64; i++) { const z = pt(); W.forEach(([w, p]) => P.push([w + '_' + i, rel(p), z, true])); }
for (let i = 0; i < NPAAR; i++) P.push(['Z' + i, pt(), pt(), false]);
function lauf(X, p1, p2, snap) {
  if (snap) { const a = X.R.snap(p1, 30), b = X.R.snap(p2, 30); if (!a || !b) return null; p1 = [a[0], a[1]]; p2 = [b[0], b[1]]; }
  return X.R.berechne(p1, p2, 'VALIDIERT');
}
const zeilen = [['paar', 'klasse', 'ok_alt', 'ok_neu', 'modus_alt', 'modus_neu', 'min_alt', 'min_neu', 'km_alt', 'km_neu', 'unv_m_alt', 'unv_m_neu',
  'gesperrt_in_route_neu', 'ursache_neu', 'gleiche_folge']];
const S = {}; const add = (k, v = 1) => S[k] = (S[k] || 0) + v; const bsp = [];
const t0 = Date.now();
for (const [id, p1, p2, snap] of P) {
  const ra = lauf(A, p1, p2, snap), rn = lauf(N, p1, p2, snap);
  if (!ra || !rn) { add('ohne Snap'); continue; }
  for (const c of K) {
    const x = ra[c], y = rn[c];
    const unv = r => r && r.ok ? Math.round(r.rows.filter(q => q.kat !== 0).reduce((s, q) => s + q.L, 0)) : '';
    const gesp = y && y.ok ? y.rows.filter(q => N.D.kat[c][q.f] === 2).length : 0;
    const gl = x && y && x.ok && y.ok && x.rows.map(q => q.f).join(',') === y.rows.map(q => q.f).join(',');
    const z = [id, c, !!(x && x.ok), !!(y && y.ok), x && x.modus || '', y && y.modus || '', x && x.ok ? x.fahrzeit_min.toFixed(2) : '', y && y.ok ? y.fahrzeit_min.toFixed(2) : '',
      x && x.ok ? (x.laenge_m / 1000).toFixed(3) : '', y && y.ok ? (y.laenge_m / 1000).toFixed(3) : '', unv(x), unv(y), gesp, (y && y.ursache) || '', gl];
    zeilen.push(z);
    const grp = id.startsWith('S') && id.length === 2 ? 'Beispiel' : id.startsWith('Z') ? 'Zufall' : 'Wache';
    add(grp + ' ' + c + ' n');
    if (gesp) add('FEHLER gesperrt in Route ' + c);
    if (gl) add(grp + ' ' + c + ' gleiche Abschnittsfolge');
    if (z[2] !== z[3]) add(grp + ' ' + c + ' ok ' + z[2] + '->' + z[3]);
    if (z[4] !== z[5]) add(grp + ' ' + c + ' Modus ' + z[4] + '->' + z[5]);
    if (x && y && x.ok && y.ok) { const d = y.fahrzeit_min - x.fahrzeit_min; if (d > 0.05) add(grp + ' ' + c + ' langsamer'); if (d < -0.05) add(grp + ' ' + c + ' schneller');
      add(grp + ' ' + c + ' dmin_summe', d); }
    if (grp === 'Beispiel') bsp.push(z);
  }
}
fs.writeFileSync(out + '_paare.csv', '﻿' + zeilen.map(z => z.join(';')).join('\n'), 'utf8');
const txt = ['Router-Regression ' + dA + ' -> ' + dN, 'Paare ' + P.length + ' (4 Beispiele, 128 Wachen, ' + NPAAR + ' Zufall), ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s', '',
  'Beispiele (paar;klasse;ok alt;ok neu;modus alt;modus neu;min alt;min neu;km alt;km neu;unv alt;unv neu;gesperrt;ursache;gleich):', ...bsp.map(z => '  ' + z.join(';')), '',
  ...Object.keys(S).sort().map(k => k + ': ' + (k.endsWith('summe') ? S[k].toFixed(2) : S[k]))];
fs.writeFileSync(out + '.txt', txt.join('\n'), 'utf8'); console.log(txt.join('\n'));
