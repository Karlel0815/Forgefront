'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../tools/map-generator.cjs'),S=require('../tools/map-simulator.cjs');
const m=G.extractBlueprints(fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8'))[0];
const known={
1:[['mine',15,6],['factory',14,6],['turret',13,6],['turret',14,7]],
2:[['mine',7,14],['factory',8,14],['turret',9,14]],
3:[['turret',8,13]],
4:[['mine',12,16],['factory',12,15],['turret',13,15]],
5:[['turret',11,15]],
6:[['mine',11,4],['factory',12,4],['turret',12,5]]};
test('P1 independently reproduces real hard six-wave boss victory',()=>{
 const r=S.scriptedReference(m,known);
 assert.equal(r.status,'WIN_VERIFIED');
 assert.equal(r.history.length,6);
 assert.equal(r.bossDefeated,true);
 assert.equal(r.bossEscaped,false);
 assert.ok(r.hp>0);
});
test('P1 missing a defensive plan never produces a false victory',()=>{
 const dbg=S.boot(m);S.playWave(dbg,1);
 const state=dbg.snapshot();
 assert.equal(S.isVerifiedVictory(state),false);
 assert.notEqual(state.mode,'won');
});
test('P1 generated map real simulation is reproducible with fixed Hard enemy profile',()=>{
 const candidate=G.candidate(m,52741,'split','fixture');
 const a=S.analyze(candidate,{families:['balanced']});
 const b=S.analyze(candidate,{families:['balanced']});
 assert.deepEqual(a,b);
 assert.equal(a.profile,'hard-c1-l1-fixed-challenge0');
 assert.ok(['WIN_VERIFIED','NO_WIN_FOUND_WITHIN_SEARCH_BUDGET'].includes(a.status));
 for(const run of a.runs)for(const wave of run.history)
  if(wave.mode==='won')assert.ok(wave.bossDefeated&&!wave.bossEscaped&&wave.hp>0);
});
test('P1 invalid candidate is rejected before engine simulation',()=>{
 const result=S.analyze({...m,candidateId:'broken',ore:[[16,18]]});
 assert.equal(result.status,'REJECT_INVALID_MAP');
 assert.equal(result.runs.length,0);
});

test('P1 documented 3-seed manifest maps exactly match P0 preview geometry',()=>{
 const os=require('node:os'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'forgefront-p1-'));
 try {
   const out=path.join(temp,'out','results.json');
   const report=S.cli(['--seed','52741','--count','3','--out',out]);
   const maps=G.extractBlueprints(fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8'));
   assert.equal(report.results.length,3);
   for(let i=0;i<3;i++){
     const c=G.candidate(maps[i],(52741+i*1013)>>>0,['front','remote','split'][i],report.engineSourceHash);
     assert.equal(report.results[i].mapHash,c.mapHash);
     assert.ok(['WIN_VERIFIED','NO_WIN_FOUND_WITHIN_SEARCH_BUDGET'].includes(report.results[i].status));
   }
   const html=fs.readFileSync(path.join(temp,'out','review.html'),'utf8');
   assert.match(html,/echte Engine-Maptests/);
   assert.match(html,/WIN_VERIFIED|NO_WIN_FOUND_WITHIN_SEARCH_BUDGET/);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('P1 red-team fake victory flags do not pass independent boss assertion',()=>{
 assert.equal(S.isVerifiedVictory({wave:6,mode:'won',bossDefeated:false,bossEscaped:false,hp:15}),false);
 assert.equal(S.isVerifiedVictory({wave:6,mode:'won',bossDefeated:true,bossEscaped:true,hp:15}),false);
 assert.equal(S.isVerifiedVictory({wave:6,mode:'won',bossDefeated:true,bossEscaped:false,hp:0}),false);
});
