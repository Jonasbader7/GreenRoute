// Zusatzpruefung Webexport: Gruende und Basiskosten. Nur lesend.
// Aufruf: node r17_web_gruende_kosten.js <web_alt> <web_neu> <netzmaster_gruende.tsv> <ausgabe.txt>
//   netzmaster_gruende.tsv: seg_id \t a_grund \t b_grund \t c_grund \t d_grund (Tabs/Zeilenumbrueche im Text ersetzt)
// Prueft je Abschnitt und Klasse:
//  G  Web-Grund = Netzmaster-Grund; erlaubte Ausnahmen: Wachenareal (Praefix + Netzmaster-Grund[:150]), beibehaltene Sperre
//     (alter Web-Grund bleibt), OSM-Sperre/Zufahrt (Grund = Netzmaster, Sperre bleibt)
//  K  Basiskosten unveraendert: Basis = V (kat 0) bzw. E/2 (kat 1); verglichen, wo alt und neu nicht gesperrt sind
//  S  Graph, Knoten, REF, Abbiegen, Baustellen identisch mit der Quelle
const fs = require('fs');
const [dA, dN, tsv, out] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(dA + '/netz.json', 'utf8')), N = JSON.parse(fs.readFileSync(dN + '/netz.json', 'utf8'));
const NM = {}; fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean).forEach(l => { const z = l.split('\t'); NM[z[0]] = z.slice(1, 5); });
const BEI = new Set(fs.readFileSync(dN + '/netz_sperre_beibehalten.csv', 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).map(l => { const z = l.split(';'); return z[0] + '|' + z[2]; }));
const K = ['A', 'B', 'C', 'D'], T = N.texte, TA = A.texte, z = {}, bsp = {}; const add = (k, b) => { z[k] = (z[k] || 0) + 1; if (b && !bsp[k]) bsp[k] = b; };
const basis = (D, c, f) => D.kat[c][f] === 0 ? D.kosten.V[c][f] : D.kat[c][f] === 1 ? D.kosten.E[c][f] / 2 : null;
for (let f = 0; f < N.attr.length; f++) {
  const sid = N.attr[f][0]; if (A.attr[f][0] !== sid) { add('S Reihenfolge abweichend', sid); continue; }
  for (let i = 0; i < 4; i++) {
    const c = K[i], g = T[N.grund[c][f]], gn = (NM[sid] || [])[i];
    if (gn === undefined) { add('G ohne Netzmaster', sid); continue; }
    const stop = /^(OSM max|Zufahrt eingeschr)/.test(T[N.aus.V[c][f]]);
    if (g === gn) add(stop ? 'G gleich (OSM-Sperre)' : 'G gleich');
    else if (g.startsWith('Wachenareal') && g.endsWith(gn.slice(0, 150))) add('G Wachenareal (erlaubt)');
    else if (BEI.has(sid + '|' + c) && g === TA[A.grund[c][f]]) add('G Sperre beibehalten (erlaubt)');
    else add('G FEHLER', sid + ' ' + c + ' web=' + g.slice(0, 80) + ' nm=' + gn.slice(0, 80));
    const ba = basis(A, c, f), bn = basis(N, c, f);
    if (ba !== null && bn !== null) { if (Math.abs(ba - bn) <= 1e-6 * Math.max(1, ba)) add('K Basis gleich'); else add('K FEHLER', sid + ' ' + c + ' ' + ba + ' ' + bn); }
    else add('K nicht vergleichbar (gesperrt alt oder neu)');
  }
}
for (const k of ['nodes', 'segs', 'x0', 'y0', 'wachen']) add(JSON.stringify(A[k]) === JSON.stringify(N[k]) ? 'S gleich ' + k : 'S FEHLER ' + k);
for (const k of Object.keys(A)) if (!['texte', 'kat', 'grund', 'kosten', 'aus', 'attr', 'version', 'netz', 'nodes', 'segs', 'x0', 'y0', 'wachen'].includes(k))
  add(JSON.stringify(A[k]) === JSON.stringify(N[k]) ? 'S gleich ' + k : 'S FEHLER ' + k);
const REFi = Object.keys(N.kosten.V).filter(c => !K.includes(c));
for (const c of REFi) add(JSON.stringify(A.kosten.V[c]) === JSON.stringify(N.kosten.V[c]) && JSON.stringify(A.kat[c]) === JSON.stringify(N.kat[c]) ? 'S gleich Klasse ' + c : 'S FEHLER Klasse ' + c);
const txt = Object.keys(z).sort().map(k => k + ': ' + z[k] + (bsp[k] && /FEHLER|Reihenfolge|ohne/.test(k) ? '  z.B. ' + bsp[k] : ''));
fs.writeFileSync(out, txt.join('\n') + '\n'); console.log(txt.join('\n'));
