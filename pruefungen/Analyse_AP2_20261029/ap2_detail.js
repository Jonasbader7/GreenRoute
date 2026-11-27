// AP2: Einzelfaelle pruefen (Einrasten je Seite, genutzte Abbiegungen, Abbiegen A teurer als B)
const fs=require('fs'); require(process.argv[2]);
const D=JSON.parse(fs.readFileSync(process.argv[3],'utf8')); const N=new BORS.Netz(D), R=new BORS.Router(N);
const P=JSON.parse(fs.readFileSync('paare.json','utf8')); const get=id=>P.find(p=>p.id===id);
// 1) Abbiegungen/Kurven, die fuer A teurer sind als fuer B
N.abb.A.turn.forEach((s,k)=>{const b=N.abb.B.turn.get(k)||0; if(s>b) console.log('Abbiegen A>B:',N.abb.A.ttext.get(k),'A',s,'B',b);});
N.abb.A.kurve.forEach((s,k)=>{const b=N.abb.B.kurve.get(k)||0; if(s>b) console.log('Kurve A>B:',N.abb.A.ktext.get(k>>1),'A',s,'B',b);});
// 2) Einrasten am Ziel (E292 C, E409 B) und Abbiegungen in E002/E204/E345
for(const [id,c] of [['E292','C'],['E409','B']]){const p=get(id), p2=N.lv2rel(...p.p2), kv=R.kosten('VALIDIERT',c); const [any,ok]=R.naechste(p2,kv);
  console.log(id,c,'Ziel: naechste',any[1],any[0].toFixed(1),'m',kv[any[1]]?'offen':'zu','| naechste offene',ok[1],ok[0].toFixed(1),'m');}
for(const [id,cs] of [['E002',['C','D']],['E204',['A','B']],['E345',['A','B']]]){const p=get(id); const res=R.berechne(N.lv2rel(...p.p1),N.lv2rel(...p.p2),'VALIDIERT');
  for(const c of cs){const r=res[c]; console.log(id,c,'modell',(r.modell_min*60).toFixed(1),'s, fahrzeit',(r.fahrzeit_min*60).toFixed(1),'s, Start',r.rows[0].f,'| Abbiegen:',r.abbiegen.join(' ; ')||'-');}}
