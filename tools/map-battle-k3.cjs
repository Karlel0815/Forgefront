#!/usr/bin/env node
'use strict';
// Offline Chapter-3 map qualification. Keeps src/game.js and P1 legacy tests unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('./map-generator.cjs'),B=require('./map-battle.cjs');
const profile='K3_HARD_ALL_CURRENT_WEAPONS_AND_ENEMIES';
const arsenal={2:'mortar',3:'cannon',4:'turret',5:'mortar',6:'cannon'};
function coverage(m,p,t){
 const r=t==='mortar'?5:t==='cannon'?4:3.3,min=t==='mortar'?1.5:0;
 return m.path.filter(q=>{
  const d=Math.hypot(p.gun[0]-q[0],p.gun[1]-q[1]);return d<=r&&d>=min;
 }).length;
}
function evaluate(m,source){
 const plans=G.findPlans(m);
 if(!plans.length)return {candidateId:m.candidateId,mapHash:m.mapHash,profile,
   classification:'UNTESTED_NO_START',runs:[]};
 const start=plans[0],alternatives=plans.slice(1);
 const economy=[...alternatives].sort((a,b)=>a.cost-b.cost||b.fire-a.fire);
 const adapted=[...alternatives].sort((a,b)=>
   (coverage(m,b,'cannon')+coverage(m,b,'mortar'))/(b.cost||1)-
   (coverage(m,a,'cannon')+coverage(m,a,'mortar'))/(a.cost||1));
 const std=B.simulate(m,source,{name:'standard',chapter:3,start,pool:economy,armory:arsenal});
 const opening=std.actions.filter(a=>a.wave===1).map(a=>[a.type,a.x,a.y]);
 const basic=B.simulate(m,source,{name:'baseline',chapter:3,fixed:{1:opening}});
 const smart=B.simulate(m,source,{name:'optimized',chapter:3,start,pool:adapted,armory:arsenal});
 const runs=[basic,std,smart],hashes=new Set(runs.map(r=>r.combatProfileHash));
 if(hashes.size!==1)throw Error('K3 wave profile differs across strategies');
 const startSign=r=>r.actions.filter(a=>a.wave===1).map(a=>[a.type,a.x,a.y]);
 if(JSON.stringify(startSign(std))!==JSON.stringify(startSign(smart))||
   JSON.stringify(startSign(std))!==JSON.stringify(startSign(basic)))
   throw Error('Different opening builds: comparison invalid');
 const summary=r=>({name:r.name,result:r.status,verifiedWin:r.verifiedWin,
   wave:r.history.length,leaks:r.final.leaks,hq:r.final.hp,
   bossDefeated:r.final.bossDefeated,bossEscaped:r.final.bossEscaped,
   stars:r.verifiedWin?(r.final.leaks===0?3:r.final.leaks<=4?2:1):0,
   paid:r.actions.length,usedWeapons:[...new Set(r.actions.filter(a=>
    ['turret','cannon','mortar'].includes(a.type)).map(a=>a.type))],
   history:r.history,actions:r.actions,error:r.error});
 return {candidateId:m.candidateId,seed:m.seed,motif:m.motif,route:m.routeId,
   mapHash:m.mapHash,profile,combatProfileHash:runs[0].combatProfileHash,
   classification:'DIFFICULTY_NOT_CALIBRATED',runs:runs.map(summary)};
}
function cli(args=process.argv.slice(2)){
 const opt={seed:52741,count:2,out:path.join(__dirname,'../generated/map-k3')};
 for(let i=0;i<args.length;i++){
  if(!['--seed','--count','--out'].includes(args[i])||!args[i+1])throw Error('Invalid option');
  opt[args[i++].slice(2)]=args[i];
 }
 const count=Number(opt.count),seed=Number(opt.seed);
 if(!Number.isInteger(count)||count<1||count>6||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)
  throw Error('Invalid seed/count');
 const source=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
 const batch=G.run({seed,count,out:opt.out,silent:true});
 const results=batch.maps.filter(m=>m.validation.valid).map(m=>evaluate(m,source));
 const file=path.join(path.resolve(opt.out),'k3-report.json');
 fs.writeFileSync(file,JSON.stringify({version:'K3.1',profile,
  sourceHash:crypto.createHash('sha256').update(source).digest('hex'),
  warning:'No-win is not an unsolvability proof. No difficulty calibration yet.',results},null,2)+'\n');
 const output={generated:batch.maps.length,assessed:results.length,
  attempts:results.reduce((n,r)=>n+r.runs.length,0),
  confirmedBosskillMaps:results.filter(r=>r.runs.some(x=>x.verifiedWin)).length,
  withCannon:results.filter(r=>r.runs.some(x=>x.usedWeapons?.includes('cannon'))).length,
  withMortar:results.filter(r=>r.runs.some(x=>x.usedWeapons?.includes('mortar'))).length,
  out:path.resolve(opt.out)};
 console.log(JSON.stringify(output));return {output,results};
}
if(require.main===module)try{cli();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={coverage,evaluate,cli};
