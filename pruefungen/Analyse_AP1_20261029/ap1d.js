// AP1: Wie viele der 80 Routen fahren je Klasse durch ein als UNMOEGLICH bewertetes Abbiegen/Kurve?
const fs=require('fs'); const REPO=process.argv[2]; require(REPO+'/bors_router.js');
const D=JSON.parse(fs.readFileSync(REPO+'/netz.json','utf8')); const N=new BORS.Netz(D), R=new BORS.Router(N);
let seed=4242; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
const pool=[]; for(let f=0;f<D.segs.length;f++){const h=N.attr(f,'highway_type'); if(!N.attr(f,'ausserhalb')&&['residential','tertiary','secondary','primary','unclassified','living_street'].includes(h)) pool.push(f);}
const mid=f=>{const ids=N.feat[f].ids[0],i=ids[Math.floor(ids.length/2)]; return [N.x[i],N.y[i]];};
const z={}; const paare={};
for(let k=0;k<80;k++){const a=pool[Math.floor(rnd()*pool.length)],b=pool[Math.floor(rnd()*pool.length)];
 const res=R.berechne(mid(a),mid(b),'VALIDIERT');
 for(const c of ['A','B','C','D']){const r=res[c]; if(!r.ok) continue; const n=r.abbiegen.filter(t=>/UNMOEGLICH/.test(t)).length; if(n){z[c]=(z[c]||0)+1; (paare[c]=paare[c]||[]).push(k+':'+r.modus[0]+(r.modus.includes('BIS')?'Z':''));}}}
console.log(JSON.stringify(z)); console.log(JSON.stringify(paare));
