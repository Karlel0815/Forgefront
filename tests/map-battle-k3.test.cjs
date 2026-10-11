'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const G=require('../tools/map-generator.cjs'),B=require('../tools/map-battle.cjs');
const K3=require('../tools/map-battle-k3.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
const templates=G.extractBlueprints(source);
function candidate(route,seed){
 const m=G.candidate(templates[route-1],seed,'front','k3-test');
 assert.equal(m.validation.valid,true,m.validation.errors.join('; '));
 return m;
}
test('K3 uses the real Hard engine, all guns and heavy/panic/boss waves',()=>{
 const {dbg}=B.boot(candidate(1,55000),source,{chapter:3});
 assert.equal(dbg.snapshot().difficulty,'hard');
 for(const weapon of ['turret','cannon','mortar'])
  assert.equal(dbg.allowedBuilding(weapon),true,weapon);
 const waves=dbg.waves();
 assert.equal(waves.length,6);
 assert.ok(waves.some(w=>w.composition.includes('Panzer')));
 assert.ok(waves.some(w=>w.composition.includes('Panikdrohne')));
 assert.ok(waves[5].composition.includes('Boss'));
});
test('K3 legal supply delivers ammo and fires cannon AND mortar',()=>{
 const m=candidate(1,55000),plan=G.findPlans(m)[0];
 for(const type of ['cannon','mortar']){
  const {dbg}=B.boot(m,source,{chapter:3});
  for(const b of plan.buildings){
   const actual=b.type==='turret'?type:b.type;
   assert.equal(dbg.place(actual,b.x,b.y),true,actual+' at '+b.x+','+b.y);
  }
  assert.equal(dbg.startWave(),true);
  dbg.advance(200);
  const state=dbg.snapshot(),gun=state.buildings.find(b=>b.type===type);
  assert.ok(gun.waveAmount>0,type+' received no ammunition in combat');
  assert.ok(state.producedAmmo>0,type+' ammunition not produced');
  assert.ok(state.ammoSpent>0,type+' did not spend ammunition');
  assert.ok(state.shotsFired>0,type+' never fired');
 }
});
test('K3 unsupported cannon and mortar cannot fire although buildable',()=>{
 const m=candidate(1,55000),pos=G.findPlans(m)[0].gun;
 for(const type of ['cannon','mortar']){
  const {dbg}=B.boot(m,source,{chapter:3});
  assert.equal(dbg.place(type,...pos),true);
  assert.equal(dbg.startWave(),true);
  dbg.advance(200);
  const s=dbg.snapshot(),gun=s.buildings.find(b=>b.type===type);
  assert.equal(gun.waveAmount,0,type+' had imaginary ammunition');
  assert.equal(s.producedAmmo,0);
  assert.equal(s.ammoSpent,0);
  assert.equal(s.shotsFired,0,type+' fired without a factory');
  assert.equal(s.bossDefeated,false);
  assert.notEqual(s.mode,'won');
 }
});
test('K3 reference seeds compare identical starts and genuine engine bosskills',()=>{
 for(const [route,seed] of [[1,55000],[3,61000]]){
  const report=K3.evaluate(candidate(route,seed),source);
  assert.equal(report.classification,'DIFFICULTY_NOT_CALIBRATED');
  assert.equal(report.runs.length,3);
  const [base,standard,optimized]=report.runs;
  assert.deepEqual(report.runs.map(r=>r.name),['baseline','standard','optimized']);
  const opening=r=>r.actions.filter(a=>a.wave===1).map(a=>[a.type,a.x,a.y]);
  assert.deepEqual(opening(base),opening(standard));
  assert.deepEqual(opening(standard),opening(optimized));
  for(const run of [standard,optimized]){
   assert.equal(run.result,'VERIFIED_HARD_BOSSKILL',seed+': '+run.error);
   assert.equal(run.verifiedWin,true);
   assert.equal(run.wave,6);
   assert.equal(run.bossDefeated,true);
   assert.equal(run.bossEscaped,false);
   assert.ok(run.hq>0);
   for(const h of run.history){
    assert.ok(h.producedAmmo+1e-6>=h.ammoSpent);
    for(const w of h.weaponSupply)assert.ok(w.delivered>=0);
   }
   assert.ok(run.usedWeapons.includes('cannon'));
   assert.ok(run.usedWeapons.includes('mortar'));
   assert.ok(run.suppliedWeapons.includes('turret'));
   assert.ok(run.suppliedWeapons.every(x=>run.usedWeapons.includes(x)));
  }
 }
});
test('K3 illegal placement and empty plan cannot create a win',()=>{
 const m=candidate(1,55000);
 const invalid=B.simulate(m,source,{name:'illegal',chapter:3,fixed:{1:[['mine',0,3]]}});
 assert.equal(invalid.verifiedWin,false);
 assert.equal(invalid.status,'INVALID_STRATEGY_OR_TIMEOUT');
 assert.match(invalid.error,/Illegal placement/);
 const empty=B.simulate(m,source,{name:'no-build',chapter:3,fixed:{}});
 assert.equal(empty.verifiedWin,false);
 assert.equal(empty.final.bossDefeated,false);
 assert.notEqual(empty.final.mode,'won');
});
test('K3 CLI limits bound simulation work',()=>{
 assert.throws(()=>K3.cli(['--count','13']),/Invalid seed\/count/);
 assert.throws(()=>K3.cli(['--seed','-1']),/Invalid seed\/count/);
});
