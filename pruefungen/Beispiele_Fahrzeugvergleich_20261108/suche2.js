const L=require('./lib.js');const {D,N,R,A,T}=L;const fs=require('fs');
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const rnd=rng(20261108);
const mid=f=>{const ids=N.feat[f].ids[0];const i=ids[Math.floor(ids.length/2)];return [N.x[i],N.y[i]];};
const NOHW=new Set(['motorway','motorway_link','trunk','trunk_link','service','track','path','footway','cycleway']);
// Zielkandidaten: für A und D validiert, normale Strasse
const ok=[];for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]||D.kat.D[f]||A(f,'ausserhalb')||A(f,'ist_service')||NOHW.has(A(f,'highway_type'))||N.feat[f].L<25||!A(f,'name'))continue;ok.push([f,...mid(f)]);}
// Sperrgruppen
const grp={};for(let f=0;f<D.segs.length;f++){if(D.kat.D[f]!==2||D.kat.A[f]!==0||A(f,'ausserhalb'))continue;const nm=A(f,'name');if(!nm||/Parking/.test(nm))continue;
 const gr=T(D.grund.D[f]);const hart=gr.split(' | ').filter(p=>/^(Gewicht|Hoehe|Breite|Hindernis):/.test(p.trim())).map(p=>p.replace(/\(.*$/,'').trim());
 const k=nm+' || '+hart.join(' / ');(grp[k]=grp[k]||[]).push(f);}
const W=[D.wachen[0][1]/100,D.wachen[0][2]/100];
const out=[];let n=0;const t0=Date.now();
const TRY=+(process.env.TRY||14);
for(const [k,fs_] of Object.entries(grp).filter(([k])=>new RegExp(process.env.GRP).test(k))){
  const B=mid(fs_[0]);const fset=new Set(fs_);
  const zs=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>100&&d<2000;});
  const ss=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>800&&d<5000;});
  if(!zs.length)continue;
  for(let t=0;t<TRY;t++){
    const z=zs[Math.floor(rnd()*zs.length)];
    let s=null;if(t<3)s=[-1,...W];else{for(let q=0;q<40;q++){const c=ss[Math.floor(rnd()*ss.length)];const ax=c[1]-B[0],ay=c[2]-B[1],bx=z[1]-B[0],by=z[2]-B[1];if((ax*bx+ay*by)/Math.hypot(ax,ay)/Math.hypot(bx,by)<-0.5){s=c;break;}}}if(!s)continue;
    const p1=[s[1],s[2]],p2=[z[1],z[2]];n++;
    const ra=R.routeProfil('A',p1,p2,'V');if(!ra.ok||ra.ursache)continue;
    if(!ra.rows.some(r=>fset.has(r.f)))continue;
    const rd=R.routeProfil('D',p1,p2,'V');if(!rd.ok||rd.ursache)continue;
    const nv=L.naiv(ra,p2);if(nv.frei||nv.kat!==2||!nv.rest||nv.rest.ursache)continue;
    out.push({k,blk:nv.name,grund:nv.grund.split(' | ').filter(p=>/^(Gewicht|Hoehe|Breite|Hindernis):/.test(p.trim())).join(' / '),wache:s[0]<0,
      s:L.abs(p1),z:L.abs(p2),A_min:+ra.fahrzeit_min.toFixed(2),A_km:+(ra.laenge_m/1000).toFixed(2),D_min:+rd.fahrzeit_min.toFixed(2),D_km:+(rd.laenge_m/1000).toFixed(2),
      vor_m:Math.round(nv.prefM),vor_min:+(nv.prefS/60).toFixed(2),naiv_min:+(nv.total/60).toFixed(2),spar_min:+((nv.total/60)-rd.fahrzeit_min).toFixed(2),
      ueb:+L.ueberlapp(ra,rd).toFixed(2),C:D.kat.C[nv.f],B:D.kat.B[nv.f],zname:A(z[0],'name'),sname:s[0]<0?'Wache Viktoriastrasse':A(s[0],'name')});
  }
}
console.error('Paare',n,'Treffer',out.length,'s',(Date.now()-t0)/1000);
fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,0));
