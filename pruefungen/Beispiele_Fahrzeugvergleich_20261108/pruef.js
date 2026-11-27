const L=require('./lib.js');
const F=JSON.parse(process.argv[2]);
for(const [id,s,z] of F){
  const q1=L.R.snap(L.rel(s),30),q2=L.R.snap(L.rel(z),30);
  const p1=[q1[0],q1[1]],p2=[q2[0],q2[1]];
  const res=L.R.berechne(p1,p2,'VALIDIERT');
  console.log('\n==',id,JSON.stringify(s),'->',JSON.stringify(z));
  for(const c of ['REF','A','B','C','D']){const r=res[c];if(!r.ok){console.log(c,'KEINE',r.ursache);continue;}
    console.log(c,(r.laenge_m/1000).toFixed(2)+' km',r.fahrzeit_min.toFixed(1)+' min',r.modus,r.ursache||'',r.dominanz_von?'dom:'+r.dominanz_von:'','unv',Math.round(r.unvalidiert_m||0));
    console.log('   ',L.namen(r.rows).filter(n=>n!=='(ohne Name)').join(' > ').slice(0,260));}
  for(const c of ['B','C','D']){const n=L.naiv(res.A,p2,c);if(n.frei){console.log(c,'A-Route frei');continue;}
    console.log(c,'wie A: nach',(n.prefM/1000).toFixed(2),'km /',(n.prefS/60).toFixed(1),'min an',n.name,'kat',n.kat,'|',n.grund.split(' | ')[0].slice(0,110),'| dann',n.rest&&(n.rest.s/60).toFixed(1),'min',n.rest&&n.rest.ursache,'| total(60s Wenden)',n.total&&(n.total/60).toFixed(1),'| mit 120s',n.total&&((n.total+60)/60).toFixed(1), 'BP',JSON.stringify(L.abs(n.bp)));}
}
