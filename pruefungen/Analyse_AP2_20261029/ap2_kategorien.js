// AP2: geaenderte Ergebnisse (alt V9.2c -> neu V9.2e) nach Art ordnen
const fs=require('fs'); const alt=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), neu=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const K=r=>r.mod*60+2*(r.ka+r.ke+r.malus);
const ers=r=>!!r.ss||r.zs==='ZIEL_NICHT_ANFAHRBAR'||r.f4;
const weit=r=>r.ok&&((r.ss&&r.rs>150)||(r.zs==='ZIEL_NICHT_ANFAHRBAR'&&r.rz>150));
const kat={}, bsp={};
for(let k=0;k<alt.length;k++) for(const c of ['REF','A','B','C','D']){
  const x=alt[k][c], y=neu[k][c];
  const gleich=x.ok===y.ok&&(!x.ok?x.urs===y.urs:x.weg===y.weg&&Math.abs(x.mod-y.mod)<1e-9&&x.modus===y.modus&&x.urs===y.urs);
  if(gleich) continue;
  let t;
  if(weit(x)) t='1 alt Ersatz >150 m -> neu '+(y.ok?(y.rueck?'Rueckfall experimentell':'validiert'):'keine Route '+y.urs);
  else if(x.ok&&x.rueck&&y.ok&&!y.rueck) t='2 alt Rueckfall -> neu validiert (bis Zufahrt)';
  else if(!x.ok&&y.ok) t='3 alt keine Route -> neu Route';
  else if(x.ok&&y.ok&&x.rueck===y.rueck) t='4 gleicher Modus, Kosten '+(K(y)<K(x)-1?'besser':K(y)>K(x)+1?'SCHLECHTER':'gleich (+-1 s)');
  else t='5 sonst: '+(x.ok?(x.rueck?'R':'V'):'-')+'->'+(y.ok?(y.rueck?'R':'V'):'-');
  kat[t]=(kat[t]||0)+1; (bsp[t]=bsp[t]||[]).push(`${alt[k].id} ${c} K ${x.ok?K(x).toFixed(0):'-'}->${y.ok?K(y).toFixed(0):'-'} s`);
}
Object.keys(kat).sort().forEach(t=>console.log(String(kat[t]).padStart(4),t,'| z.B.',bsp[t].slice(0,4).join('; ')));
