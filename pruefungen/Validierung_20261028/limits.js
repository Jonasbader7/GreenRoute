const fs=require('fs'); const D=JSON.parse(fs.readFileSync('../repo/netz.json','utf8'));
const ac={}; D.attr_cols.forEach((c,i)=>ac[c]=i);
const ids=new Set(D.attr.filter(a=>!a[ac.ausserhalb]).map(a=>+a[0].slice(1)));
const q=`[out:json][timeout:120];way["highway"]["maxheight"](46.8412,7.2459,47.0386,7.5792);out tags meta;way["highway"]["maxweight"](46.8412,7.2459,47.0386,7.5792);out tags meta;`;
(async()=>{const r=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'BORS-BFH-Validierung'}});
 const j=await r.json(); const el=j.elements.filter(e=>ids.has(e.id));
 for(const k of ['maxheight','maxweight']){ const w=el.filter(e=>e.tags[k]); const u=new Map(w.map(e=>[e.id,e])); const v=[...u.values()];
   const yrs=v.map(e=>+e.timestamp.slice(0,4)).sort((a,b)=>a-b);
   const src=v.filter(e=>Object.keys(e.tags).some(t=>t.startsWith('source:'+k)||t==='source:'+k||t==='maxheight:signed'||t==='maxweight:signed'||t==='traffic_sign'));
   const nonnum=v.filter(e=>isNaN(parseFloat(e.tags[k])));
   console.log(k,'Wege im Gebiet:',v.length,'mit Quellenangabe/traffic_sign:',src.length,'nicht numerisch:',nonnum.length,JSON.stringify(nonnum.slice(0,4).map(e=>e.tags[k])),'letzte Bearbeitung Median-Jahr:',yrs[yrs.length>>1],'aelter als 2020:',yrs.filter(y=>y<2020).length);
 }
 // Demo-Szenarien
 for(const id of [27047127]){const e=el.find(x=>x.id===id); console.log('S3 Wehrbruecke',e?JSON.stringify({t:e.tags,ts:e.timestamp,v:e.version}):'nicht gefunden');}
 const fel=D.attr.filter(a=>(a[ac.name]||'').includes('Felsenau')&&a[ac.maxweight]); for(const a of fel){const e=el.find(x=>x.id===+a[0].slice(1)); console.log('S1',a[0],a[ac.name],e?JSON.stringify({mw:e.tags.maxweight,src:Object.entries(e.tags).filter(([k])=>k.includes('source')||k.includes('sign')),ts:e.timestamp}):'');}
})();
