// AP1: Abbiegungen und Einrasten in Paar 54, 15, 51 je Klasse
const fs=require('fs'); const REPO=process.argv[2]; require(REPO+'/bors_router.js');
const D=JSON.parse(fs.readFileSync(REPO+'/netz.json','utf8')); const N=new BORS.Netz(D), R=new BORS.Router(N);
let seed=4242; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
const pool=[]; for(let f=0;f<D.segs.length;f++){const h=N.attr(f,'highway_type'); if(!N.attr(f,'ausserhalb')&&['residential','tertiary','secondary','primary','unclassified','living_street'].includes(h)) pool.push(f);}
const mid=f=>{const ids=N.feat[f].ids[0],i=ids[Math.floor(ids.length/2)]; return [N.x[i],N.y[i]];};
const P=[]; for(let k=0;k<80;k++){const a=pool[Math.floor(rnd()*pool.length)],b=pool[Math.floor(rnd()*pool.length)]; P.push([mid(a),mid(b)]);}
for(const k of [54,15,51]){ const res=R.berechne(P[k][0],P[k][1],'VALIDIERT'); console.log('--- Paar',k);
 for(const c of ['A','B','C','D']){const r=res[c]; console.log(c,r.modus,Math.round(r.laenge_m)+' m','modell',r.modell_min.toFixed(2),'fahrzeit',r.fahrzeit_min.toFixed(2),'| Start',r.rows[0].f,N.attr(r.rows[0].f,'name')||'', 'rest',Math.round(r.diag.start_rest_m||0),'| Abbiegen:',r.abbiegen.join(' ; ')||'-');}}
