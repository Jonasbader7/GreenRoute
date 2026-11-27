// Breite: A fährt durch eine Strasse, die für D nur bei freien Parkfeldern breit genug ist
const L=require('./lib.js');const {D,N,R,A,T}=L;const fs=require('fs');
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const rnd=rng(20261109);
const mid=f=>{const ids=N.feat[f].ids[0];const i=ids[Math.floor(ids.length/2)];return [N.x[i],N.y[i]];};
const NOHW=new Set(['motorway','motorway_link','trunk','trunk_link','service','track','path','footway','cycleway']);
const ok=[];for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]||D.kat.D[f]||A(f,'ausserhalb')||A(f,'ist_service')||NOHW.has(A(f,'highway_type'))||N.feat[f].L<25||!A(f,'name'))continue;ok.push([f,...mid(f)]);}
const PARK=/bei belegten Parkfeldern nur ([\d.]+) m < Bedarf ([\d.]+) m/;
const grp={};for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]!==0||D.kat.D[f]!==1||A(f,'ausserhalb')||!A(f,'name'))continue;const m=T(D.grund.D[f]).match(PARK);if(!m||m[2]-m[1]<0.35)continue;(grp[A(f,'name')]=grp[A(f,'name')]||[]).push(f);}
console.error('Strassen',Object.keys(grp).length);
const out=[];let n=0;const TRY=+(process.env.TRY||30);
for(const [k,fs_] of Object.entries(grp)){const B=mid(fs_[0]),fset=new Set(fs_);
  const zs=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>80&&d<1200;});const ss=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>600&&d<4000;});
  for(let t=0;t<TRY;t++){const z=zs[Math.floor(rnd()*zs.length)];if(!z)continue;let s=null;
    for(let q=0;q<40;q++){const c=ss[Math.floor(rnd()*ss.length)];if(!c)break;const ax=c[1]-B[0],ay=c[2]-B[1],bx=z[1]-B[0],by=z[2]-B[1];if((ax*bx+ay*by)/Math.hypot(ax,ay)/Math.hypot(bx,by)<-0.3){s=c;break;}}
    if(!s)continue;const p1=[s[1],s[2]],p2=[z[1],z[2]];n++;
    const ra=R.routeProfil('A',p1,p2,'V');if(!ra.ok||ra.ursache||!ra.rows.some(r=>fset.has(r.f)))continue;
    const i=ra.rows.findIndex(r=>D.kat.D[r.f]!==0);if(i<0||!fset.has(ra.rows[i].f))continue;
    const rd=R.routeProfil('D',p1,p2,'V');if(!rd.ok||rd.ursache)continue;
    const nv=L.naiv(ra,p2,'D');if(!nv.rest||nv.rest.ursache)continue;
    const m=T(D.grund.D[ra.rows[i].f]).match(PARK);
    out.push({k,s:L.abs(p1),z:L.abs(p2),sname:A(s[0],'name'),zname:A(z[0],'name'),A_min:+ra.fahrzeit_min.toFixed(2),D_min:+rd.fahrzeit_min.toFixed(2),naiv_min:+(nv.total/60).toFixed(2),spar:+(nv.total/60-rd.fahrzeit_min).toFixed(2),vor_m:Math.round(nv.prefM),ueb:+L.ueberlapp(ra,rd).toFixed(2),rest:m[1],bed:m[2],B:D.kat.B[ra.rows[i].f],C:D.kat.C[ra.rows[i].f]});}}
console.error('Paare',n,'Treffer',out.length);fs.writeFileSync('treffer_park.json',JSON.stringify(out));
out.sort((a,b)=>b.spar-a.spar);for(const t of out.slice(0,30))console.log(t.spar.toFixed(1).padStart(5),'| A',t.A_min.toFixed(1),'D',t.D_min.toFixed(1),'naiv',t.naiv_min.toFixed(1),'vor',t.vor_m,'ueb',t.ueb,'B'+t.B,'C'+t.C,'|',t.k,'rest',t.rest,'bed',t.bed,'|',t.sname,'->',t.zname,JSON.stringify(t.s),JSON.stringify(t.z));
