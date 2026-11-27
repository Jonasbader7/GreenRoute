// Dieselben 80 Paare wie osrm.js (Seed 4242) mit WGS84-Koordinaten und BORS-Ergebnis REF/A-D
const fs=require('fs'); require('../repo/bors_router.js');
const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
const N=new BORS.Netz(D), R=new BORS.Router(N);
function wgs(E,Nn){const y=(E-2600000)/1e6,x=(Nn-1200000)/1e6;
  const l=2.6779094+4.728982*y+0.791484*y*x+0.1306*y*x*x-0.0436*y*y*y;
  const p=16.9023892+3.238272*x-0.270978*y*y-0.002528*x*x-0.0447*y*y*x-0.0140*x*x*x; return [l*100/36,p*100/36];}
let seed=4242; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
const pool=[]; for(let f=0;f<D.segs.length;f++){const h=N.attr(f,'highway_type'); if(!N.attr(f,'ausserhalb') && ['residential','tertiary','secondary','primary','unclassified','living_street'].includes(h)) pool.push(f);}
const O=JSON.parse(fs.readFileSync('osrm.json','utf8')); const out=[];
for(let k=0;k<80;k++){
  const f1=pool[Math.floor(rnd()*pool.length)], f2=pool[Math.floor(rnd()*pool.length)];
  const mid=f=>{const ids=N.feat[f].ids[0], i=ids[Math.floor(ids.length/2)]; return [N.x[i],N.y[i]];};
  const p1=mid(f1), p2=mid(f2); const a=wgs(p1[0]+D.x0,p1[1]+D.y0), b=wgs(p2[0]+D.x0,p2[1]+D.y0);
  out.push(Object.assign({}, O[k], {lv1:[Math.round(p1[0]+D.x0),Math.round(p1[1]+D.y0)], lv2:[Math.round(p2[0]+D.x0),Math.round(p2[1]+D.y0)], w1:[+a[1].toFixed(6),+a[0].toFixed(6)], w2:[+b[1].toFixed(6),+b[0].toFixed(6)], g1:N.attr(f1,'gemeinde'), g2:N.attr(f2,'gemeinde')}));
}
fs.writeFileSync('paare.json',JSON.stringify(out));
// Auswahl 15: nach Luftlinie geschichtet (kurz/mittel/lang), alle mit OSRM-Route
const ok=out.filter(r=>r.osrm_m&&r.REF).sort((x,y)=>x.luft-y.luft); const sel=[];
for(let i=0;i<15;i++) sel.push(ok[Math.round(i*(ok.length-1)/14)]);
fs.writeFileSync('auswahl.json',JSON.stringify(sel));
sel.forEach(r=>console.log(r.k, r.s,'('+r.g1+') ->',r.z,'('+r.g2+')', 'luft',r.luft,'BORS',r.REF,r.REF_min,'OSRM',r.osrm_m,r.osrm_min, r.w1.join(','), r.w2.join(',')));
