const fs=require('fs');
const lade=d=>{const g={};new Function('globalThis','window',fs.readFileSync(d+'/bors_router.js','utf8'))(g,g);const D=JSON.parse(fs.readFileSync(d+'/netz.json','utf8'));return [new g.BORS.Router(new g.BORS.Netz(D)),D];};
const [R1,D1]=lade('Entwicklung_V13_Zweittest'),[R2]=lade('Entwicklung_V14_Bruecken_Live');
const idx=fs.readFileSync('Entwicklung_V13_Zweittest/index.html','utf8');const sz=[...idx.matchAll(/\{id:'(S\d)'[^}]*?s:\[([\d.]+),([\d.]+)\][^}]*?z:\[([\d.]+),([\d.]+)\]/g)].map(m=>[m[1],[+m[2],+m[3]],[+m[4],+m[5]]]);
const W=D1.wachen[0];const wache=[W[1]/100+D1.x0,W[2]/100+D1.y0];
const faelle=[['Wache->Kramgasse 49',wache,[2600900,1199650]],...sz.map(s=>[s[0],s[1],s[2]])];
const rel=p=>[p[0]-D1.x0,p[1]-D1.y0];const f=r=>r.ok?(r.fahrzeit_min.toFixed(1)+'min/'+(r.laenge_m/1000).toFixed(2)+'km '+r.modus.replace('VALIDIERT_BIS_ZUFAHRT','bisZuf').replace('EXPERIMENTELL','exp').replace('VALIDIERT','val')):'keine';
for(const [n,a,b] of faelle){const v1=R1.berechne(rel(a),rel(b),'VALIDIERT'),v2=R2.berechne(rel(a),rel(b),'VALIDIERT');console.log(n);for(const c of ['A','B','C','D'])console.log('  ',c,'V13',f(v1[c]),' | V14',f(v2[c]));}
