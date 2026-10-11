#!/usr/bin/env node
'use strict';
// Focused rerun of the 8 K3 pilot maps not beaten by A/B/C; internal only.
const fs=require('node:fs'),path=require('node:path');
const G=require('./map-generator.cjs'),B=require('./map-battle.cjs'),K=require('./map-battle-k3.cjs');
const failedSeeds=new Set([52741,53754,54767,55780,56793,58819,59832,61858]);
const cost={mine:22,factory:18,turret:24,cannon:38,mortar:42,pipe:4,bridge:10};
const arsenal={2:'mortar',3:'cannon',4:'turret',5:'mortar',6:'cannon'};
function reinforce(dbg,m,wave,actions,plans,control){
 if(wave<4||control.added>=2)return false;
 const type=wave===4?'mortar':'cannon',initial=dbg.snapshot();
 const occupied=new Set(initial.buildings.map(b=>b.x+','+b.y));
 const oldRates=dbg.rates();
 const section=type==='cannon'?m.path.slice(Math.floor(m.path.length*.55)):
   m.path.slice(0,Math.ceil(m.path.length*.6));
 const ranked=[...plans].sort((a,b)=>{
  const score=p=>section.filter(q=>Math.hypot(q[0]-p.gun[0],q[1]-p.gun[1])<=
    (type==='cannon'?4:5)).length*2-p.cost/30;
  return score(b)-score(a)||a.cost-b.cost;
 });
 for(const p of ranked){
  const batch=p.buildings.map(b=>b.type==='turret'?{...b,type}:b);
  const needed=batch.reduce((n,b)=>n+cost[b.type],0);
  if(needed>initial.gold-20||batch.some(b=>occupied.has(b.x+','+b.y)))continue;
  const built=[],logs=[],before=dbg.snapshot();
  let valid=true;
  for(const b of batch){
   if(!dbg.place(b.type,b.x,b.y,true)){valid=false;break;}
   built.push(b);logs.push({wave,type:b.type,x:b.x,y:b.y,goldAfter:dbg.snapshot().gold});
  }
  if(valid){
   const weapon=dbg.snapshot().buildings.find(b=>b.x===p.gun[0]&&b.y===p.gun[1]);
   const rates=dbg.rates();
   valid=(rates.find(r=>r.id===weapon?.id)?.planned||0)>=.2 &&
     oldRates.filter(r=>['turret','cannon','mortar'].includes(r.type))
       .every(r=>(rates.find(x=>x.id===r.id)?.planned||0)+.02>=r.planned*.7);
  }
  if(valid){actions.push(...logs);control.added++;return true;}
  for(const b of built.reverse())if(!dbg.erase(b.x,b.y,true))
    throw Error('Rollback failed');
  const after=dbg.snapshot();
  if(after.gold!==before.gold||after.buildings.length!==before.buildings.length)
    throw Error('Failed trial contaminated engine state');
 }
 return false;
}
function evaluate(m,source){
 if(!failedSeeds.has(m.seed))throw Error('Outside failed pilot cohort');
 const plans=G.findPlans(m);
 if(!plans.length)return {seed:m.seed,mapHash:m.mapHash,error:'No valid start'};
 const start=plans[0],alternatives=plans.slice(1);
 const ordered=[...alternatives].sort((a,b)=>
   (K.coverage(m,b,'cannon')+K.coverage(m,b,'mortar'))/(b.cost||1)-
   (K.coverage(m,a,'cannon')+K.coverage(m,a,'mortar'))/(a.cost||1));
 const original=B.simulate(m,source,{name:'original-C',chapter:3,start,pool:ordered,armory:arsenal});
 const control={added:0};
 const retry=B.simulate(m,source,{name:'reinvest-C',chapter:3,start,pool:ordered,armory:arsenal,
   extraBuild:(dbg,map,wave,actions)=>reinforce(dbg,map,wave,actions,plans,control)});
 if(original.combatProfileHash!==retry.combatProfileHash)throw Error('Combat profiles diverged');
 const opening=r=>JSON.stringify(r.actions.filter(a=>a.wave===1));
 if(opening(original)!==opening(retry))throw Error('Opening builds differ');
 const compact=r=>({win:r.verifiedWin,status:r.status,error:r.error,waves:r.history.length,
   bossKilled:r.final.bossDefeated,bossEscaped:r.final.bossEscaped,
   hp:r.final.hp,leaks:r.final.leaks,gold:r.final.gold,builds:r.actions.length,
   supplied:[...new Set(r.history.flatMap(h=>h.weaponSupply
     .filter(w=>w.delivered>.001).map(w=>w.type)))],
   actions:r.actions});
 return {seed:m.seed,route:m.routeId,motif:m.motif,mapHash:m.mapHash,
   profileHash:retry.combatProfileHash,addedNetworks:control.added,
   original:compact(original),retry:compact(retry)};
}
function run(out=path.join(__dirname,'../generated/map-k3-retry')){
 const src=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
 const batch=G.run({seed:52741,count:12,out,silent:true});
 const maps=batch.maps.filter(m=>failedSeeds.has(m.seed));
 if(maps.length!==8||maps.some(m=>!m.validation.valid))throw Error('Pilot cohort changed');
 const results=maps.map(m=>evaluate(m,src));
 const summary={testedMaps:results.length,attempts:results.length*2,
   oldWins:results.filter(r=>r.original.win).length,
   newWins:results.filter(r=>r.retry.win).length,
   addedNetworks:results.reduce((n,r)=>n+r.addedNetworks,0),
   newBosskills:results.filter(r=>!r.original.win&&r.retry.win).map(r=>r.seed)};
 fs.writeFileSync(path.join(path.resolve(out),'retry-report.json'),
   JSON.stringify({version:'K3.2-RETRY',summary,results},null,2)+'\n');
 console.log(JSON.stringify({summary,results:results.map(r=>({seed:r.seed,route:r.route,
   old:{win:r.original.win,hp:r.original.hp,leaks:r.original.leaks,gold:r.original.gold},
   retry:{win:r.retry.win,hp:r.retry.hp,leaks:r.retry.leaks,gold:r.retry.gold},
   addedNetworks:r.addedNetworks}))}));
 return {summary,results};
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={reinforce,evaluate,run,failedSeeds};
