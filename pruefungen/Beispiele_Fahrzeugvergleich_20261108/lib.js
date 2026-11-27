'use strict';
const fs=require('fs'),path=require('path');
const WEB='C:/Users/Bader/OneDrive/Desktop/BORS/04_WebApp/Entwicklung_V14_Bruecken_Live';
const g={};new Function('globalThis','window',fs.readFileSync(path.join(WEB,'bors_router.js'),'utf8'))(g,undefined);
const D=JSON.parse(fs.readFileSync(path.join(WEB,'netz.json'),'utf8'));
const N=new g.BORS.Netz(D),R=new g.BORS.Router(N);
const A=(f,c)=>N.attr(f,c), T=i=>D.texte[i]||'';
const rel=([E,n])=>[E-D.x0,n-D.y0], abs=([x,y])=>[Math.round(x+D.x0),Math.round(y+D.y0)];
const WENDEN_S=+(process.env.WENDEN_S||60);
// Fahrzeit einer Zeilenfolge (wie routeProfil: L/speed, ohne Zuschläge)
const fz=rows=>rows.reduce((s,r)=>s+r.L/(A(r.f,'speed')/3.6),0);
const namen=rows=>{const o=[];for(const r of rows){const n=A(r.f,'name')||'(ohne Name)';if(o[o.length-1]!==n)o.push(n);}return o;};
// Überlappung (Meter von D, die auch A fährt)
function ueberlapp(ra,rd){const s=new Set(ra.rows.map(r=>r.f));return rd.rows.filter(r=>s.has(r.f)).reduce((x,r)=>x+r.L,0)/rd.laenge_m;}
// «D fährt wie A»: A-Route bis vor den ersten für D gesperrten Abschnitt, dort Wenden, dann beste D-Route
function naiv(ra,p2,c='D'){
  const rows=ra.rows;let i=rows.findIndex(r=>D.kat[c][r.f]!==0);
  if(i<0)return {frei:true};
  const r=rows[i], kat=D.kat[c][r.f];
  const pre=rows.slice(0,i), prefS=fz(pre), prefM=pre.reduce((s,x)=>s+x.L,0);
  // Wendepunkt 5 m vor dem Hindernis auf der Zufahrtsstrasse (wie index.html V15)
  const zur=(pts,d)=>{for(let k=pts.length-1;k>0;k--){const [x1,y1]=pts[k],[x0,y0]=pts[k-1],l=Math.hypot(x1-x0,y1-y0);if(l>=d)return [x1+(x0-x1)*d/l,y1+(y0-y1)*d/l];d-=l;}return pts[0];};
  const lz=pre[pre.length-1],bp=lz?zur(lz.pts,Math.min(5,lz.L/2)):r.pts[0];
  const rr=R.berechne(bp,p2,'VALIDIERT')[c];
  return {frei:false,i,kat,f:r.f,name:A(r.f,'name'),grund:T(D.grund[c][r.f]),bp,prefS,prefM,
    rest:rr.ok?{s:rr.fahrzeit_min*60,m:rr.laenge_m,ursache:rr.ursache||'',unv:rr.rows.filter(x=>x.kat!==0).length}:null,
    total:rr.ok?prefS+WENDEN_S+rr.fahrzeit_min*60:null};
}
module.exports={D,N,R,A,T,rel,abs,fz,namen,ueberlapp,naiv,WENDEN_S};
