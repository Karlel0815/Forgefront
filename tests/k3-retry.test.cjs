'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const G=require('../tools/map-generator.cjs'),B=require('../tools/map-battle.cjs');
const R=require('../tools/k3-retry.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
test('K3 retry cohort is exactly the eight old no-win seeds',()=>{
 assert.deepEqual([...R.failedSeeds].sort((a,b)=>a-b),
  [52741,53754,54767,55780,56793,58819,59832,61858]);
});
test('K3 reinvestment never fabricates a win, uses legal build actions and keeps same combat',()=>{
 const original=G.extractBlueprints(source)[0];
 const m=G.candidate(original,52741,'front','k3-retry');
 const result=R.evaluate(m,source);
 assert.equal(result.seed,52741);
 assert.equal(result.original.win,false);
 assert.equal(result.original.bossKilled,false);
 assert.ok(result.addedNetworks>=0&&result.addedNetworks<=2);
 assert.equal(result.retry.status==='INVALID_STRATEGY_OR_TIMEOUT',false,result.retry.error);
 assert.equal(result.retry.win,result.retry.bossKilled&&!result.retry.bossEscaped&&
  result.retry.hp>0&&result.retry.waves===6);
 assert.ok(result.retry.supplied.includes('turret'));
 for(const action of result.retry.actions){
  assert.ok(Number.isInteger(action.x)&&Number.isInteger(action.y));
  assert.ok(action.goldAfter>=0,'Illegal negative building funds');
 }
 const other=G.candidate(original,55000,'front','k3-retry');
 assert.throws(()=>R.evaluate(other,source),/Outside failed pilot/);
});
