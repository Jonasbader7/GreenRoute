// AP1: Warum nehmen A/B teils laengere Routen als C/D? Nur Analyse, liest netz.json, schreibt nichts ins Projekt.
// Paare wie osrm.js (Seed 4242).
const fs = require('fs');
const REPO = process.argv[2];
require(REPO + '/bors_router.js');
const D = JSON.parse(fs.readFileSync(REPO + '/netz.json', 'utf8'));
const N = new BORS.Netz(D), R = new BORS.Router(N);
const OSRM = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pool = []; for (let f = 0; f < D.segs.length; f++) { const h = N.attr(f, 'highway_type'); if (!N.attr(f, 'ausserhalb') && ['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street'].includes(h)) pool.push(f); }
const mid = f => { const ids = N.feat[f].ids[0], i = ids[Math.floor(ids.length / 2)]; return [N.x[i], N.y[i]]; };

// 1) Strukturpruefung: sind A-Kosten je Abschnitt <= C-Kosten, Abbiegekosten A <= C?
const reihe = ['A', 'B', 'C', 'D'], struktur = [];
for (const m of ['V', 'E']) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
  const kx = D.kosten[m][reihe[i]], ky = D.kosten[m][reihe[j]]; let teurer = 0, offenNurY = 0;
  for (let f = 0; f < kx.length; f++) { if (ky[f] && !kx[f]) offenNurY++; else if (ky[f] && kx[f] > ky[f] + 1e-12) teurer++; }
  struktur.push(`${m} ${reihe[i]} vs ${reihe[j]}: Abschnitte teurer fuer ${reihe[i]}: ${teurer}, nur fuer ${reihe[j]} offen: ${offenNurY}`);
}
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
  const ax = N.abb[reihe[i]], ay = N.abb[reihe[j]]; let t = 0, k = 0;
  ax.turn.forEach((s, key) => { if (s > (ay.turn.get(key) || 0) + 1e-9) t++; });
  ax.kurve.forEach((s, key) => { if (s > (ay.kurve.get(key) || 0) + 1e-9) k++; });
  struktur.push(`Abbiegen ${reihe[i]} vs ${reihe[j]}: Abbiegungen teurer fuer ${reihe[i]}: ${t}, Kurven teurer: ${k}`);
}

// Gegenprobe: X auf dem Korridor (Abschnitte) von Y routen, mit X-Kosten, X-Abbiegen, X-Modus
function korridor(X, Y, rY, p1, p2, modusX) {
  const fs_ = new Set(rY.rows.map(r => r.f)), orig = R.kosten(modusX, X), mask = new Array(orig.length).fill(0);
  let gesperrt = 0; fs_.forEach(f => { mask[f] = orig[f]; if (!orig[f]) gesperrt++; });
  if (gesperrt) return { moeglich: false, gesperrt, gesperrtM: rY.rows.filter(r => !orig[r.f]).reduce((s, r) => s + r.L, 0) };
  const R2 = Object.create(R); R2.kosten = (m, c) => c === X ? mask : R.kosten(m, c);
  const r = R2.routeProfil(X, p1, p2, modusX);
  if (!r.ok) return { moeglich: false, gesperrt: 0, text: r.ursache };
  return { moeglich: true, modell_min: r.modell_min, laenge_m: r.laenge_m, ursache: r.ursache || '' };
}

const out = [], faelle = [];
for (let k = 0; k < 80; k++) {
  const f1 = pool[Math.floor(rnd() * pool.length)], f2 = pool[Math.floor(rnd() * pool.length)];
  const p1 = mid(f1), p2 = mid(f2);
  const res = R.berechne(p1, p2, 'VALIDIERT');
  const o = OSRM[k];
  const row = { k, s: N.attr(f1, 'name'), z: N.attr(f2, 'name') };
  for (const c of ['REF', ...reihe]) {
    const r = res[c];
    row[c] = r.ok ? { L: Math.round(r.laenge_m), mod: +r.modell_min.toFixed(3), fz: +r.fahrzeit_min.toFixed(3), modus: r.modus, urs: r.ursache || '', dom: r.dominanz_von || '',
      zuf: r.zufahrt_m ? Math.round(r.zufahrt_m) : 0, unval: Math.round(r.unvalidiert_m || 0),
      start: r.rows[0].f, ende: r.rows[r.rows.length - 1].f, abb: r.abbiegen.length } : { L: null, urs: r.ursache };
    if (c !== 'REF' && o[c] !== (r.ok ? Math.round(r.laenge_m) : null)) row.abweichung_osrm = true;
  }
  out.push(row);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const X = reihe[i], Y = reihe[j], rx = res[X], ry = res[Y];
    if (!rx.ok || !ry.ok || rx.laenge_m <= ry.laenge_m + 20) continue;
    const mX = rx.modus === 'VALIDIERT' || rx.modus === 'VALIDIERT_BIS_ZUFAHRT' && !rx.validiert_ergebnis ? 'VALIDIERT' : 'EXPERIMENTELL';
    const g = korridor(X, Y, ry, p1, p2, rx.validiert_ergebnis ? 'EXPERIMENTELL' : 'VALIDIERT');
    faelle.push({ k, X, Y, LX: Math.round(rx.laenge_m), LY: Math.round(ry.laenge_m), modX: +rx.modell_min.toFixed(3), modY: +ry.modell_min.toFixed(3),
      fzX: +rx.fahrzeit_min.toFixed(3), fzY: +ry.fahrzeit_min.toFixed(3), modusX: rx.modus, modusY: ry.modus, ursX: rx.ursache || '', ursY: ry.ursache || '',
      domX: rx.dominanz_von || '', zufY: Math.round(ry.zufahrt_m || 0), zufX: Math.round(rx.zufahrt_m || 0),
      startGleich: rx.rows[0].f === ry.rows[0].f, endeGleich: rx.rows[rx.rows.length - 1].f === ry.rows[ry.rows.length - 1].f,
      endeAbstand: Math.round(Math.hypot(...(() => { const a = rx.rows[rx.rows.length - 1].pts.slice(-1)[0], b = ry.rows[ry.rows.length - 1].pts.slice(-1)[0]; return [a[0] - b[0], a[1] - b[1]]; })())),
      gegenprobe: g, mX });
  }
}
fs.writeFileSync(process.argv[4], JSON.stringify({ struktur, out, faelle }, null, 1));
console.log(struktur.join('\n'));
console.log('Abweichungen zu osrm.json:', out.filter(r => r.abweichung_osrm).map(r => r.k).join(',') || 'keine');
console.log('Faelle X laenger als Y (+20 m):', faelle.length, 'in Paaren', [...new Set(faelle.map(f => f.k))].join(','));
