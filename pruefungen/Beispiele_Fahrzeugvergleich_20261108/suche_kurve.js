// Kurve: A biegt an einer Stelle ab, die nach Schleppkurvenmodell für D UNMOEGLICH ist; D fährt anders
const L=require('./lib.js');const {D,N,R,A,T}=L;const fs=require('fs');
const TK=(u,a,b)=>(u*32768+a)*32768+b;
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const rnd=rng(20261110);
const mid=f=>{const ids=N.feat[f].ids[0];const i=ids[Math.floor(ids.length/2)];return [N.x[i],N.y[i]];};
const NOHW=new Set(['motorway','motorway_link','trunk','trunk_link','service','track','path','footway','cycleway']);
const HW=new Set(['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link']);
const ok=[];for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]||D.kat.D[f]||A(f,'ausserhalb')||A(f,'ist_service')||NOHW.has(A(f,'highway_type'))||N.feat[f].L<25||!A(f,'name'))continue;ok.push([f,...mid(f)]);}
const tB=new Set(),tA=new Set();D.abb.B.turn.forEach(x=>{if(/UNMOEGLICH/.test(T(x[4])))tB.add(TK(x[0],x[1],x[2]));});D.abb.A.turn.forEach(x=>{if(/UNMOEGLICH/.test(T(x[4])))tA.add(TK(x[0],x[1],x[2]));});
const kand=[];D.abb.D.turn.forEach(([u,a,b,s,tx])=>{const t=T(tx);if(!/UNMOEGLICH/.test(t))return;const k=TK(u,a,b);if(tA.has(k)||tB.has(k))return;
  if(!A(a,'name')||!A(b,'name')||!HW.has(A(a,'highway_type'))||!HW.has(A(b,'highway_type'))||D.kat.A[a]||D.kat.A[b]||D.kat.D[a]||D.kat.D[b])return;
  const g=+(t.match(/\((\d+) Grad\)/)||[])[1];if(g<105)return;kand.push({u,a,b,k,t,g});});
console.error('Abbiegestellen',kand.length);
const out=[];let n=0;const TRY=+(process.env.TRY||16);
for(const K of kand){const B=[N.x[K.u],N.y[K.u]];
  const zs=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>80&&d<1000;});const ss=ok.filter(([f,x,y])=>{const d=Math.hypot(x-B[0],y-B[1]);return d>500&&d<3500;});
  // Ziel in Richtung von b, Start in Richtung von a
  const pb=mid(K.b),pa=mid(K.a);
  const zsb=zs.filter(([f,x,y])=>(x-B[0])*(pb[0]-B[0])+(y-B[1])*(pb[1]-B[1])>0),ssa=ss.filter(([f,x,y])=>(x-B[0])*(pa[0]-B[0])+(y-B[1])*(pa[1]-B[1])>0);
  if(!zsb.length||!ssa.length)continue;
  for(let t=0;t<TRY;t++){const z=zsb[Math.floor(rnd()*zsb.length)],s=ssa[Math.floor(rnd()*ssa.length)];const p1=[s[1],s[2]],p2=[z[1],z[2]];n++;
    const ra=R.routeProfil('A',p1,p2,'V');if(!ra.ok||ra.ursache)continue;
    const i=ra.rows.findIndex((r,j)=>j>0&&ra.rows[j-1].f===K.a&&r.f===K.b);if(i<1)continue;
    if(ra.rows.slice(0,i+1).some(r=>D.kat.D[r.f]!==0))continue;
    const rd=R.routeProfil('D',p1,p2,'V');if(!rd.ok||rd.ursache)continue;
    if(rd.rows.some((r,j)=>j>0&&rd.rows[j-1].f===K.a&&r.f===K.b))continue;
    // wie A: bis 5 m vor die Abbiegung, wenden, dann beste Route ohne diese Abbiegung
    const pre=ra.rows.slice(0,i),lz=pre[pre.length-1];
    const zur=(pts,d)=>{for(let k=pts.length-1;k>0;k--){const [x1,y1]=pts[k],[x0,y0]=pts[k-1],l=Math.hypot(x1-x0,y1-y0);if(l>=d)return [x1+(x0-x1)*d/l,y1+(y0-y1)*d/l];d-=l;}return pts[0];};
    const bp=zur(lz.pts,Math.min(5,lz.L/2));const tt=N.abb.D.turn,alt=tt.get(K.k);tt.set(K.k,1e7);
    const rr=R.berechne(bp,p2,'VALIDIERT').D;tt.set(K.k,alt);
    if(!rr.ok||rr.modus!=='VALIDIERT')continue;
    const prefS=L.fz(pre),tot=prefS+60+rr.fahrzeit_min*60;
    out.push({t:K.t,g:K.g,s:L.abs(p1),z:L.abs(p2),sname:A(s[0],'name'),zname:A(z[0],'name'),A_min:+ra.fahrzeit_min.toFixed(2),D_min:+rd.fahrzeit_min.toFixed(2),naiv:+(tot/60).toFixed(2),spar:+(tot/60-rd.fahrzeit_min).toFixed(2),vor_m:Math.round(pre.reduce((s,x)=>s+x.L,0)),ueb:+L.ueberlapp(ra,rd).toFixed(2)});}}
console.error('Paare',n,'Treffer',out.length);fs.writeFileSync('treffer_kurve.json',JSON.stringify(out));
out.sort((a,b)=>b.spar-a.spar);for(const t of out.slice(0,40))console.log(t.spar.toFixed(1).padStart(5),'| A',t.A_min.toFixed(1),'D',t.D_min.toFixed(1),'naiv',t.naiv.toFixed(1),'vor',t.vor_m,'ueb',t.ueb,'|',t.t,'|',t.sname,'->',t.zname,JSON.stringify(t.s),JSON.stringify(t.z));
