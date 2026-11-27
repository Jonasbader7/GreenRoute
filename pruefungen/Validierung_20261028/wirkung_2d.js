// Vorschau V9.2d: netz.json-Kopie mit den Statuswechseln aus dem Testlauf, Routen S1-S5 + 80 Zufallspaare vorher/nachher
const fs=require('fs'); require('../repo/bors_router.js');
const D0=JSON.parse(fs.readFileSync('../repo/netz.json','utf8')), D1=JSON.parse(JSON.stringify(D0));
const ac={}; D0.attr_cols.forEach((c,i)=>ac[c]=i); const idx={}; D0.attr.forEach((a,f)=>idx[a[0]]=f);
const W=[['D','w4684618',2],['D','w25334273',2],['D','w322946731',2],['D','w1558491001',2],['C','w753741041',2],['D','w753741041',2],
         ['B','w23586279',1],['C','w23586279',1],['D','w23586279',1],['B','w1337245698',1],['C','w1337245698',1],['D','w1337245698',1]];
for(const [c,sid,k] of W){const f=idx[sid]; if(D1.kat[c][f]>=k) continue; const v=D1.kosten.V[c][f];
  D1.kat[c][f]=k; D1.kosten.V[c][f]=0; D1.kosten.E[c][f]= k===2?0:(v||D1.kosten.E[c][f])*D1.konst.RISIKO_FAKTOR;}
const R0=new BORS.Router(new BORS.Netz(D0)), R1=new BORS.Router(new BORS.Netz(D1));
const demo=JSON.parse(fs.readFileSync('C:/Users/Bader/Documents/BORS_V9/Demo/bors_demo_v9_2c.json','utf8')).szenarien;
const P=JSON.parse(fs.readFileSync('paare.json','utf8'));
const faelle=demo.map(s=>[s.id,[s.start_lv95[0]-D0.x0,s.start_lv95[1]-D0.y0],[s.ziel_lv95[0]-D0.x0,s.ziel_lv95[1]-D0.y0]]).concat(P.map(r=>['R'+r.k,[r.lv1[0]-D0.x0,r.lv1[1]-D0.y0],[r.lv2[0]-D0.x0,r.lv2[1]-D0.y0]]));
const fmt=r=>r.ok?(r.laenge_m/1000).toFixed(2)+' km '+r.modus:'keine Route'; const fmt2=r=>r.ok?(r.laenge_m/1000).toFixed(2)+' km, Modell '+r.modell_min.toFixed(2)+' min, '+r.modus+(r.unvalidiert_m?', unvalidiert '+Math.round(r.unvalidiert_m)+' m':''):'keine Route';
let n=0;
for(const [id,p1,p2] of faelle){const a=R0.berechne(p1,p2,'VALIDIERT'), b=R1.berechne(p1,p2,'VALIDIERT');
  for(const c of ['A','B','C','D']){ if(fmt(a[c])!==fmt(b[c])){ n++; console.log(id,c,'vorher',fmt2(a[c]),'| nachher',fmt2(b[c])); } } }
console.log('geaenderte Ergebnisse:',n,'von',faelle.length*4);
