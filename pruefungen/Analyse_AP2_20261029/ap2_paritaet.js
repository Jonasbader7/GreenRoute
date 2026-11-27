// AP2 (Z4): zwei Ergebnislisten Feld fuer Feld vergleichen (Web gegen Python-Nachbau oder gegen QGIS-Ausgabe von Skript 28).
// Aufruf: node ap2_paritaet.js <a.json> <b.json> [max_liste]
// Verglichen je Paar und Profil: Route ja/nein, Ursache, Modus, Rueckfall, Dominanz, Abschnittsfolge (seg_id),
// Laenge (+-0.01 m), Modellzeit (+-1e-6 min), Restweg Start/Ziel (+-0.15 m, QGIS rundet auf 0.1 m).
const fs = require('fs');
const lade = p => { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return Array.isArray(j) ? j : j.paare; };
const a = lade(process.argv[2]), b = lade(process.argv[3]), MAXL = +(process.argv[4] || 30);
const segs = r => r.segs !== undefined ? r.segs : r.weg.split(' ').map(s => s.split(':')[0]).join(' ');
const bm = new Map(b.map(p => [p.id, p]));
let n = 0, gleich = 0; const abw = [], felder = {};
for (const p of a) {
  const q = bm.get(p.id); if (!q) continue;
  for (const c of ['REF', 'A', 'B', 'C', 'D']) {
    const x = p[c], y = q[c]; n++;
    const f = [];
    if (x.ok !== y.ok) f.push('ok');
    else if (!x.ok) { if (x.urs !== y.urs) f.push('urs'); }
    else {
      for (const k of ['urs', 'modus', 'rueck', 'dom']) if (x[k] !== y[k]) f.push(k);
      if (segs(x) !== segs(y)) f.push('segs');
      if (Math.abs(x.L - y.L) > 0.01) f.push('L');
      if (Math.abs(x.mod - y.mod) > 1e-6) f.push('mod');
      if (Math.abs(x.rs - y.rs) > 0.15 || Math.abs(x.rz - y.rz) > 0.15) f.push('rest');
    }
    if (!f.length) { gleich++; continue; }
    f.forEach(k => felder[k] = (felder[k] || 0) + 1);
    abw.push(`${p.id} ${c}: ${f.join(',')} | ${x.ok ? `${x.modus} ${x.urs} ${x.L.toFixed(1)} m ${x.mod.toFixed(3)} min` : x.urs} || ${y.ok ? `${y.modus} ${y.urs} ${y.L.toFixed(1)} m ${y.mod.toFixed(3)} min` : y.urs}`);
  }
}
console.log(`identisch ${gleich}/${n} (Paar x Profil)`, JSON.stringify(felder));
abw.slice(0, MAXL).forEach(t => console.log('  ', t));
