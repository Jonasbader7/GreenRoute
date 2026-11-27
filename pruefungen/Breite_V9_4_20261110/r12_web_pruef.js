// Konsistenzpruefung Webexport (netz.json) gegen Netzmaster und Routerverhalten. Nur lesend.
// Aufruf: node r12_web_pruef.js <webapp_ordner> <netzmaster_status.csv> <ausgabe_prefix>
//   netzmaster_status.csv: seg_id;a_status;b_status;c_status;d_status (aus dem Netzmaster exportiert)
// Prueft:
//  1 Regeln je Abschnitt und Klasse: kat 0 -> V=E>0, aus leer; kat 1 -> V=0, E>0, aus V 'nicht validiert: ...';
//    kat 2 -> V=E=0, aus V=E 'Kat. 3: ...' (OSM-Sperren/Zufahrt: kat 2, V=E=0)
//  2 Web-Kategorie gegen Netzmaster-Status; jede Abweichung muss einer Ursache zugeordnet sein:
//    SPERRE_BEIBEHALTEN (netz_sperre_beibehalten.csv), OSM_SPERRE (OSM max*/Zufahrt eingeschraenkt, nur Web),
//    WACHENAREAL (service <= 80 m um Wache, unvalidiert -> validiert). Sonst: FEHLER.
//  3 Routerverhalten: (a) fuer jede beibehaltene Sperre: Route von 15 m vor bis 15 m nach dem Abschnitt in den Modi
//    VALIDIERT und EXPERIMENTELL fuer die Klasse -> Abschnitt nie in der Route; (b) 300 Zufallspaare: keine Route ueber kat 2,
//    keine 'validiert'-Route ueber kat 1.
const fs = require('fs');
const [dir, nmcsv, out] = process.argv.slice(2);
const g = {}; new Function('globalThis', 'window', fs.readFileSync(dir + '/bors_router.js', 'utf8'))(g, g);
const D = JSON.parse(fs.readFileSync(dir + '/netz.json', 'utf8')); const R = new g.BORS.Router(new g.BORS.Netz(D));
const T = D.texte, K = ['A', 'B', 'C', 'D'], KAT = { VALIDIERT: 0, UNVALIDIERT: 1, GESPERRT: 2 };
const idx = {}; D.attr.forEach((a, f) => idx[a[0]] = f);
const NM = {}; fs.readFileSync(nmcsv, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).forEach(l => { const z = l.split(';'); NM[z[0]] = z.slice(1, 5); });
const BEI = new Set(); const beiRows = [];
if (fs.existsSync(dir + '/netz_sperre_beibehalten.csv'))
  fs.readFileSync(dir + '/netz_sperre_beibehalten.csv', 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).forEach(l => { const z = l.split(';'); BEI.add(z[0] + '|' + z[2]); beiRows.push(z); });
const stopTxt = (c, f) => /^(OSM max|Zufahrt eingeschr)/.test(T[D.aus.V[c][f]]);
const regel = [], abw = [], zaehl = {};
const add = (k) => zaehl[k] = (zaehl[k] || 0) + 1;
for (const c of K) for (let f = 0; f < D.attr.length; f++) {
  const k = D.kat[c][f], V = D.kosten.V[c][f], E = D.kosten.E[c][f], av = T[D.aus.V[c][f]], ae = T[D.aus.E[c][f]], gr = T[D.grund[c][f]];
  let ok;
  if (stopTxt(c, f)) ok = k === 2 && V === 0 && E === 0 && av === ae;
  else if (k === 0) ok = V > 0 && Math.abs(V - E) < 1e-9 && av === '' && ae === '';
  else if (k === 1) ok = V === 0 && E > 0 && av === 'nicht validiert: ' + gr.slice(0, 120) && ae === '';
  else ok = V === 0 && E === 0 && av === ae && av === 'Kat. 3: ' + gr.slice(0, 120);
  if (!ok) regel.push([D.attr[f][0], c, k, V, E, av.slice(0, 60)]);
  const sid = D.attr[f][0], st = NM[sid] && NM[sid][K.indexOf(c)];
  if (!st) { add('ohne Netzmaster'); continue; }
  const kn = KAT[st];
  if (kn === k) { add('gleich'); continue; }
  let urs = 'FEHLER';
  if (BEI.has(sid + '|' + c) && k === 2) urs = 'SPERRE_BEIBEHALTEN';
  else if (stopTxt(c, f) && k === 2) urs = 'OSM_SPERRE';
  else if (k === 0 && kn === 1 && gr.startsWith('Wachenareal')) urs = 'WACHENAREAL';
  add(urs); abw.push([sid, D.attr[f][1] || '', c, st, ['VALIDIERT', 'UNVALIDIERT', 'GESPERRT'][k], urs, gr.slice(0, 120)]);
}
// 3a Routing um beibehaltene Sperren
const pts = f => D.segs[f][0].map(p => p.map(i => [D.nodes[2 * i] / 100, D.nodes[2 * i + 1] / 100]));
const entlang = (P, s) => { let a = 0; for (let i = 0; i < P.length - 1; i++) { const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (a + L >= s && L > 0) { const t = (s - a) / L; return [P[i][0] + t * (P[i + 1][0] - P[i][0]), P[i][1] + t * (P[i + 1][1] - P[i][1])]; } a += L; } return P[P.length - 1]; };
const routing = [];
for (const z of beiRows) {
  const f = idx[z[0]], c = z[2]; if (f === undefined) continue;
  const P = pts(f).reduce((a, b) => a.length >= b.length ? a : b);
  const L = P.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
  const a = entlang(P, Math.min(3, L / 4)), b = entlang(P, Math.max(L - 3, 3 * L / 4));
  for (const modus of ['VALIDIERT', 'EXPERIMENTELL']) {
    const r = R.berechne(a, b, modus)[c];
    const ueber = r && r.ok && r.rows.some(x => x.f === f);
    routing.push([z[0], c, modus, r && r.ok ? 'Route' : 'keine Route (' + (r && (r.ursache || r.meldung) || '-') + ')', ueber ? 'FEHLER: ueber Sperre' : 'ok']);
  }
}
// 3b Zufallspaare
let seed = 20261111; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ai = D.attr_cols.indexOf('ausserhalb'); const innen = []; for (let f = 0; f < D.segs.length; f++) if (!D.attr[f][ai]) innen.push(f);
const pt = () => { const f = innen[Math.floor(rnd() * innen.length)], ids = D.segs[f][0][0], n = ids[Math.floor(rnd() * ids.length)]; return [D.nodes[2 * n] / 100 + (rnd() - 0.5) * 20, D.nodes[2 * n + 1] / 100 + (rnd() - 0.5) * 20]; };
let paare = 0, verstoss = []; const routen = { ok: 0, kein: 0 };
for (let i = 0; i < 300; i++) {
  const p1 = pt(), p2 = pt(); paare++;
  for (const modus of ['VALIDIERT', 'EXPERIMENTELL']) { const res = R.berechne(p1, p2, modus);
    for (const c of K) { const r = res[c]; if (!r || !r.ok) { routen.kein++; continue; } routen.ok++;
      for (const x of r.rows) { if (D.kat[c][x.f] === 2) verstoss.push([i, c, modus, D.attr[x.f][0], 'kat 2 in Route']); if (r.modus === 'VALIDIERT' && x.kat === 1 && !r.dominanz_von) verstoss.push([i, c, modus, D.attr[x.f][0], 'kat 1 in validierter Route']); } } }
}
const w = (n, kopf, rows) => fs.writeFileSync(out + n, '﻿' + [kopf.join(';')].concat(rows.map(r => r.join(';'))).join('\n'));
w('_abweichungen.csv', ['seg_id', 'name', 'klasse', 'netzmaster', 'web', 'ursache', 'web_grund'], abw);
w('_regeln.csv', ['seg_id', 'klasse', 'kat', 'V', 'E', 'aus_V'], regel);
w('_routing_sperren.csv', ['seg_id', 'klasse', 'modus', 'ergebnis', 'pruefung'], routing);
w('_zufall_verstoesse.csv', ['paar', 'klasse', 'modus', 'seg_id', 'art'], verstoss);
const fehlerR = routing.filter(r => r[4] !== 'ok').length;
console.log(JSON.stringify({ version: D.version, netz: D.netz, regelverstoesse: regel.length, vergleich: zaehl, beibehaltene_sperren: beiRows.length,
  routing_sperren_tests: routing.length, routing_sperren_fehler: fehlerR, zufallspaare: paare, routen, zufall_verstoesse: verstoss.length }, null, 1));
process.exit(regel.length || fehlerR || verstoss.length || zaehl.FEHLER ? 1 : 0);
