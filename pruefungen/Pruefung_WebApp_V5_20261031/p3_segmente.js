// Pruefung 3: gruene Route (vollstaendig validiert) und blaue Vergleichsroute Segment fuer Segment gegen netz.json.
// Die Klassifikation (vgl, vglInhalt) wird woertlich aus index.html geladen, nicht nachgebaut.
// Aufruf: node p3_segmente.js <WebApp-Ordner> <Ausgabeordner>
const fs = require('fs'), path = require('path');
const [web, aus] = process.argv.slice(2);
require(path.join(web, 'bors_router.js'));
const D = JSON.parse(fs.readFileSync(path.join(web, 'netz.json'), 'utf8'));
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const ab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('Marke fehlt: ' + a); return html.slice(i, j); };
const code = ab('const UML=', 'const PN=') + ab('const grundTxt=', 'const engListe=');
const UI = new Function('D', 'let BEIDE=null;' + code + ';return {vgl, vglInhalt, setze: b => { BEIDE = b; }};')(D);

const R = new BORS.Router(new BORS.Netz(D));
const sid = D.attr_cols.indexOf('seg_id'), nm = D.attr_cols.indexOf('name');
const HW = [2601003.3, 1200397.3];
const PAARE = [
  ['N01', 'Bahnhof -> Helvetiaplatz (Kirchenfeldbruecke 10 t)', [2600030, 1199650], [2600960, 1199060]],
  ['N04', 'Felsenau: Bruecke 28 t', [2600929.2, 1202822.9], [2599121.8, 1202870.4]],
  ['N05', 'Turbenweg: Dominanz', [2604859.5, 1197978.6], [2600495.7, 1201017.1]],
  ['N06', 'Aarhaldenstrasse: fester Poller', [2600714.6, 1197848.4], [2604328.1, 1201006.8]],
  ['N07', 'Liebewilstrasse: Unterfuehrung 3.5 m', [2594756.2, 1194610.7], [2594124.6, 1196109.9]],
  ['N08', 'Wehrbruecke 15 t', [2590088.4, 1200197.5], [2588553.3, 1202405.6]],
  ['W837', 'Hauptwache -> 2602477.8/1198892.2 (D ohne validierte Route)', HW, [2602477.8, 1198892.2]],
  ['W3193', 'Hauptwache -> 2602138.3/1202416.6 (D ohne validierte Route)', HW, [2602138.3, 1202416.6]],
];
// fester Poller strikt innerhalb eines befahrenen Stuecks?
const festDurch = rows => rows.filter(x => (D.punkte[x.f] || []).some(([pi, pos, fest]) => fest && pi === x.pi && Math.min(x.a, x.b) + 0.01 < pos && pos < Math.max(x.a, x.b) - 0.01)).map(x => D.attr[x.f][sid]);
const prot = [], routen = [];
let nFail = 0;
for (const [id, txt, s, z] of PAARE) {
  const p1 = [s[0] - D.x0, s[1] - D.y0], p2 = [z[0] - D.x0, z[1] - D.y0];
  const B = { V: R.berechne(p1, p2, 'VALIDIERT'), E: R.berechne(p1, p2, 'EXPERIMENTELL') };
  UI.setze(B);
  for (const c of ['A', 'B', 'C', 'D']) {
    const v = UI.vgl(c), I = UI.vglInhalt(v), K = D.kat[c], kV = D.kosten.V[c], kE = D.kosten.E[c], ch = [];
    const pruef = (name, ok, beleg) => { ch.push({ name, ok, beleg }); if (ok === false) nFail++; };
    if (v.val) {
      const r = v.val.rows;
      const nichtVal = r.filter(x => K[x.f] !== 0).map(x => D.attr[x.f][sid]);
      pruef('gruen: alle Segmente VALIDIERT laut netz.json', nichtVal.length === 0, nichtVal.length ? 'nicht validiert: ' + nichtVal.join(', ') : r.length + ' Segmentstuecke, alle kat 0');
      const kost0 = r.filter(x => !kV[x.f]).map(x => D.attr[x.f][sid]);
      pruef('gruen: kein Segment mit Kosten 0 (Modus VALIDIERT)', kost0.length === 0, kost0.join(', ') || 'keins');
      const fd = festDurch(r); pruef('gruen: kein fester Poller durchfahren', fd.length === 0, fd.join(', ') || 'keiner');
    } else pruef('gruen: keine validierte Route angezeigt', null, I.val.lbl + ' – ' + I.val.sub);
    if (v.exp) {
      const r = v.exp.rows;
      const gesp = r.filter(x => K[x.f] === 2).map(x => D.attr[x.f][sid]);
      pruef('blau: kein GESPERRT-Segment', gesp.length === 0, gesp.join(', ') || 'keins');
      const kost0 = r.filter(x => !kE[x.f]).map(x => D.attr[x.f][sid]);
      pruef('blau: kein Segment mit Kosten 0 (Modus EXPERIMENTELL)', kost0.length === 0, kost0.join(', ') || 'keins');
      // Markierung: Karte markiert x.kat!==0 (zeichneRoute), Liste = v.eng. Beides gegen die Klasse K[f] aus netz.json
      const sollU = r.filter(x => K[x.f] !== 0), markU = r.filter(x => x.kat !== 0);
      const fehltMark = sollU.filter(x => x.kat === 0).map(x => D.attr[x.f][sid]), zuviel = markU.filter(x => K[x.f] === 0).map(x => D.attr[x.f][sid]);
      pruef('blau: jedes ungeklaerte Segment markiert, kein validiertes faelschlich', !fehltMark.length && !zuviel.length,
        `${sollU.length} ungeklaert laut netz.json, ${markU.length} markiert` + (fehltMark.length ? '; fehlt: ' + fehltMark.join(', ') : '') + (zuviel.length ? '; zu viel: ' + zuviel.join(', ') : ''));
      const sollM = sollU.reduce((a, x) => a + x.L, 0);
      pruef('blau: Engstellen-Liste deckt alle ungeklaerten Meter ab', Math.abs(sollM - v.unvM) < 0.01, `${sollM.toFixed(1)} m ungeklaert, Liste ${v.unvM.toFixed(1)} m in ${v.eng.length} Stellen`);
      if (v.zeigeE) pruef('blau: als "nicht gesichert" beschriftet', !!(I.exp && I.exp.lbl.includes('nicht gesichert')), I.exp ? I.exp.lbl : '-');
      const fd = festDurch(r); pruef('blau: kein fester Poller durchfahren', fd.length === 0, fd.join(', ') || 'keiner');
    } else pruef('blau: keine Vergleichsroute', null, v.e.text || v.e.ursache || '');
    const bisZ = !!(v.val && v.val.modus === 'VALIDIERT_BIS_ZUFAHRT');
    if (bisZ) pruef('gruen bis Zufahrt: als "Validiert bis Zufahrt" beschriftet', I.val.lbl === 'Validiert bis Zufahrt', I.val.lbl + ' / ' + I.val.notes.join('; '));
    prot.push({ id, txt, c, gruen: v.val ? { km: +(v.val.laenge_m / 1000).toFixed(3), min: +v.val.fahrzeit_min.toFixed(2), kosten_min: +v.val.modell_min.toFixed(2), modus: v.val.modus, zufahrt_m: bisZ ? Math.round(v.val.zufahrt_m) : 0 } : null,
      blau: v.zeigeE ? { km: +(v.exp.laenge_m / 1000).toFixed(3), min: +v.exp.fahrzeit_min.toFixed(2), kosten_min: +v.exp.modell_min.toFixed(2), unval_m: Math.round(v.unvM),
        stellen: v.eng.map(g => g.name + ' ' + Math.round(g.L) + ' m'), unval_seg: [...new Set(v.exp.rows.filter(x => K[x.f] !== 0).map(x => D.attr[x.f][sid]))] } : null,
      bis_zufahrt: bisZ, gleich: !!I.gleich, checks: ch });
    // Geometrie fuer die TLM-Pruefung (LV95)
    const geo = r => r.rows.map(x => ({ seg: D.attr[x.f][sid], kat: K[x.f], name: D.attr[x.f][nm], L: x.L, pts: x.pts.map(p => [+(p[0] + D.x0).toFixed(2), +(p[1] + D.y0).toFixed(2)]) }));
    routen.push({ id, c, gruen: v.val ? geo(v.val) : null, blau: v.zeigeE ? geo(v.exp) : null });
  }
}
fs.writeFileSync(path.join(aus, 'p3_protokoll.json'), JSON.stringify(prot, null, 1));
fs.writeFileSync(path.join(aus, 'p3_routen_geometrie.json'), JSON.stringify(routen));
for (const p of prot) {
  const f = p.checks.filter(x => x.ok === false).length, ok = p.checks.filter(x => x.ok === true).length;
  console.log(`${p.id.padEnd(6)} ${p.c} gruen ${p.gruen ? p.gruen.km + ' km ' + p.gruen.min + ' min (Kosten ' + p.gruen.kosten_min + ')' + (p.bis_zufahrt ? ' BIS_ZUFAHRT ' + p.gruen.zufahrt_m + ' m' : '') : 'KEINE'} | blau ${p.blau ? p.blau.km + ' km ' + p.blau.min + ' min (Kosten ' + p.blau.kosten_min + ') ' + p.blau.unval_m + ' m ungekl., ' + p.blau.unval_seg.length + ' Seg' : (p.gleich ? 'identisch' : '-')} | PASS ${ok} FAIL ${f}`);
}
console.log('FAIL gesamt:', nFail);
