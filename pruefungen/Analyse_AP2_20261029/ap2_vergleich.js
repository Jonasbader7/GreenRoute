// AP2: Ziele Z1-Z3 aus zwei Laeufen (alt = V9.2c, neu = V9.2e) auswerten.
// Aufruf: node ap2_vergleich.js <alt.json> <neu.json> <bericht.json>
// Z1: leichtere Klasse X faellt auf experimentell zurueck (oder hat keine Route), schwerere Y hat eine validierte Route.
// Z2: X und Y brauchen auf denselben Seiten einen Ersatzpunkt, gleicher Modus, und X kostet > 1 s mehr.
//     Kosten K = Modellzeit + RESTWEG_SEK_PRO_M x (Luftlinie Klick->Routenanfang + Routenende->Klick + Klickmalus der Ersatzseiten).
// Z3: Ergebnisse, die im alten Lauf ohne Ersatzpunkt, ohne F4 und ohne Rueckfall auskamen (und REF immer), sind identisch.
const fs = require('fs');
const [, , ALT, NEU, AUS] = process.argv;
const alt = JSON.parse(fs.readFileSync(ALT, 'utf8')), neu = JSON.parse(fs.readFileSync(NEU, 'utf8'));
const R = ['A', 'B', 'C', 'D'], SEK = 2;
const K = r => r.mod * 60 + SEK * (r.ka + r.ke + r.malus);
const seiten = r => (r.ss ? 'S' : '') + (r.zs === 'ZIEL_NICHT_ANFAHRBAR' ? 'Z' : '') + (r.zs === 'ZIEL_ZU_FUSS' ? 'F' : '');
const ersatz = r => !!r.ss || r.zs === 'ZIEL_NICHT_ANFAHRBAR' || r.f4;
function ziele(lauf) {
  const z1 = [], z2 = [], z2info = [];
  for (const p of lauf) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const x = p[R[i]], y = p[R[j]], tag = `${p.id} ${R[i]}<${R[j]}`;
    if (y.ok && !y.rueck && (!x.ok || x.rueck)) z1.push(`${tag}: ${R[i]} ${x.ok ? x.modus + ' (Rueckfall)' : 'keine Route ' + x.urs}, ${R[j]} ${y.modus}`);
    if (x.ok && y.ok && ersatz(x) && ersatz(y) && x.rueck === y.rueck && K(x) > K(y) + 1) {
      const t = `${tag}: ${K(x).toFixed(0)} s > ${K(y).toFixed(0)} s (Seiten ${seiten(x) || '-'}/${seiten(y) || '-'}, ${x.modus}/${y.modus})`;
      (seiten(x) === seiten(y) ? z2 : z2info).push(t);
    }
  }
  return { z1, z2, z2info };
}
const za = ziele(alt), zn = ziele(neu);
const z3 = { geprueft: 0, gleich: 0, abw: [] }, aend = [];
for (let k = 0; k < alt.length; k++) {
  const a = alt[k], n = neu[k];
  if (a.id !== n.id) throw new Error('Paarliste verschieden');
  for (const c of ['REF', ...R]) {
    const x = a[c], y = n[c];
    const gleich = x.ok === y.ok && (!x.ok ? x.urs === y.urs : x.weg === y.weg && Math.abs(x.L - y.L) < 1e-6 && Math.abs(x.mod - y.mod) < 1e-9 && x.modus === y.modus && x.urs === y.urs && x.dom === y.dom);
    if (c === 'REF' || (x.ok && !ersatz(x) && !x.rueck)) { z3.geprueft++; if (gleich) z3.gleich++; else z3.abw.push(`${a.id} ${c}`); }
    else if (!gleich) aend.push({ id: a.id, c, alt: x.ok ? { modus: x.modus, urs: x.urs, L: Math.round(x.L), K: Math.round(K(x)), rest: Math.round(x.rs + x.rz) } : { urs: x.urs },
      neu: y.ok ? { modus: y.modus, urs: y.urs, L: Math.round(y.L), K: Math.round(K(y)), rest: Math.round(y.rs + y.rz) } : { urs: y.urs } });
  }
}
const kBesser = aend.filter(e => e.alt.K !== undefined && e.neu.K !== undefined && e.neu.K < e.alt.K - 1).length;
const kSchlechter = aend.filter(e => e.alt.K !== undefined && e.neu.K !== undefined && e.neu.K > e.alt.K + 1);
const out = { paare: alt.length, Z1: { alt: za.z1.length, neu: zn.z1.length, neu_faelle: zn.z1, alt_faelle: za.z1 },
  Z2: { alt: za.z2.length, neu: zn.z2.length, neu_faelle: zn.z2, alt_faelle: za.z2, info_andere_seiten_neu: zn.z2info.length, info_andere_seiten_alt: za.z2info.length, info_neu: zn.z2info },
  Z3: { geprueft: z3.geprueft, identisch: z3.gleich, abweichend: z3.abw },
  geaendert: { anzahl: aend.length, K_besser: kBesser, K_schlechter: kSchlechter.length, schlechter: kSchlechter, liste: aend } };
fs.writeFileSync(AUS, JSON.stringify(out, null, 1));
console.log(`Paare ${out.paare}`);
console.log(`Z1 alt ${out.Z1.alt} -> neu ${out.Z1.neu}`); zn.z1.forEach(t => console.log('  Z1', t));
console.log(`Z2 alt ${out.Z2.alt} -> neu ${out.Z2.neu} (andere Seiten, nur Info: alt ${za.z2info.length} -> neu ${zn.z2info.length})`); zn.z2.forEach(t => console.log('  Z2', t));
console.log(`Z3 ${z3.gleich}/${z3.geprueft} identisch`); z3.abw.slice(0, 20).forEach(t => console.log('  Z3 abw', t));
console.log(`geaenderte Ergebnisse (Ersatz/F4/Rueckfall): ${aend.length}, davon Kosten besser ${kBesser}, schlechter ${kSchlechter.length}`);
