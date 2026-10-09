'use strict';
// Forgefront regression tests use the shipped engine with a minimal fake DOM.
// The assertions evaluate game state independently; 'mode=won' by itself is insufficient.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
const hook=`window.ForgefrontQA={
 forceFinal(kind,atExit=false){
  g.mode='playing';g.phase='combat';g.wave=6;g.paused=false;g.hp=10;
  g.bossDefeated=false;g.bossEscaped=false;g.spawner=null;g.enemyDelay=null;
  g.enemies=[{id:99199,pos:atExit?PATH.length-1-.01:10,hp:1000,max:1000,speed:atExit?2:0,armor:0,kind,wave:6,enraged:false}];
  g.waves[5]={started:true,doneSpawning:true,alive:1,paid:false};refreshEnemyGeometry();
 },
 killFirst(){hitEnemy(g.enemies[0],10000,0)},
 forceEmptyCombat(){g.enemyDelay=null;g.spawner=null;g.enemies=[];g.waves[g.wave-1].doneSpawning=false;refreshEnemyGeometry();},
 putTarget(pos=19){g.enemyDelay=null;g.spawner=null;
  const enemy={id:88888,pos,hp:10000,max:10000,speed:0,armor:0,kind:'normal',wave:g.wave,enraged:false};
  g.enemies=[enemy];g.waves[g.wave-1].alive=1;g.waves[g.wave-1].doneSpawning=false;refreshEnemyGeometry();
 },
 clearTargets(){g.enemies=[];g.waves[g.wave-1].alive=0;g.waves[g.wave-1].doneSpawning=false;refreshEnemyGeometry();},
 splashVsReference(count=130){g.enemies=Array.from({length:count},(_,i)=>({id:90000+i,pos:(i*31.7/count)%34,hp:100,max:100,speed:0,armor:0,kind:'normal',wave:1,enraged:false}));
  refreshEnemyGeometry();let correct=true;
  for(const e of g.enemies){const p=enemyPos(e);
   const expected=g.enemies.filter(f=>{const q=enemyPos(f);return Math.hypot(p.x-q.x,p.y-q.y)<=1.45;}).length;
   if(splashCount(e,1.45)!==expected)correct=false;
  }
  return{correct,cached:splashCache.size,total:g.enemies.length};
 }
};\nwindow.ForgefrontDebug={`;
assert.ok(code.includes('window.ForgefrontDebug={'),'Debug hook missing');
const instrumented=code.replace('window.ForgefrontDebug={',hook);
function boot(difficulty='normal'){
 const noop=()=>{};
 const ctx=new Proxy({},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const E={};let requestNext=null,clock=0;
 function elem(id){return {id,value:'normal',hidden:false,textContent:'',innerHTML:'',dataset:{},style:{},
  classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,
  addEventListener(t,fn){(this.events??={})[t]=fn},getContext(){return ctx},
  getBoundingClientRect(){return{width:864,height:960,left:0,top:0}},clientWidth:390,clientHeight:650};}
 const builds=['turret','cannon','mortar','mine','factory','pipe','bridge','eraser'].map(t=>{const v=elem(t);v.dataset.type=t;return v});
 const doc={hidden:false,getElementById(id){return E[id]??(E[id]=elem(id))},querySelectorAll(q){return q==='.build'?builds:[]},querySelector(q){return E[q]??(E[q]=elem(q))},addEventListener:noop};
 const win={innerWidth:390};const perf={now:()=>clock};
 vm.runInNewContext(instrumented,{window:win,document:doc,performance:perf,requestAnimationFrame(fn){requestNext=fn},console}, {timeout:12000});
 const dbg=win.ForgefrontDebug;
 assert.ok(dbg.setDifficulty(difficulty));E['intro-skip'].events.click();
 return{dbg,qa:win.ForgefrontQA,E,stepFrames(n,fps){for(let i=0;i<n;i++){clock+=1000/fps;requestNext(clock)}}};
}
const classicStart=[['mine',15,6],['factory',14,6],['mortar',13,6],['mortar',14,7]];
const mgStart=[['mine',15,6],['factory',14,6],['mortar',13,6],['turret',14,7]];
const standardSteps={
 1:classicStart,2:[],3:[['mine',7,14],['factory',8,14],['mortar',9,14],['pipe',8,13],['cannon',9,13]],
 4:[['mine',3,9],['factory',4,9],['mortar',4,8],['cannon',5,8],['mine',10,17],['factory',10,16],['mortar',9,16]],
 5:[['cannon',11,16],['mine',12,16],['factory',12,15],['mortar',11,15],['cannon',13,15],['mortar',12,14]],6:[]
};
const mgSteps={...standardSteps,1:mgStart,3:[['mine',7,14],['factory',8,14],['mortar',9,14],['pipe',8,13],['mortar',9,13]]};
function build(b,steps){for(const [type,x,y] of steps)assert.equal(b.dbg.place(type,x,y),true,`cannot build ${type}@${x},${y}`);}
function runGame(mode,plan=standardSteps){const b=boot(mode),data=[];for(let w=1;w<=6;w++){
  build(b,plan[w]);assert.equal(b.dbg.startWave(),true,`wave ${w} must start`);b.dbg.advance(200);const state=b.dbg.snapshot();
  assert.equal(state.wave,w);data.push({wave:w,hp:state.hp,kills:state.kills,leaks:state.leaks,gold:state.gold,boss:state.bossDefeated,mode:state.mode});
  if(state.mode!=='playing')break;
 }return{b,history:data,state:b.dbg.snapshot()};}

test('Unique RC build stamp, flags and zero starting ammo',()=>{
 const b=boot('crazy'),s=b.dbg.snapshot();assert.equal(b.dbg.buildId(),'0.3.5-rc1');
 assert.equal(s.bossDefeated,false);assert.equal(s.bossEscaped,false);assert.equal(s.leaks,0);assert.equal(s.ammoSpent,0);
});
test('Boss escapes with remaining HQ: instant loss, boss-specific message',()=>{
 const b=boot();b.qa.forceFinal('boss',true);b.dbg.advance(.1);const s=b.dbg.snapshot();
 assert.equal(s.mode,'lost');assert.equal(s.bossEscaped,true);assert.equal(s.bossDefeated,false);
 assert.equal(s.hp,4);assert.equal(s.leaks,1);assert.equal(b.E['o-title'].textContent,'BOSS ENTWISCHT!');
 assert.equal(b.E['intro-skip'].hidden,true);
});
test('Boss killed, HQ alive, final wave complete: actual victory',()=>{
 const b=boot();b.qa.forceFinal('boss');b.qa.killFirst();b.dbg.advance(.1);const s=b.dbg.snapshot();
 assert.equal(s.mode,'won');assert.equal(s.bossDefeated,true);assert.equal(s.bossEscaped,false);
 assert.equal(s.kills,1);assert.equal(s.hp,10);
});
test('Finishing the last wave without a boss kill is not a victory',()=>{
 const b=boot();b.qa.forceFinal('normal');b.qa.killFirst();b.dbg.advance(.1);
 assert.equal(b.dbg.snapshot().mode,'lost');
});
test('No production without a mine/factory, no shots despite a target',()=>{
 const b=boot();assert.equal(b.dbg.place('mortar',13,6),true);
 b.dbg.startWave();b.qa.putTarget(19);b.dbg.advance(20);
 assert.equal(b.dbg.snapshot().shotsFired,0);assert.equal(b.dbg.snapshot().ammoSpent,0);
});
test('Charging happens in COMBAT only; at most one round is chambered while idle',()=>{
 const b=boot();build(b,[['mine',15,6],['factory',14,6],['turret',13,6]]);
 const planned=b.dbg.snapshot();b.dbg.advance(20);assert.equal(b.dbg.snapshot().time,0);
 assert.equal(b.dbg.snapshot().buildings[2].fireCharge,0);
 b.dbg.startWave();b.qa.forceEmptyCombat();b.dbg.advance(10);
 assert.equal(b.dbg.snapshot().shotsFired,0);assert.equal(b.dbg.snapshot().buildings[2].fireCharge,1);
 assert.ok(b.dbg.snapshot().producedAmmo>.2,'charged ammo must have been produced');
 b.qa.putTarget(19);b.dbg.advance(.04);assert.equal(b.dbg.snapshot().shotsFired,1);
 b.dbg.advance(.1);assert.equal(b.dbg.snapshot().shotsFired,1,'no free second shot on target reacquisition');
});
test('Two mortars have reduced but nonzero continuous ammunition supply',()=>{
 const b=boot('crazy');build(b,classicStart);
 const mortars=b.dbg.forecast().filter(v=>v.max===.65);
 assert.equal(mortars.length,2);
 for(const m of mortars)assert.ok(Math.abs(m.ratio-1.2/(2*.65))<.001);
 assert.equal(b.dbg.snapshot().gold,11);
});
test('Every fired round is covered by produced ammunition',()=>{
 const b=boot('crazy');build(b,classicStart);b.dbg.startWave();b.dbg.advance(100);
 const s=b.dbg.snapshot();assert.ok(s.shotsFired>0);assert.ok(s.ammoSpent>0);
 assert.ok(s.producedAmmo+1e-6>=s.ammoSpent,`spent ${s.ammoSpent} > produced ${s.producedAmmo}`);
});
test('Buildings can never be placed or erased during an attacking wave',()=>{
 const b=boot();build(b,[['mine',15,6],['factory',14,6],['turret',13,6]]);
 const gold=b.dbg.snapshot().gold,n=b.dbg.snapshot().buildings.length;b.dbg.startWave();
 assert.equal(b.dbg.place('turret',13,7),false);assert.equal(b.dbg.erase(13,6),false);
 assert.equal(b.dbg.snapshot().gold,gold);assert.equal(b.dbg.snapshot().buildings.length,n);
});
test('Mine removal stops ammunition forecast and refunds per build-phase policy',()=>{
 const b=boot();build(b,[['mine',15,6],['factory',14,6],['turret',13,6]]);
 const before=b.dbg.snapshot().gold;assert.equal(b.dbg.erase(15,6),true);
 assert.equal(b.dbg.snapshot().gold,before+22);
 const forecast=b.dbg.forecast();assert.equal(forecast.find(x=>x.max===1.2).rate,0);
});
test('Mortar splash spatial index agrees with full geometric reference for 130 enemies',()=>{
 const b=boot();const q=b.qa.splashVsReference(130);assert.equal(q.correct,true);assert.equal(q.cached,130);
});
test('All difficulty modes have correct starting gold and HQ',()=>{
 for(const [mode,[gold,hp]] of Object.entries({easy:[220,30],normal:[180,20],hard:[155,15],crazy:[135,10]})){
  const x=boot(mode).dbg.snapshot();assert.equal(x.gold,gold);assert.equal(x.hp,hp);
 }
});
test('Simulated realtime loops agree across 15/30/60 FPS at wave end',()=>{
 const results=[];for(const fps of [15,30,60]){
  const b=boot('crazy');build(b,classicStart);b.dbg.startWave();
  for(let i=0;i<80*fps;i++){
   b.stepFrames(1,fps);let x=b.dbg.snapshot();if(x.phase==='build'&&x.wave===1)break;
  }
  const s=b.dbg.snapshot();results.push({hp:s.hp,kills:s.kills,gold:s.gold,shots:s.shotsFired,leaks:s.leaks});
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
for(const difficulty of ['easy','normal','hard','crazy']){
 test(`Six-wave full run ${difficulty}: actual boss kill, economy and survival`,()=>{
  const {history,state}=runGame(difficulty);
  assert.equal(history.length,6);assert.equal(state.mode,'won');assert.equal(state.bossDefeated,true);assert.equal(state.bossEscaped,false);
  assert.ok(state.hp>0);assert.equal(state.kills+state.leaks,440);assert.ok(state.producedAmmo+1e-6>=state.ammoSpent);
  if(difficulty==='crazy')assert.ok(state.hp<=5,'crazy should retain meaningful difficulty');
 });
}
test('Alternative CRAZY mixed weapon start (mortar + MG) can defeat the boss',()=>{
 const {history,state}=runGame('crazy',mgSteps);assert.equal(history.length,6);
 assert.equal(state.mode,'won');assert.equal(state.bossDefeated,true);assert.equal(state.bossEscaped,false);
 assert.ok(state.hp>0);assert.equal(state.kills+state.leaks,440);
});
