const L=require('./lib.js');const {D,A,T,N}=L;
console.log('== harte Breitensperren (kat 2, Grund Breite:), A frei');
const rows=[];
for(let f=0;f<D.segs.length;f++){if(D.kat.A[f]!==0||A(f,'ausserhalb'))continue;
  const k=['B','C','D'].filter(c=>D.kat[c][f]===2&&/(^| \| )Breite:/.test(T(D.grund[c][f])));if(!k.length)continue;
  const c=k[0];rows.push([k.join(''),A(f,'name')||'?',A(f,'highway_type'),Math.round(N.feat[f].L),A(f,'v9_fahrbahn_median_m'),A(f,'v9_untere_schranke_m'),T(D.grund[c][f]).split(' | ').filter(p=>/^Breite:/.test(p)).join(' / ').slice(0,150),f]);}
rows.sort((a,b)=>a[0].length-b[0].length||b[3]-a[3]);for(const r of rows)console.log(r.join(' | '));
console.log('anzahl',rows.length);
console.log('== Abbiegen/Kurve UNMOEGLICH je Klasse');
for(const c of ['B','C','D']){const t=D.abb[c];let nt=0,nk=0;t.turn.forEach(x=>{if(/UNMOEGLICH/.test(T(x[4])))nt++;});t.kurve.forEach(x=>{if(/UNMOEGLICH/.test(T(x[3])))nk++;});console.log(c,'turn',t.turn.length,'unm',nt,'kurve',t.kurve.length,'unm',nk);}
const ex=D.abb.D.turn.find(x=>/UNMOEGLICH/.test(T(x[4])));console.log('Beispiel turn',JSON.stringify(ex),T(ex[4]));
const ek=D.abb.D.kurve.find(x=>/UNMOEGLICH/.test(T(x[3])));console.log('Beispiel kurve',JSON.stringify(ek),T(ek[3]));
console.log('konst',JSON.stringify(D.konst));
