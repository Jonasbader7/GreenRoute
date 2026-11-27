// Wichtigkeit je Abschnitt: Anzahl Routen (Web-Router V9.2e, Netz V14/V17) von den Wachen zu 300 Zufallszielen, je Klasse B, C, D,
// Modus EXPERIMENTELL (nutzt auch ungeklaerte Abschnitte). Nur lesend. Aufruf: node r0_wichtigkeit.js <webapp_ordner> <ausgabe.csv>
const fs=require('fs');const dir=process.argv[2];
const g={};new Function('globalThis','window',fs.readFileSync(dir+'/bors_router.js','utf8'))(g,g);const BORS=g.BORS;
const D=JSON.parse(fs.readFileSync(dir+'/netz.json','utf8'));const R=new BORS.Router(new BORS.Netz(D));
const ai=D.attr_cols.indexOf('ausserhalb');let seed=20261110;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const innen=[];for(let f=0;f<D.segs.length;f++)if(!D.attr[f][ai])innen.push(f);
const pt=()=>{const f=innen[Math.floor(rnd()*innen.length)],ids=D.segs[f][0][0],n=ids[Math.floor(rnd()*ids.length)];return [D.nodes[2*n]/100+D.x0,D.nodes[2*n+1]/100+D.y0];};
const WACHEN=[[2598307.75,1200148.75],[2598133.0,1199905.375],[2601003.25,1200397.25]];
const cnt=new Map();let nok=0;
for(let i=0;i<300;i++){const z=pt();const w=WACHEN[i%3];
  const E=R.berechne([w[0]-D.x0,w[1]-D.y0],[z[0]-D.x0,z[1]-D.y0],'EXPERIMENTELL');
  for(const c of ['B','C','D']){const r=E[c];if(!r||!r.ok)continue;nok++;for(const x of r.rows){cnt.set(x.f,(cnt.get(x.f)||0)+1);}}}
const out=['seg_id;routen'];for(const [f,n] of cnt)out.push(D.attr[f][0]+';'+n);fs.writeFileSync(process.argv[3],out.join('\n'));
console.log('Routen ok',nok,'Abschnitte benutzt',cnt.size);
