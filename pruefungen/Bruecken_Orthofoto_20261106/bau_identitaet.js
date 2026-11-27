// Identitätstest: Live-Kern (aus index.html) mit dem Abruf 5.11. 16:08 und Zeitpunkt 16:22 gegen die Stadt-Einträge in netz.json (V13)
const fs=require('fs');const [html,netz,ordner,zeit]=process.argv.slice(2);
const h=fs.readFileSync(html,'utf8');const kern=h.slice(h.indexOf('// BAU-LIVE-KERN START'),h.indexOf('// BAU-LIVE-KERN ENDE'));
const K=new Function(kern+';return {bauGitter,bauStadt,bauMinRb,bauAnwenden,bauFaktor};')();
const D=JSON.parse(fs.readFileSync(netz,'utf8'));
const lies=n=>JSON.parse(fs.readFileSync(ordner+'/'+n+'.geojson','utf8')).features;
const t0=Date.now();const g=K.bauGitter(D);const t1=Date.now();const r=K.bauStadt(D,g,lies('baustellen').concat(lies('installationsplaetze')),zeit);const t2=Date.now();
const live=new Set(r.eintraege.map(e=>e[0])),stat=new Set(D.bau.filter(b=>/^Stadt Bern/.test(b[2])).map(b=>b[0]));
const nurLive=[...live].filter(f=>!stat.has(f)),nurStat=[...stat].filter(f=>!live.has(f));
console.log('Gitter',t1-t0,'ms, Zuordnung',t2-t1,'ms;',JSON.stringify(r.st));
console.log('Stadt-Abschnitte live',live.size,'| fest in netz.json',stat.size,'| nur live',nurLive.length,'| nur fest',nurStat.length);
const sid=f=>D.attr[f][0];if(nurLive.length)console.log(' nur live:',nurLive.slice(0,10).map(sid).join(','));if(nurStat.length)console.log(' nur fest:',nurStat.slice(0,10).map(sid).join(','));
// Kosten-Rundreise: fest -> live -> fest muss die Kosten exakt (bis 1e-9) zurückgeben
const kopie=JSON.parse(JSON.stringify(D.kosten));const alt=K.bauMinRb(D.bau);const neu=K.bauMinRb(D.bau.filter(b=>!/^Stadt Bern/.test(b[2])).concat(r.eintraege));
K.bauAnwenden(D,alt,neu,null);K.bauAnwenden(D,neu,alt,null);let maxd=0;for(const m of ['V','E'])for(const c of ['A','B','C','D'])D.kosten[m][c].forEach((k,f)=>{maxd=Math.max(maxd,Math.abs(k-kopie[m][c][f]));});
console.log('Rundreise max. Kostenabweichung',maxd);
