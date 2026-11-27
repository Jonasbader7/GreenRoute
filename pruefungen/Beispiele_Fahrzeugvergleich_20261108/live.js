// Live-Baustellen (Stand Browser 8.11.) wie bauUebernehmen anwenden, dann die Beispiele neu rechnen
const L=require('./lib.js');const {D}=L;
const BAU_K={BREITE:{A:2.20,B:2.45,C:2.90,D:3.00},RES:0.25,F_BAU:1.5,F_ENG:2.0};
const bauFaktor=(rb,c)=>rb==null?BAU_K.F_BAU:(rb<BAU_K.BREITE[c]+2*BAU_K.RES?BAU_K.F_ENG:BAU_K.F_BAU);
const minRb=e=>{const m=new Map();for(const b of e){const f=b[0];if(!m.has(f)||(b[1]!=null&&(m.get(f)==null||b[1]<m.get(f))))m.set(f,b[1]);}return m;};
const alt=minRb(D.bau),heute='2026-11-08';
const astra=D.bau.filter(b=>!/^Stadt Bern/.test(b[2]||'')&&(!b[4]||b[4]>=heute));
const neu=minRb(astra.concat(require('./bau_live.json')));
let n=0;for(const f of new Set([...alt.keys(),...neu.keys()]))for(const c of ['A','B','C','D']){const fa=alt.has(f)?bauFaktor(alt.get(f),c):1,fn=neu.has(f)?bauFaktor(neu.get(f),c):1;if(fa===fn)continue;n++;for(const m of ['V','E']){const k=D.kosten[m][c][f];if(k)D.kosten[m][c][f]=k*fn/fa;}}
console.log('Aenderungen',n,'alt',alt.size,'neu',neu.size);
for(const [id,s,z,c] of [['S1',[2597177,1194109],[2593852,1194776],'D'],['S1alt',[2597906,1197274],[2594450,1194684],'D'],['S2',[2602092,1203136],[2600060,1201156],'C'],['S3',[2602685,1202460],[2599729,1202486],'D']]){
  const p2=L.rel(z),res=L.R.berechne(L.rel(s),p2,'VALIDIERT');const nv=L.naiv(res.A,p2,c);
  const r=L.R.berechne(nv.bp,p2,'VALIDIERT')[c];
  console.log(id,'A',res.A.fahrzeit_min.toFixed(1),c,res[c].fahrzeit_min.toFixed(1),'vor',(nv.prefS/60).toFixed(1),'rest',r.fahrzeit_min.toFixed(1),'wieA',((nv.prefS+60)/60+r.fahrzeit_min).toFixed(1),'|',L.namen(r.rows).join(' > ').slice(0,200));
}
