const fs=require('fs');const dir=process.argv[2],N=+process.argv[3]||300;
const g={};new Function('globalThis','window',fs.readFileSync(dir+'/bors_router.js','utf8'))(g,g);const BORS=g.BORS;
const D=JSON.parse(fs.readFileSync(dir+'/netz.json','utf8'));const R=new BORS.Router(new BORS.Netz(D));
const ai=D.attr_cols.indexOf('ausserhalb');let seed=20261106;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const innen=[];for(let f=0;f<D.segs.length;f++)if(!D.attr[f][ai])innen.push(f);
const pt=()=>{const f=innen[Math.floor(rnd()*innen.length)],ids=D.segs[f][0][0],n=ids[Math.floor(rnd()*ids.length)];return [D.nodes[2*n]/100+(rnd()-0.5)*20,D.nodes[2*n+1]/100+(rnd()-0.5)*20];};
const K=['A','B','C','D'],F={},add=(k,info)=>{(F[k]=F[k]||[]).push(info);};let n=0,okV={A:0,B:0,C:0,D:0},t0=Date.now();
for(let i=0;i<N;i++){const p1=pt(),p2=pt();let V,E;
  try{V=R.berechne(p1,p2,'VALIDIERT');E=R.berechne(p1,p2,'EXPERIMENTELL');}catch(e){add('Ausnahme',String(e).slice(0,120));continue;}n++;
  for(const c of K){for(const [m,res,mk] of [['V',V[c],'V'],['E',E[c],'E']]){if(!res||!res.ok)continue;
      if(!isFinite(res.fahrzeit_min)||!isFinite(res.laenge_m)||res.fahrzeit_min<0)add('Zahl ungueltig',c+m+i);
      let unv=0;for(const x of res.rows){if(!(D.kosten[mk][c][x.f]>0))add('gesperrter Abschnitt in Route',c+m+' '+i+' f'+x.f);if(x.kat===2)add('kat 2 in Route',c+m+i);if(x.kat===1)unv+=x.L;}
      if((res.modus==='VALIDIERT'||res.modus==='VALIDIERT_BIS_ZUFAHRT')&&unv>0.5)add('validiert aber ungeklaert befahren',c+m+' '+i+' '+Math.round(unv)+'m');
      if(res.modus==='EXPERIMENTELL'&&Math.abs(unv-(res.unvalidiert_m||0))>2)add('unvalidiert_m stimmt nicht',c+m+' '+i+' '+Math.round(unv)+' vs '+Math.round(res.unvalidiert_m||0));
      if(m==='V'&&res.modus==='VALIDIERT')okV[c]++;}
    const v=V[c],e=E[c];
    if(v&&v.ok&&v.modus!=='EXPERIMENTELL'&&e&&e.ok&&e.modell_min>v.modell_min+0.01)add('experimentell teurer als validiert',c+' '+i+' '+e.modell_min.toFixed(2)+'>'+v.modell_min.toFixed(2));
    if(v&&v.ok&&v.modus!=='EXPERIMENTELL'&&!(e&&e.ok))add('validiert ok, experimentell keine Route',c+' '+i);
  }
  for(let a=0;a<3;a++){const x=V[K[a]],y=V[K[a+1]];if(x&&y&&x.ok&&y.ok&&x.modus==='VALIDIERT'&&y.modus==='VALIDIERT'&&x.modell_min>y.modell_min+0.01)add('kleinere Klasse teurer',K[a]+'>'+K[a+1]+' '+i+' '+x.modell_min.toFixed(2)+'>'+y.modell_min.toFixed(2));
    if(y&&y.ok&&y.modus==='VALIDIERT'&&!(x&&x.ok))add('grosse Klasse Route, kleine keine',K[a]+'/'+K[a+1]+' '+i);}
}
console.log('Paare gerechnet',n,'von',N,'in',((Date.now()-t0)/1000).toFixed(0),'s; voll validiert (V):',JSON.stringify(okV));
const ks=Object.keys(F);if(!ks.length)console.log('Keine Verletzung gefunden.');ks.forEach(k=>console.log(k+': '+F[k].length+'  z.B. '+F[k].slice(0,4).join(' | ')));
