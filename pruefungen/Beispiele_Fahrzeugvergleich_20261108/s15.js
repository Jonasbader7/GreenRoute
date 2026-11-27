const L=require('./lib.js');
const SZ=[['S1',[2600929.2,1202822.9],[2599121.8,1202870.4]],['S2',[2594756.2,1194610.7],[2594124.6,1196109.9]],['S3',[2590088.4,1200197.5],[2588553.3,1202405.6]],['S4',[2600714.6,1197848.4],[2604328.1,1201006.8]],['S5',[2600030,1199650],[2600960,1199060]]];
for(const [id,s,z] of SZ){
  const p1=L.rel(s),p2=L.rel(z);
  // wie die Web-App: Klick auf Strasse ziehen
  const q1=L.R.snap(p1,30),q2=L.R.snap(p2,30);
  const res=L.R.berechne([q1[0],q1[1]],[q2[0],q2[1]],'VALIDIERT');
  console.log('\n==',id);
  for(const c of ['REF','A','B','C','D']){const r=res[c];
    if(!r.ok){console.log(c,'KEINE',r.ursache);continue;}
    console.log(c,(r.laenge_m/1000).toFixed(2)+' km',r.fahrzeit_min.toFixed(1)+' min',r.modus,r.ursache||'',r.dominanz_von?'dom:'+r.dominanz_von:'', 'unv '+Math.round(r.unvalidiert_m||0)+' m', JSON.stringify(r.diag).slice(0,160));
    console.log('   ',L.namen(r.rows).join(' > ').slice(0,300));
  }
  const n=L.naiv(res.A,[q2[0],q2[1]]);
  if(n.frei)console.log('A-Route ist für D frei'); else console.log('erster D-Abschnitt nicht validiert auf A-Route:',n.name,'kat',n.kat,'nach',Math.round(n.prefM),'m |',n.grund.slice(0,200),'| naiv',n.total&&(n.total/60).toFixed(1),'min');
  // alle gesperrten Abschnitte auf A-Route für D
  const sp=res.A.rows.filter(r=>L.D.kat.D[r.f]===2).map(r=>L.A(r.f,'name')+': '+L.T(L.D.grund.D[r.f]).slice(0,90));
  console.log('  D-gesperrt auf A-Route:',[...new Set(sp)]);
}
