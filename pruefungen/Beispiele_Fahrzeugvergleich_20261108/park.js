const L=require('./lib.js');const {D,A,T,N}=L;
const rows=[];
for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]!==0||D.kat.D[f]!==1||A(f,'ausserhalb')||!A(f,'name'))continue;
  const g=T(D.grund.D[f]);const m=g.match(/bei belegten Parkfeldern nur ([\d.]+) m < Bedarf ([\d.]+) m/);if(!m)continue;
  const fest=(g.match(/feste Breite reicht \(mind\. ([\d.]+) m\)/)||[])[1];
  rows.push({f,name:A(f,'name'),hw:A(f,'highway_type'),L:Math.round(N.feat[f].L),rest:+m[1],bed:+m[2],fest,gap:+(m[2]-m[1]).toFixed(2),C:D.kat.C[f],B:D.kat.B[f],gr:g.slice(0,160)});}
rows.sort((a,b)=>b.gap-a.gap);
console.log('anzahl',rows.length);
for(const r of rows.slice(0,40))console.log(r.gap,'|',r.name,r.hw,r.L+'m','rest',r.rest,'bed',r.bed,'fest',r.fest,'C'+r.C,'B'+r.B,'f'+r.f);
// Strassennamen-Zusammenfassung
const g={};rows.forEach(r=>{(g[r.name]=g[r.name]||{L:0,gap:0}).L+=r.L;g[r.name].gap=Math.max(g[r.name].gap,r.gap);});
console.log(Object.entries(g).filter(([k,v])=>v.gap>=0.5).sort((a,b)=>b[1].L-a[1].L).slice(0,40).map(([k,v])=>k+' '+v.L+'m gap'+v.gap).join('; '));
