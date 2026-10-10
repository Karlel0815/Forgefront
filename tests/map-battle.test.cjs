'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const G=require('../tools/map-generator.cjs'),B=require('../tools/map-battle.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
const templates=G.extractBlueprints(source);
function snapshot(i=0){
 const t=templates[i],m={...t,width:18,height:20,seed:0,candidateId:'control-'+i,
   path:t.path.map(p=>[...p]),ore:t.ore.map(p=>[...p])};
 m.mapHash=crypto.createHash('sha256')
   .update(JSON.stringify({path:m.path,ore:m.ore,hq:m.hq})).digest('hex');
 return m;
}
const KNOWN={
 1:[['mine',15,6],['factory',14,6],['turret',13,6],['turret',14,7]],
 2:[['mine',7,14],['factory',8,14],['turret',9,14]],
 3:[['turret',8,13]],
 4:[['mine',12,16],['factory',12,15],['turret',13,15]],
 5:[['turret',11,15]],
 6:[['mine',11,4],['factory',12,4],['turret',12,5]]
};
test('P1 real VM map injection and fixed hard combat profile across three routes',()=>{
 const hashes=[];
 for(let i=0;i<3;i++){
   const b=B.boot(snapshot(i),source);
   assert.equal(JSON.stringify(b.dbg.map().path),JSON.stringify(templates[i].path));
   hashes.push(b.combatProfileHash);
 }
 assert.equal(hashes[0],hashes[1]);assert.equal(hashes[1],hashes[2]);
 assert.equal(source.includes('__fixture'),false);
});
test('P1 reject altered hashes and invalid paths instead of issuing ratings',()=>{
 assert.throws(()=>B.boot({...snapshot(),mapHash:'fake'},source),/hash mismatch/);
 assert.throws(()=>B.boot({...snapshot(),path:[[0,3],[2,3]]},source),/Invalid candidate/);
});
test('P1 known legal control genuinely wins six hard waves and kills the boss',()=>{
 const out=B.simulate(snapshot(),source,{name:'known-engine-control',fixed:KNOWN});
 assert.equal(out.history.length,6,out.error||out.status);
 assert.equal(out.final.mode,'won',out.error||out.status);
 assert.equal(out.final.bossDefeated,true);assert.equal(out.final.bossEscaped,false);
 assert.equal(out.verifiedWin,true);
 assert.ok(out.final.hp>0);
 assert.ok(out.final.producedAmmo+1e-6>=out.final.ammoSpent);
 assert.ok(out.actions.length>10);
});
test('P1 no buildings never fabricated into a victory',()=>{
 const out=B.simulate(snapshot(),source,{name:'empty-control',fixed:{}});
 assert.equal(out.verifiedWin,false);
 assert.equal(out.final.bossDefeated,false);
});
test('P1 generated ore is evaluated with actual engine and bounded strategies',()=>{
 const m=G.candidate(templates[0],52741,'split','run1');
 const r=B.evaluate(m,source,{budget:2});
 assert.equal(r.combatProfileId,'hard-c1-challenge0');
 assert.equal(r.difficulty,'NOT_CALIBRATED');
 assert.equal(r.strategiesAttempted,2);
 assert.ok(['VERIFIED_HARD_BOSSKILL','NO_WIN_FOUND_WITHIN_SEARCH_BUDGET'].includes(r.engineResult));
 for(const a of r.attempts){
   if(a.verifiedWin){assert.equal(a.history.length,6);assert.equal(a.final.bossDefeated,true);}
 }
 const none=B.evaluate(m,source,{budget:0});
 assert.equal(none.strategiesAttempted,0);
 assert.equal(none.engineResult,'NO_WIN_FOUND_WITHIN_SEARCH_BUDGET');
});
test('P1 CLI writes report and keeps game source untouched',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ff-map-p1-'));
 try{
   const {result}=B.run({count:1,seed:52741,budget:1,out:tmp,silent:true});
   assert.equal(result.generated,1);
   const data=JSON.parse(fs.readFileSync(path.join(tmp,'battle-report.json'),'utf8'));
   assert.equal(data.version,'P1.0');
   assert.match(fs.readFileSync(path.join(tmp,'battle-review.html'),'utf8'),/Unlösbarkeitsbeweis/);
   assert.equal(fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8'),source);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
