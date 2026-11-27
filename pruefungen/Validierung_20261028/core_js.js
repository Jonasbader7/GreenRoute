// Zufaellige Start/Ziel-Paare: JS-Kern (N.route) rechnen, Ergebnis + Snaps fuer unabhaengige Pruefung speichern
const fs=require('fs'); require('../repo/bors_router.js');
const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
const N=new BORS.Netz(D), R=new BORS.Router(N);
let seed=12345; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
// Zufallspunkte: zufaelliger Abschnitt innerhalb Gebiet, zufaellige Stelle + 0-20 m Versatz
const inside=[]; for(let f=0;f<D.segs.length;f++) if(!N.attr(f,'ausserhalb')) inside.push(f);
function rpt(){const f=inside[Math.floor(rnd()*inside.length)]; const ids=N.feat[f].ids[0]; const i=Math.floor(rnd()*(ids.length)); return [N.x[ids[i]]+(rnd()-.5)*30, N.y[ids[i]]+(rnd()-.5)*30];}
const out=[]; const t0=Date.now();
for(let k=0;k<150;k++){ const p1=rpt(), p2=rpt();
  for(const m of ['V','E']) for(const c of ['REF','A','B','C','D']){
    const kosten=R.kosten(m,c); const [a1,o1]=R.naechste(p1,kosten), [a2,o2]=R.naechste(p2,kosten);
    if(!o1||!o2) continue;
    const pkt=R.punkteFuer(c,kosten); const r=N.route(o1[1],o1[2],o2[1],o2[2],kosten,pkt,N.abb[c]);
    out.push({k,m,c,sF:o1[1],sS:o1[2],tF:o2[1],tS:o2[2],cost:r?r[0]:null,weg:r?r[1]:null});
  }
}
fs.writeFileSync('core_js.json',JSON.stringify(out)); console.log('routes',out.length,'ok',out.filter(o=>o.cost!==null).length,'ms',Date.now()-t0);
