const L=require('./lib.js');const {D,A,T}=L;
const g={};
for(let f=0;f<D.segs.length;f++){ if(D.kat.D[f]!==2||D.kat.A[f]!==0||A(f,'ausserhalb'))continue;
  const gr=T(D.grund.D[f]); const hart=gr.split(' | ').filter(p=>/^(Gewicht|Hoehe|Breite|Hindernis):/.test(p.trim()));
  const k=(A(f,'name')||'?')+' || '+hart.map(p=>p.replace(/\(.*$/,'').trim()).join(' / ');
  (g[k]=g[k]||{n:0,L:0,amtl:/Hinderniskartei|Tiefbau/.test(gr),C:D.kat.C[f],B:D.kat.B[f]}).n++; g[k].L+=L.N.feat[f].L;}
const a=Object.entries(g).sort((x,y)=>y[1].L-x[1].L);
console.log(a.length);for(const [k,v] of a.slice(0,140))console.log(Math.round(v.L)+'m',v.amtl?'AMTL':'    ','C'+v.C,'B'+v.B,k.slice(0,150));
