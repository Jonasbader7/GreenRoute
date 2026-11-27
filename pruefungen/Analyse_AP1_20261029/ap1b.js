// AP1 Vertiefung: (a) Abbiegekosten C > D, (b) Paare, in denen C schlechter rechnet als D, Schritt fuer Schritt
const fs = require('fs');
const REPO = process.argv[2];
require(REPO + '/bors_router.js');
const D = JSON.parse(fs.readFileSync(REPO + '/netz.json', 'utf8'));
const N = new BORS.Netz(D), R = new BORS.Router(N);
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pool = []; for (let f = 0; f < D.segs.length; f++) { const h = N.attr(f, 'highway_type'); if (!N.attr(f, 'ausserhalb') && ['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street'].includes(h)) pool.push(f); }
const mid = f => { const ids = N.feat[f].ids[0], i = ids[Math.floor(ids.length / 2)]; return [N.x[i], N.y[i]]; };
const paare = []; for (let k = 0; k < 80; k++) { const f1 = pool[Math.floor(rnd() * pool.length)], f2 = pool[Math.floor(rnd() * pool.length)]; paare.push([mid(f1), mid(f2)]); }

// (a) Abbiegekosten C > D: liegt der Uebergang auf Abschnitten, die D ueberhaupt befahren darf?
const kDE = D.kosten.E.D, kCE = D.kosten.E.C; let n = 0, nOffenD = 0; const bsp = [];
N.abb.C.turn.forEach((s, key) => {
  const sD = N.abb.D.turn.get(key) || 0; if (s <= sD + 1e-9) return; n++;
  const b = key % 32768, a = Math.floor(key / 32768) % 32768, u = Math.floor(key / 32768 / 32768);
  const offen = kDE[a] > 0 && kDE[b] > 0; if (offen) nOffenD++;
  if (bsp.length < 8) bsp.push({ u, von: N.attr(a, 'name'), nach: N.attr(b, 'name'), C: s, D: sD, D_offen: offen, txtC: N.abb.C.ttext.get(key), txtD: N.abb.D.ttext.get(key) || '' });
});
let nk = 0, nkOffen = 0; const kbsp = [];
N.abb.C.kurve.forEach((s, key) => { const sD = N.abb.D.kurve.get(key) || 0; if (s <= sD + 1e-9) return; nk++; const f = key >> 1; if (kDE[f] > 0) nkOffen++; if (kbsp.length < 5) kbsp.push({ f, name: N.attr(f, 'name'), C: s, D: sD, D_offen: kDE[f] > 0, txtC: N.abb.C.ktext.get(f), txtD: N.abb.D.ktext.get(f) || '' }); });
console.log(`(a) Abbiegungen C>D: ${n}, davon fuer D befahrbar (E): ${nOffenD}; Kurven C>D: ${nk}, davon fuer D befahrbar: ${nkOffen}`);
console.log(JSON.stringify(bsp, null, 0)); console.log(JSON.stringify(kbsp, null, 0));

// (b) Einzelfall: Snapping und Routing je Klasse im Modus V
function detail(k) {
  const [p1, p2] = paare[k]; console.log(`\n--- Paar ${k}`);
  for (const c of ['A', 'B', 'C', 'D']) {
    const kv = R.kosten('VALIDIERT', c);
    for (const [name, p] of [['start', p1], ['ziel', p2]]) {
      const [any, ok] = R.naechste(p, kv);
      console.log(c, name, 'naechster', any && [Math.round(any[0]), any[1], N.attr(any[1], 'name'), kv[any[1]] ? 'V-offen' : 'V-zu: ' + R.ausgrund('V', c, any[1])].join(' '), '| naechster V-offen', ok && [ok[0].toFixed(1), ok[1], N.attr(ok[1], 'name')].join(' '));
    }
    const r = R.routeProfil(c, p1, p2, 'VALIDIERT');
    console.log(c, 'V-Ergebnis:', r.ok ? `ok ${Math.round(r.laenge_m)} m, ${r.modell_min.toFixed(2)} min, urs ${r.ursache || '-'}, f4 ${!!r.diag.f4}` : `KEINE ${r.ursache}`);
    if (!r.ok) {
      const ks = R.kandidaten(p1, kv).map(q => q[1] + '(' + Math.round(q[0]) + 'm)'), kz = R.kandidaten(p2, kv).map(q => q[1] + '(' + Math.round(q[0]) + 'm)');
      console.log('  F4-Startkandidaten', ks.join(' '), '| Zielkandidaten', kz.join(' '));
    }
  }
}
for (const k of [15, 54, 51, 11]) detail(k);
