const fs=require('fs');const D=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const M=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
// WGS84 -> LV95 (Näherungsformeln swisstopo, ~1 m)
const lv95=(lon,lat)=>{const p=(lat*3600-169028.66)/10000,l=(lon*3600-26782.5)/10000;
 const E=2600072.37+211455.93*l-10938.51*l*p-0.36*l*p*p-44.54*l*l*l;const N=1200147.07+308807.95*p+3745.25*l*l+76.63*p*p-194.56*l*l*p+119.79*p*p*p;return [E,N];};
const C=Object.fromEntries(D.attr_cols.map((c,j)=>[c,j]));const A=(i,c)=>D.attr[i][C[c]];
const st=(c,i)=>D.kosten.V[c][i]>0?0:(D.kosten.E[c][i]>0?1:2);
const G=new Map(),Z=50;const key=(x,y)=>Math.floor(x/Z)+','+Math.floor(y/Z);
D.segs.forEach((s,i)=>{if(A(i,'ausserhalb'))return;s[0].forEach(ids=>{for(let k=0;k<ids.length-1;k++){const a=[D.nodes[2*ids[k]]/100,D.nodes[2*ids[k]+1]/100],b=[D.nodes[2*ids[k+1]]/100,D.nodes[2*ids[k+1]+1]/100];
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Z)+1;for(let t=0;t<=n;t++){const x=a[0]+(b[0]-a[0])*t/n,y=a[1]+(b[1]-a[1])*t/n;const kk=key(x,y);if(!G.has(kk))G.set(kk,[]);G.get(kk).push([i,a,b]);}}});});
const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const out={};const bsp=[];const segs=new Set();
for(const f of M.features){const art=f.properties.art;if(art==='Poller')continue;const [E,N]=lv95(...f.geometry.coordinates);const p=[E-D.x0,N-D.y0];
  let best=null;const gx=Math.floor(p[0]/Z),gy=Math.floor(p[1]/Z);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const [i,a,b] of (G.get((gx+dx)+','+(gy+dy))||[])){const d=dist(p,a,b);if(!best||d<best[0])best=[d,i];}
  const o=out[art]=out[art]||{alle:0,imGebiet:0,amRand:0,amRandEngDval:0};o.alle++;if(!best||best[0]>30)continue;o.imGebiet++;
  const [d,i]=best,med=A(i,'v9_fahrbahn_median_m'),lo=A(i,'v9_untere_schranke_m');if(med==null)continue;
  // «am Fahrbahnrand»: Abstand zur Achse zwischen halbe Fahrbahn - 0.5 m und halbe Fahrbahn + 1.0 m
  if(d>=med/2-0.5&&d<=med/2+1.0){o.amRand++;const gD=D.texte[D.grund.D[i]]||"",gC=D.texte[D.grund.C[i]]||"";if(/Spiegel ueber Trottoir/.test(gD+gC)){o.amRandEngDval++;segs.add(i);if(bsp.length<8)bsp.push(art+' '+(A(i,'name')||'?')+' (sicher '+lo.toFixed(2)+' m, Median '+med.toFixed(2)+' m, Abstand Achse '+d.toFixed(1)+' m)');}}}
console.log(JSON.stringify(out,null,1));console.log('Abschnitte C/D ungeklaert «nur mit Spiegel ueber Trottoir», mit Objekt am Rand:',segs.size);bsp.forEach(x=>console.log(' -',x));
