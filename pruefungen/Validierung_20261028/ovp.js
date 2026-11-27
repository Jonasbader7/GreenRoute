const fs=require('fs'); const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
function wgs(E,Nn){const y=(E-2600000)/1e6,x=(Nn-1200000)/1e6;
  const l=2.6779094+4.728982*y+0.791484*y*x+0.1306*y*x*x-0.0436*y*y*y;
  const p=16.9023892+3.238272*x-0.270978*y*y-0.002528*x*x-0.0447*y*y*x-0.0140*x*x*x; return [l*100/36,p*100/36];}
let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9; for(let i=0;i<D.nodes.length;i+=2){const x=D.nodes[i]/100+D.x0,y=D.nodes[i+1]/100+D.y0; mnx=Math.min(mnx,x);mny=Math.min(mny,y);mxx=Math.max(mxx,x);mxy=Math.max(mxy,y);}
const a=wgs(mnx,mny), b=wgs(mxx,mxy); console.log('bbox',a,b);
const q=`[out:json][timeout:120];way["highway"]["width"](${a[1]},${a[0]},${b[1]},${b[0]});out tags;`;
(async()=>{const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'BORS-BFH-Validierung'}});
 const j=await r.json(); fs.writeFileSync('osm_width.json',JSON.stringify(j.elements)); console.log('ways mit width',j.elements.length);
 console.log('seg_id Beispiele',D.attr.slice(0,5).map(x=>x[0]), D.attr.filter(x=>!/^w\d+$/.test(x[0])).length,'nicht w<id>');})();
