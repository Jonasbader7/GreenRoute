const fs=require('fs'); const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
const ac={}; D.attr_cols.forEach((c,i)=>ac[c]=i); const A=(f,c)=>D.attr[f][ac[c]];
const C=['A','B','C','D']; const n=D.segs.length;
// Laenge je Abschnitt
const X=i=>D.nodes[2*i]/100, Y=i=>D.nodes[2*i+1]/100;
const len=D.segs.map(s=>s[0].reduce((t,ids)=>{for(let i=1;i<ids.length;i++)t+=Math.hypot(X(ids[i])-X(ids[i-1]),Y(ids[i])-Y(ids[i-1]));return t;},0));
for(const m of ['V','E']){ let v=0, vl=0, ex=[];
  for(let f=0;f<n;f++) for(let i=0;i<3;i++){const a=D.kosten[m][C[i]][f], b=D.kosten[m][C[i+1]][f];
    if(b && !a){v++; vl+=len[f]; if(ex.length<4) ex.push([A(f,'seg_id'),A(f,'name'),C[i],C[i+1]]);}}
  console.log(m,'Monotonie verletzt (schwerer erlaubt, leichter gesperrt):',v,'Abschnitte',(vl/1000).toFixed(2),'km',JSON.stringify(ex));}
let vk=0; for(const c of C) for(let f=0;f<n;f++) if(D.kosten.V[c][f] && D.kat[c][f]!==0) vk++;
console.log('Validiert-Modus mit unvalidiertem Abschnitt:',vk);
// Verhaeltnis E/V und Zeit je Meter vs speed
const r={}; for(const c of C) for(let f=0;f<n;f++){const v=D.kosten.V[c][f], e=D.kosten.E[c][f]; const k=D.kat[c][f];
  const base=1/(A(f,'speed')/3.6); const key=c+' kat'+k+' E/basis='+(e?(e/base).toFixed(2):'0')+' V/basis='+(v?(v/base).toFixed(2):'0'); r[key]=(r[key]||0)+1;}
Object.entries(r).sort().forEach(([k,v])=>console.log(k,v));
// km je Kategorie zum Abgleich mit Kontextzahlen
for(const c of C){const s=[0,0,0]; for(let f=0;f<n;f++) if(!A(f,'ausserhalb')) s[D.kat[c][f]]+=len[f]; console.log(c,'km kat0/1/2',s.map(x=>Math.round(x/1000)));}
// Speeds
const sp={}; for(let f=0;f<n;f++){const k=A(f,'highway_type')+':'+A(f,'speed'); sp[k]=(sp[k]||0)+len[f];}
console.log(Object.entries(sp).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>k+' '+Math.round(v/1000)+'km').join(' | '));
