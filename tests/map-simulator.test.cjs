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
