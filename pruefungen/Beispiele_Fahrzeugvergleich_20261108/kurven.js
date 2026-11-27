const L=require('./lib.js');const {D,A,T,N}=L;
const TK=(u,a,b)=>(u*32768+a)*32768+b;
const tA=new Map();D.abb.A.turn.forEach(x=>tA.set(TK(x[0],x[1],x[2]),T(x[4])));
const tB=new Map();D.abb.B.turn.forEach(x=>tB.set(TK(x[0],x[1],x[2]),T(x[4])));
const tC=new Map();D.abb.C.turn.forEach(x=>tC.set(TK(x[0],x[1],x[2]),T(x[4])));
const HW=new Set(['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link']);
const sek={};const rows=[];
D.abb.D.turn.forEach(([u,a,b,s,tx])=>{const t=T(tx);sek[s]=(sek[s]||0)+1;if(!/UNMOEGLICH/.test(t))return;
 const k=TK(u,a,b);if(/UNMOEGLICH/.test(tA.get(k)||''))return;
 if(!A(a,'name')||!A(b,'name')||!HW.has(A(a,'highway_type'))||!HW.has(A(b,'highway_type')))return;
 if(D.kat.A[a]||D.kat.A[b]||D.kat.D[a]||D.kat.D[b])return;
 const g=+(t.match(/\((\d+) Grad\)/)||[])[1];
 rows.push({u,a,b,s,g,t,B:/UNMOEGLICH/.test(tB.get(k)||''),C:/UNMOEGLICH/.test(tC.get(k)||''),hwa:A(a,'highway_type'),hwb:A(b,'highway_type')});});
console.log('Zuschlaege D',JSON.stringify(sek));
console.log('Kandidaten',rows.length);
const h={};rows.forEach(r=>{const k=Math.floor(r.g/20)*20;h[k]=(h[k]||0)+1;});console.log('Winkel',JSON.stringify(h));
rows.filter(r=>!r.B).sort((x,y)=>y.g-x.g).slice(0,40).forEach(r=>console.log(r.g,'|',r.t,'|',r.hwa,'->',r.hwb,'C',r.C,'B',r.B));
// Beispieltext anderer Art
console.log(T(D.abb.D.turn[0][4]), '|', T(D.abb.C.turn[0][4]));
