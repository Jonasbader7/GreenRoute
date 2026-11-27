// BORS-Autoreferenz (REF) und A-D gegen OSRM (router.project-osrm.org, OSM, Profil car) auf 80 Zufallspaaren
const fs=require('fs'); require('../repo/bors_router.js');
const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
const N=new BORS.Netz(D), R=new BORS.Router(N);
function wgs(E,Nn){const y=(E-2600000)/1e6,x=(Nn-1200000)/1e6;
  const l=2.6779094+4.728982*y+0.791484*y*x+0.1306*y*x*x-0.0436*y*y*y;
  const p=16.9023892+3.238272*x-0.270978*y*y-0.002528*x*x-0.0447*y*y*x-0.0140*x*x*x; return [l*100/36,p*100/36];}
let seed=4242; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
// nur oeffentliche Strassen als Start/Ziel (keine service), damit OSRM und BORS gleich einrasten
const pool=[]; for(let f=0;f<D.segs.length;f++){const h=N.attr(f,'highway_type'); if(!N.attr(f,'ausserhalb') && ['residential','tertiary','secondary','primary','unclassified','living_street'].includes(h)) pool.push(f);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ const rows=[];
 for(let k=0;k<80;k++){
  const f1=pool[Math.floor(rnd()*pool.length)], f2=pool[Math.floor(rnd()*pool.length)];
  const mid=f=>{const ids=N.feat[f].ids[0], i=ids[Math.floor(ids.length/2)]; return [N.x[i],N.y[i]];};
  const p1=mid(f1), p2=mid(f2);
  const res=R.berechne(p1,p2,'VALIDIERT');
  const a=wgs(p1[0]+D.x0,p1[1]+D.y0), b=wgs(p2[0]+D.x0,p2[1]+D.y0);
  let o=null; try{ const r=await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=false`)).json(); if(r.code==='Ok') o=r.routes[0]; }catch(e){}
  const g=c=>res[c].ok?Math.round(res[c].laenge_m):null, t=c=>res[c].ok?+res[c].fahrzeit_min.toFixed(2):null;
  rows.push({k,s:N.attr(f1,'name'),z:N.attr(f2,'name'),luft:Math.round(Math.hypot(p1[0]-p2[0],p1[1]-p2[1])),
    osrm_m:o?Math.round(o.distance):null,osrm_min:o?+(o.duration/60).toFixed(2):null,
    REF:g('REF'),REF_min:t('REF'),A:g('A'),B:g('B'),C:g('C'),D:g('D'),
    modus:['A','B','C','D'].map(c=>res[c].ok?res[c].modus:'KEINE:'+res[c].ursache).join('|'),
    unval:['A','B','C','D'].map(c=>res[c].ok?Math.round(res[c].unvalidiert_m):'-').join('|')});
  await sleep(1100);
 }
 fs.writeFileSync('osrm.json',JSON.stringify(rows,null,0)); console.log('fertig',rows.length);
})();
