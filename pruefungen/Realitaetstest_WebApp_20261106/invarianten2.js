const fs=require('fs');const dir=process.argv[2],WAHL=new Set(process.argv[3].split(',').flatMap(x=>{const [a,b]=x.split('-').map(Number);return b!=null?Array.from({length:b-a+1},(_,i)=>a+i):[a];}));
const g={};new Function('globalThis','window',fs.readFileSync(dir+'/bors_router.js','utf8'))(g,g);const BORS=g.BORS;
const D=JSON.parse(fs.readFileSync(dir+'/netz.json','utf8'));const R=new BORS.Router(new BORS.Netz(D));const ni=D.attr_cols.indexOf('name');
const ai=D.attr_cols.indexOf('ausserhalb');let seed=20261106;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const innen=[];for(let f=0;f<D.segs.length;f++)if(!D.attr[f][ai])innen.push(f);
const pt=()=>{const f=innen[Math.floor(rnd()*innen.length)],ids=D.segs[f][0][0],n=ids[Math.floor(rnd()*ids.length)];return [D.nodes[2*n]/100+(rnd()-0.5)*20,D.nodes[2*n+1]/100+(rnd()-0.5)*20];};
const K=['A','B','C','D'],F={},add=(k,info)=>{(F[k]=F[k]||[]).push(info);};let n=0;const max=Math.max(...WAHL);
for(let i=0;i<=max;i++){const p1=pt(),p2=pt();if(!WAHL.has(i))continue;const V=R.berechne(p1,p2,'VALIDIERT'),E=R.berechne(p1,p2,'EXPERIMENTELL');n++;
  for(const c of K){for(const [m,res] of [['V',V[c]],['E',E[c]]]){if(!res||!res.ok)continue;const mk=res.modus==='VALIDIERT'?'V':'E';
      let unv=0;for(const x of res.rows){if(!(D.kosten[mk][c][x.f]>0))add('gesperrt in Route',c+m+' '+i+' '+D.attr[x.f][ni]+' modus '+res.modus+(res.dominanz_von?' dom '+res.dominanz_von:''));if(x.kat===1)unv+=x.L;}
      if(res.modus==='VALIDIERT'&&unv>0.5)add('VALIDIERT mit ungeklaert',c+m+' '+i+' '+Math.round(unv)+'m'+(res.dominanz_von?' dom '+res.dominanz_von:''));
      if(res.modus==='VALIDIERT_BIS_ZUFAHRT'){if(Math.abs(unv-(res.zufahrt_m||0))>2)add('Zufahrt-Meter stimmen nicht',c+' '+i);if((res.zufahrt_m||0)>200)add('bis Zufahrt mit >200 m Zufahrt',c+m+' '+i+' '+Math.round(res.zufahrt_m)+'m (Anfang '+Math.round(res.zufahrt_anfang_m)+', Ende '+Math.round(res.zufahrt_ende_m)+')');}
      if(res.modus==='EXPERIMENTELL'&&Math.abs(unv-(res.unvalidiert_m||0))>2)add('unvalidiert_m',c+m+' '+i);}
    const v=V[c],e=E[c];
    if(v&&v.ok&&v.modus==='VALIDIERT'&&!v.dominanz_von&&e&&e.ok&&!e.dominanz_von&&e.modell_min>v.modell_min+0.01)add('E teurer als V (ohne Dominanz)',c+' '+i+' '+e.modell_min.toFixed(2)+'>'+v.modell_min.toFixed(2)+' ursE '+(e.ursache||'-')+' ursV '+(v.ursache||'-'));}
  for(let a=0;a<3;a++){const x=V[K[a]],y=V[K[a+1]];if(x&&y&&x.ok&&y.ok&&!x.ursache&&!y.ursache&&x.fahrzeit_min>y.fahrzeit_min+0.06)add('kleinere Klasse langsamer (Fahrzeit)',K[a]+'>'+K[a+1]+' '+i+' '+x.fahrzeit_min.toFixed(2)+'>'+y.fahrzeit_min.toFixed(2)+' '+x.modus+'/'+y.modus);}
}
console.log('Paare',n);const ks=Object.keys(F);if(!ks.length)console.log('Keine Verletzung.');ks.forEach(k=>console.log(k+': '+F[k].length+'\n   '+F[k].slice(0,6).join('\n   ')));
