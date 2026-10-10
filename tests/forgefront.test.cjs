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
 },
 setLeaks(n){g.leaks=n;},
 endWin(leaks=0){g.leaks=leaks;g.bossDefeated=true;g.bossEscaped=false;g.mode='playing';g.phase='combat';finish(true);},
 endLoss(){g.bossDefeated=false;g.bossEscaped=true;g.mode='playing';g.phase='combat';finish(false);},
 accumulator:()=>acc,
 setAccumulator(value){acc=value;},
 readPlans(){return levelWaves().map(def=>({definition:def,units:makePlan(def)}));},
 panicProbe(shots){
  const e={kind:'panic',hp:6,max:6,speed:1.1,armor:0,wave:1,pos:1,panicked:false,enraged:false,id:99999};
  g.phase='combat';g.wave=1;g.enemies=[e];g.waves[0].alive=1;
  const initialGold=g.gold;
  const progress=[];
  for(const hit of shots){hitEnemy(e,hit,0);progress.push({hp:e.hp,speed:e.speed,panicked:e.panicked,alive:g.enemies.includes(e)});}
  return {progress,gold:g.gold-initialGold,kills:g.kills};
 },
 mortarPanicProbe(){
  const drones=Array.from({length:4},(_,i)=>({kind:'panic',hp:6,max:6,speed:1.1,armor:0,wave:1,
   pos:12+i*.08,panicked:false,enraged:false,id:88001+i}));
  g.wave=1;g.phase='combat';g.enemies=drones;g.waves[0].alive=4;refreshEnemyGeometry();
  const gold=g.gold,ammo=g.ammoSpent;
  shoot({type:'mortar',x:11,y:5},drones[0]);
  return {survivors:g.enemies.length,kills:g.kills,gold:g.gold-gold,ammo:g.ammoSpent-ammo};
 },
 bountyProbe(kind){
  const e={kind,hp:1,max:1,speed:0,armor:0,wave:1,pos:0,enraged:false,id:99996};
  g.phase='combat';g.wave=1;g.enemies=[e];g.waves[0].alive=1;
  const before=g.gold;killEnemy(e);return g.gold-before;
 },
 damageProbe(difficulty,raw=3,armor=0,pierce=0){
  g.difficulty=difficulty;g.phase='combat';g.wave=1;
  const enemy={id:42042,pos:0,hp:100,max:100,armor,kind:'normal',speed:0,wave:1,enraged:false};
  g.enemies=[enemy];g.waves[0].alive=1;hitEnemy(enemy,raw,pierce);
  return 100-enemy.hp;
 }
};\nwindow.ForgefrontDebug={`;
assert.ok(code.includes('window.ForgefrontDebug={'),'Debug hook missing');
const instrumented=code.replace('window.ForgefrontDebug={',hook);
function boot(difficulty='standard',existingStorage){
 const noop=()=>{};
 const ctx=new Proxy({},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const E={};let requestNext=null,clock=0;
 function elem(id){return {id,value:'standard',hidden:false,textContent:'',innerHTML:'',dataset:{},style:{},
  classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,
  addEventListener(t,fn){(this.events??={})[t]=fn},getContext(){return ctx},
  getBoundingClientRect(){return{width:864,height:960,left:0,top:0}},clientWidth:390,clientHeight:650};}
 const builds=['turret','cannon','mortar','mine','factory','pipe','bridge','eraser'].map(t=>{const v=elem(t);v.dataset.type=t;return v});
 const doc={hidden:false,body:{dataset:{}},getElementById(id){return E[id]??(E[id]=elem(id))},querySelectorAll(q){return q==='.build'?builds:[]},querySelector(q){return E[q]??(E[q]=elem(q))},addEventListener:noop};
 const storage=existingStorage??new Map();const win={innerWidth:390,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};const perf={now:()=>clock};
 vm.runInNewContext(instrumented,{window:win,document:doc,performance:perf,requestAnimationFrame(fn){requestNext=fn},console}, {timeout:12000});
 const dbg=win.ForgefrontDebug;
 assert.ok(dbg.setDifficulty(difficulty));assert.ok(dbg.startLevel('c1-l1'));
 return{dbg,qa:win.ForgefrontQA,E,storage,stepFrames(n,fps){for(let i=0;i<n;i++){clock+=1000/fps;requestNext(clock)}}};
}
const PLANS={
 'c1-l1':{
  1:[['mine',15,6],['factory',14,6],['turret',13,6],['turret',14,7]],
  2:[['mine',7,14],['factory',8,14],['turret',9,14]],
  3:[['turret',8,13]],
  4:[['mine',12,16],['factory',12,15],['turret',13,15]],
  5:[['turret',11,15]],
  6:[['mine',11,4],['factory',12,4],['turret',12,5]]},
 'c1-l2':{
  1:[['mine',11,4],['factory',10,4],['turret',10,5],['turret',10,3]],
  2:[['mine',7,13],['factory',7,12],['turret',6,12]],
  3:[['turret',8,12]],
  4:[['mine',15,12],['factory',14,12],['turret',14,11]],
  5:[['turret',14,13]],6:[]},
 'c1-l3':{
  1:[['mine',8,3],['factory',7,3],['turret',7,2],['turret',7,4]],
  2:[['mine',4,12],['factory',3,12],['turret',3,11]],
  3:[['turret',2,12]],
  4:[['mine',14,12],['factory',14,11],['turret',13,11]],
  5:[['turret',14,10]],
  6:[['mine',9,18],['factory',8,18],['turret',7,18]]}
};
const classicStart=PLANS['c1-l1'][1];
const mgStart=classicStart;
const standardSteps=PLANS['c1-l1'];
const mgSteps=standardSteps;
function build(b,steps){for(const [type,x,y] of steps)assert.equal(b.dbg.place(type,x,y),true,`cannot build ${type}@${x},${y}`);}
function runGame(mode,plan=standardSteps,levelId='c1-l1'){const b=boot(mode),data=[];if(levelId!=='c1-l1'){b.qa.endWin(0);b.dbg.showCampaign();if(levelId==='c1-l3'){assert.equal(b.dbg.startLevel('c1-l2'),true);b.qa.endWin(0);b.dbg.showCampaign();}assert.equal(b.dbg.startLevel(levelId),true);} for(let w=1;w<=6;w++){
  build(b,plan[w]);assert.equal(b.dbg.startWave(),true,`wave ${w} must start`);b.dbg.advance(200);const state=b.dbg.snapshot();
  assert.equal(state.wave,w);data.push({wave:w,hp:state.hp,kills:state.kills,leaks:state.leaks,gold:state.gold,boss:state.bossDefeated,mode:state.mode});
  if(state.mode!=='playing')break;
 }return{b,history:data,state:b.dbg.snapshot()};}

test('Unique DEV build stamp, flags and zero starting ammo',()=>{
 const b=boot('hard'),s=b.dbg.snapshot();assert.equal(b.dbg.buildId(),'0.5.0-dev2');
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
 const b=boot();assert.equal(b.dbg.place('turret',13,6),true);
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
test('Two MGs can receive complete supply from one connected factory',()=>{
 const b=boot('hard');build(b,classicStart);
 const mgs=b.dbg.forecast().filter(v=>v.max===.6);
 assert.equal(mgs.length,2);
 for(const m of mgs)assert.ok(Math.abs(m.ratio-1)<.001);
 assert.equal(b.dbg.snapshot().gold,67);
});
test('Every fired round is covered by produced ammunition',()=>{
 const b=boot('hard');build(b,classicStart);b.dbg.startWave();b.dbg.advance(100);
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
test('Only Standard and Schwer have identical starting gold and HQ',()=>{
 for(const [mode,[gold,hp]] of Object.entries({standard:[155,15],hard:[155,15]})){
  const x=boot(mode).dbg.snapshot();assert.equal(x.gold,gold);assert.equal(x.hp,hp);
 }
});
test('Simulated realtime loops agree across 15/30/60 FPS at wave end',()=>{
 const results=[];for(const fps of [15,30,60]){
  const b=boot('hard');build(b,classicStart);b.dbg.startWave();
  for(let i=0;i<80*fps;i++){
   b.stepFrames(1,fps);let x=b.dbg.snapshot();if(x.phase==='build'&&x.wave===1)break;
  }
  const s=b.dbg.snapshot();results.push({hp:s.hp,kills:s.kills,gold:s.gold,shots:s.shotsFired,leaks:s.leaks});
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
for(const difficulty of ['standard','hard']){
 test(`Six-wave full run ${difficulty}: actual boss kill, economy and survival`,()=>{
  const {history,state}=runGame(difficulty);
  assert.equal(history.length,6);assert.equal(state.mode,'won');assert.equal(state.bossDefeated,true);assert.equal(state.bossEscaped,false);
  assert.ok(state.hp>0);assert.equal(state.kills+state.leaks,history.length===6?150+1:-1);assert.ok(state.producedAmmo+1e-6>=state.ammoSpent);
 });
}
test('Difficulty modes use identical enemy and economy factors; only damage differs',()=>{
 const b=boot('standard'),modes=b.dbg.difficulties();
 assert.equal(JSON.stringify(Object.keys(modes)),JSON.stringify(['standard','hard']));
 assert.equal(modes.standard.startGold,modes.hard.startGold);
 assert.equal(modes.standard.hq,modes.hard.hq);
 assert.equal(modes.standard.enemyHp,modes.hard.enemyHp);
 assert.equal(modes.standard.spawn,modes.hard.spawn);
 assert.equal(modes.standard.damageBonus,.25);
 assert.equal(modes.hard.damageBonus,0);
 assert.equal(b.qa.damageProbe('hard',3,2,0),1);
 assert.equal(b.qa.damageProbe('standard',3,2,0),1.25);
 assert.equal(b.qa.damageProbe('hard',3,0,0),3);
 assert.equal(b.qa.damageProbe('standard',3,0,0),3.75);
 assert.equal(b.dbg.setDifficulty('easy'),false);
});
test('Combat speed is selectable at 1x/2x/3x, invalid inputs are rejected and reset is 2x',()=>{
 const b=boot('hard');
 assert.equal(b.dbg.speed(),2);
 assert.equal(b.dbg.setSpeed(3),false,'building phase cannot silently change tempo');
 assert.equal(b.dbg.startWave(),true);
 assert.equal(b.dbg.setSpeed(3),true);assert.equal(b.dbg.speed(),3);
 assert.equal(b.dbg.setSpeed(0),false);assert.equal(b.dbg.setSpeed(4),false);
 assert.equal(b.dbg.setSpeed('1'),true);assert.equal(b.dbg.speed(),1);
 assert.equal(b.dbg.setSpeed(2),true);assert.equal(b.dbg.speed(),2);
 b.dbg.showCampaign();assert.equal(b.dbg.startLevel('c1-l1'),true);
 assert.equal(b.dbg.speed(),2);
});
test('V0.4 historical stars and unlocks survive with separate V0.5 result keys',()=>{
 const storage=new Map();
 const old={version:2,difficulty:'crazy',theme:'light',tutorialSeen:true,
  results:{'c1-l1':{easy:{stars:3,leaks:0},normal:{stars:2,leaks:3},hard:{stars:1,leaks:7},crazy:{stars:3,leaks:0}}}};
 storage.set('forgefront.progress.v2',JSON.stringify(old));
 const b=boot('standard',storage);
 assert.equal(b.dbg.save().difficulty,'standard');
 assert.equal(b.dbg.levels()[1].unlocked,true);
 b.dbg.showCampaign();
 assert.ok(b.E['level-grid'].innerHTML.includes('V0.4 ★3'),'old stars must remain labeled as historic');
 assert.equal(b.dbg.startLevel('c1-l1'),true);
 b.qa.endWin(3);
 const history=b.dbg.save().results['c1-l1'];
 for(const k of ['easy','normal','hard','crazy'])assert.equal(JSON.stringify(history[k]),JSON.stringify(old.results['c1-l1'][k]));
 assert.equal(history.v05_standard.stars,2);
 assert.equal(history.v05_hard,undefined);
 b.dbg.showCampaign();assert.equal(b.dbg.setDifficulty('hard'),true);
 assert.equal(b.dbg.startLevel('c1-l1'),true);b.qa.endWin(0);
 assert.equal(b.dbg.save().results['c1-l1'].v05_hard.stars,3);
 assert.equal(history.hard.stars,1,'legacy Schwer medal must not be overwritten');
});


test('SAVE-01: malformed v1 cannot mask or overwrite a healthy v2 save',()=>{
 const storage=new Map(),old={version:2,difficulty:'hard',theme:'light',tutorialSeen:true,
  results:{'c1-l1':{hard:{stars:3,leaks:0},v05_hard:{stars:2,leaks:1}}}};
 storage.set('forgefront.progress.v1','{corrupted!');
 storage.set('forgefront.progress.v2',JSON.stringify(old));
 const b=boot('hard',storage);
 assert.equal(b.dbg.save().theme,'light');
 assert.equal(b.dbg.save().results['c1-l1'].hard.stars,3);
 assert.equal(b.dbg.save().results['c1-l1'].v05_hard.stars,2);
 assert.equal(b.dbg.levels()[1].unlocked,true);
 b.dbg.showCampaign();assert.equal(b.dbg.setDifficulty('standard'),true);
 const stored=JSON.parse(storage.get('forgefront.progress.v2'));
 assert.equal(stored.results['c1-l1'].hard.stars,3);
 assert.equal(stored.results['c1-l1'].v05_hard.stars,2);
 assert.equal(stored.difficulty,'standard');
 assert.equal(boot('standard',storage).dbg.save().results['c1-l1'].v05_hard.stars,2);
});
test('SAVE-02: malformed level entries cannot lose new V0.5 stars on JSON roundtrip',()=>{
 const invalid=[[],null,'broken',1,false,{}, {hard:{stars:3,leaks:0},v05_hard:{stars:2,leaks:3}}];
 for(const entry of invalid){
  const storage=new Map();
  storage.set('forgefront.progress.v2',JSON.stringify({version:2,difficulty:'standard',theme:'dark',
   tutorialSeen:true,results:{'c1-l1':entry}}));
  const b=boot('standard',storage);b.qa.endWin(0);
  const stored=JSON.parse(storage.get('forgefront.progress.v2')).results['c1-l1'];
  assert.equal(stored.v05_standard.stars,3,JSON.stringify(entry));
  assert.equal(boot('standard',storage).dbg.save().results['c1-l1'].v05_standard.stars,3);
  if(entry&&typeof entry==='object'&&!Array.isArray(entry)&&entry.hard){
   assert.equal(stored.hard.stars,3);assert.equal(stored.v05_hard.stars,2);
  }
 }
});
test('SAVE-03: malformed v2 bytes remain untouched even when the game autosaves',()=>{
 const storage=new Map(),damaged='{broken-v2-json';
 storage.set('forgefront.progress.v2',damaged);
 storage.set('forgefront.progress.v1',JSON.stringify({version:1,difficulty:'hard',theme:'light'}));
 const b=boot('standard',storage);
 assert.equal(storage.get('forgefront.progress.v2'),damaged);
 assert.ok(b.E['campaign-note'].textContent.includes('nicht gespeichert'));
 b.qa.endWin(0);
 assert.equal(storage.get('forgefront.progress.v2'),damaged,'never overwrite unreadable original bytes');
});
test('TEMPO-01: speed switches do not discard partial simulation time',()=>{
 const b=boot('hard');b.dbg.startWave();
 b.qa.setAccumulator(.019);
 assert.equal(b.dbg.setSpeed(3),true);assert.equal(b.qa.accumulator(),.019);
 assert.equal(b.dbg.setSpeed(3),true);assert.equal(b.qa.accumulator(),.019);
 b.E['pause'].events.click();
 assert.equal(b.dbg.setSpeed(1),true);assert.equal(b.qa.accumulator(),.019);
 const now=b.dbg.snapshot().time;
 b.stepFrames(20,60);assert.equal(b.dbg.snapshot().time,now);
 b.E['pause'].events.click();
 assert.equal(b.dbg.setSpeed(2),true);
});
test('TEMPO-02: first full combat wave has identical results at 1x, 2x and 3x',()=>{
 const runs=[];
 for(const speed of [1,2,3]){
  const b=boot('hard');build(b,classicStart);b.dbg.startWave();
  assert.equal(b.dbg.setSpeed(speed),true);
  let finished=false;
  for(let i=0;i<180*30;i++){
   b.stepFrames(1,30);
   const snapshot=b.dbg.snapshot();
   if(snapshot.phase==='build'&&snapshot.wave===1){finished=true;break;}
  }
  assert.ok(finished,'wave must finish at '+speed+'x');
  const x=b.dbg.snapshot();
  runs.push({hp:x.hp,kills:x.kills,gold:x.gold,shots:x.shotsFired,leaks:x.leaks,
    ammoSpent:x.ammoSpent,producedAmmo:x.producedAmmo,mode:x.mode,boss:x.bossDefeated});
 }
 assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);
});


test('DEV2: A20 bounties and fixed 20-gold completion reward',()=>{
 const b=boot('hard'),gold=b.dbg.config().goldPerType;
 assert.equal(JSON.stringify(gold),JSON.stringify({scout:1,normal:1,heavy:3,panic:1,boss:20}));
 assert.equal(b.dbg.config().goldPerWave,20);
 for(const [kind,bounty] of Object.entries(gold))assert.equal(b.qa.bountyProbe(kind),bounty,kind);
});
test('DEV2: Panikdrohne speeds up once only on a nonlethal hit',()=>{
 const b=boot('hard');
 const damaged=b.qa.panicProbe([3,1,1]);
 assert.ok(Math.abs(damaged.progress[0].speed-1.65)<1e-9);
 assert.equal(damaged.progress[1].speed,damaged.progress[0].speed);
 assert.equal(damaged.progress[2].speed,damaged.progress[0].speed);
 assert.equal(damaged.gold,0);
 const oneShot=boot('hard').qa.panicProbe([7]);
 assert.equal(oneShot.progress[0].alive,false);
 assert.equal(oneShot.progress[0].panicked,false);
 assert.equal(oneShot.gold,1);
});
test('DEV2: all 12 Schwer maps have six real waves and an actual boss kill',()=>{
 const costs={mine:22,factory:18,turret:24,cannon:38,mortar:42,pipe:4,bridge:10};
 const records=[];
 for(let chapter=1;chapter<=4;chapter++)for(let map=1;map<=3;map++){
  const id=`c${chapter}-l${map}`,b=boot('hard'),plan=PLANS[`c1-l${map}`];
  b.dbg.showCampaign();b.E['dev-test-levels'].events.click();
  assert.equal(b.dbg.startLevel(id),true);
  const history=[];
  for(let wave=1;wave<=6;wave++){
   let builds=plan[wave].slice();
   if(chapter===4&&map===1){
    if(wave===2)builds=plan[4].slice();
    if(wave===3)builds=[['cannon',12,14]];
    if(wave===4)builds=plan[2].slice();
   }
   for(const [type,x,y] of builds){
    let weapon=type;
    if(type==='turret'&&chapter>=2&&(wave===2||wave===4))weapon='cannon';
    if(type==='turret'&&chapter===4&&(wave===5||wave===6))weapon='cannon';
    else if(type==='turret'&&chapter===3&&wave===6)weapon='mortar';
    assert.ok(b.dbg.snapshot().gold>=costs[weapon],`${id} W${wave} lacks gold for ${weapon}`);
    assert.equal(b.dbg.place(weapon,x,y),true,`${id} W${wave} cannot place ${weapon}@${x},${y}`);
   }
   assert.equal(b.dbg.startWave(),true,`${id} W${wave} did not start`);
   b.dbg.advance(250);
   const state=b.dbg.snapshot();
   assert.equal(state.wave,wave,`${id} wrong wave index`);
   history.push({wave,gold:state.gold,hp:state.hp,kills:state.kills,leaks:state.leaks});
   if(wave<6)assert.equal(state.phase,'build',`${id} W${wave} ended early: ${state.mode}`);
  }
  const end=b.dbg.snapshot();
  assert.equal(end.mode,'won',`${id} lost: ${JSON.stringify(history)}`);
  assert.equal(end.bossDefeated,true,`${id} boss was not killed`);
  assert.equal(end.bossEscaped,false,`${id} boss escaped`);
  assert.ok(end.hp>0,`${id} HQ destroyed`);
  assert.ok(end.gold>=0,`${id} negative gold`);
  assert.ok(end.producedAmmo+1e-6>=end.ammoSpent,`${id} created free ammo`);
  assert.equal(end.kills+end.leaks,b.dbg.waves().reduce((n,w)=>n+w.count,0)+1,`${id} spawned wrong count`);
  records.push({id,gold:end.gold,hp:end.hp,leaks:end.leaks,kills:end.kills,
   boss:end.bossDefeated,buildings:end.buildings.length});
 }
 console.log('DEV2_12_FULLRUNS '+JSON.stringify(records));
 assert.equal(records.length,12);
});

test('DEV2: one supplied mortar salvo can destroy a clustered four-drone formation',()=>{
 const b=boot('hard'),s=b.qa.mortarPanicProbe();
 assert.equal(s.survivors,0);
 assert.equal(s.kills,4);
 assert.equal(s.gold,4);
 assert.ok(Math.abs(s.ammo-1.43)<1e-9);
 const mg=boot('hard').qa.panicProbe([3,3]);
 assert.equal(mg.progress[0].alive,true);
 assert.equal(mg.progress[0].panicked,true);
 assert.equal(mg.progress[1].alive,false);
});
test('DEV2: Standard and Schwer use exactly the same late-chapter enemy plan',()=>{
 const plans=[];
 for(const difficulty of ['hard','standard']){
  const b=boot(difficulty);b.dbg.showCampaign();b.E['dev-test-levels'].events.click();
  assert.equal(b.dbg.startLevel('c4-l3'),true);
  plans.push(JSON.stringify(b.qa.readPlans()));
 }
 assert.equal(plans[0],plans[1]);
});

test('DEV2: all twelve chapter/map wave profiles are distinct and follow planned types',()=>{
 const b=boot('hard');
 b.dbg.showCampaign();b.E['dev-test-levels'].events.click();
 const chapterTotals=[150,175,198,215];
 const snapshots=[];
 for(let c=1;c<=4;c++)for(let map=1;map<=3;map++){
  const id=`c${c}-l${map}`;
  assert.equal(b.dbg.startLevel(id),true,id);
  const arr=b.qa.readPlans();
  assert.equal(arr.length,6);
  const total=arr.reduce((sum,w)=>sum+w.definition.count,0);
  if(map===1)assert.equal(total,chapterTotals[c-1],id);
  if(map>1)assert.ok(total>chapterTotals[c-1],id);
  assert.ok(arr.every(w=>w.units.length===w.definition.count+(w.definition.boss?1:0)));
  assert.ok(arr.every((w,i)=>w.units.filter(x=>x.kind==='boss').length===(i===5?1:0)));
  for(const wave of arr){
   const kinds=wave.units.map(u=>u.kind);
   if(c===1)assert.ok(!kinds.includes('heavy')&&!kinds.includes('panic'));
   if(c===2)assert.ok(kinds.includes('heavy')&&!kinds.includes('panic'));
   if(c>=3){
    assert.ok(kinds.includes('panic')&&kinds.includes('heavy'));
    const drones=wave.units.filter(x=>x.kind==='panic');
    assert.equal(drones.length%4,0);
    assert.ok(drones.every(x=>x.hp===6&&x.armor===0&&x.speed===1.1));
    let groups=0;
    for(let i=0;i<kinds.length;i++)if(kinds[i]==='panic'&&(i===0||kinds[i-1]!=='panic')){
     groups++;assert.equal(kinds.slice(i,i+4).join(','),'panic,panic,panic,panic');
     assert.ok(wave.units.slice(i,i+3).every(x=>x.nextDelay===.36));
    }
    assert.equal(groups,wave.definition.panicGroups);
   }
  }
  snapshots.push({id,total,first:arr[0].units.map(u=>u.kind).join('|')});
 }
 assert.equal(new Set(snapshots.map(x=>x.total)).size,12);
});

test('Chapter 1 hard-locks advanced weapons, even through direct API calls',()=>{
 const b=boot('hard');
 assert.equal(b.dbg.allowedBuilding('turret'),true);
 assert.equal(b.dbg.allowedBuilding('cannon'),false);
 assert.equal(b.dbg.allowedBuilding('mortar'),false);
 assert.equal(b.dbg.place('cannon',13,6),false);
 assert.equal(b.dbg.place('mortar',13,6),false);
 assert.equal(b.dbg.select('cannon'),undefined);
 assert.equal(b.dbg.snapshot().selected,null);
});

test('Campaign entry is a locked level selection, not an intro dialogue',()=>{
 const b=boot('standard');assert.equal(b.dbg.snapshot().mode,'playing');
 assert.equal(b.dbg.snapshot().phase,'build');assert.equal(b.dbg.snapshot().wave,0);
 assert.equal(b.dbg.snapshot().levelId,'c1-l1');
 assert.equal(b.dbg.levels()[0].unlocked,true);
 assert.equal(b.dbg.levels()[1].unlocked,false);
 assert.equal(b.dbg.startLevel('c1-l2'),false);
 assert.equal(b.dbg.startLevel('c1-l3'),false);
 assert.equal(b.dbg.startLevel('unknown-level'),false);
 assert.equal(b.dbg.score(0),3);assert.equal(b.dbg.score(1),2);
 assert.equal(b.dbg.score(4),2);assert.equal(b.dbg.score(5),1);
});

test('First tutorial is automatic once, then only when help is requested',()=>{
 const b=boot('standard');assert.equal(b.dbg.snapshot().tutorial.active,true);
 assert.equal(b.dbg.save().tutorialSeen,true);
 b.dbg.showCampaign();assert.equal(b.dbg.startLevel('c1-l1'),true);
 assert.equal(b.dbg.snapshot().tutorial.active,false);
 b.E['help'].events.click();assert.equal(b.dbg.snapshot().tutorial.active,true);
 b.E['tutorial-skip'].events.click();assert.equal(b.dbg.snapshot().tutorial.active,false);
});

test('A boss escape cannot grant stars or unlock the next level',()=>{
 const b=boot('standard');b.qa.endLoss();
 assert.equal(b.dbg.snapshot().mode,'lost');
 assert.equal(b.E['result-rating'].hidden,true);
 assert.equal(b.E['result-next'].hidden,true);
 assert.equal(b.dbg.levels()[1].unlocked,false);
 assert.deepEqual(Object.keys(b.dbg.save().results),[]);
});

test('Boss kill awards difficulty-specific stars and unlocks next ready level',()=>{
 const b=boot('standard');b.qa.endWin(3);
 assert.equal(b.dbg.snapshot().mode,'won');assert.equal(b.E['result-rating'].textContent,'★★☆  ·  Standard');
 assert.equal(b.dbg.save().results['c1-l1'].v05_standard.stars,2);
 assert.equal(b.dbg.levels()[1].unlocked,true);
 assert.equal(b.E['result-next'].hidden,false);
 b.dbg.showCampaign();assert.equal(b.dbg.setDifficulty('hard'),true);
 assert.equal(b.dbg.save().results['c1-l1'].v05_hard,undefined);
 assert.equal(b.dbg.startLevel('c1-l2'),true);
 assert.equal(b.dbg.snapshot().difficulty,'hard');
 assert.equal(b.dbg.snapshot().wave,0);
});

test('Repeated wins never overwrite a better rating and are persisted across browser boots',()=>{
 const b=boot('standard');b.qa.endWin(0);
 assert.equal(b.dbg.save().results['c1-l1'].v05_standard.stars,3);
 b.dbg.startLevel('c1-l1');b.qa.endWin(6);
 assert.equal(b.dbg.save().results['c1-l1'].v05_standard.stars,3);
 const saved=b.storage.get('forgefront.progress.v2');assert.ok(saved);
 const second=boot('hard',b.storage);
 assert.equal(second.dbg.save().results['c1-l1'].v05_standard.stars,3);
 assert.equal(second.dbg.levels()[1].unlocked,true);
 assert.equal(second.dbg.snapshot().tutorial.active,false);
 assert.equal(second.dbg.save().difficulty,'hard');
});

test('Three genuine handcrafted maps and 3-slot Chapter 1',()=>{
 const b=boot();const first=b.dbg.map();
 assert.equal(b.dbg.levels().length,12);
 b.qa.endWin(0);b.dbg.showCampaign();assert.equal(b.dbg.startLevel('c1-l2'),true);
 const second=b.dbg.map();assert.notDeepEqual(second.path,first.path);
 assert.notDeepEqual(second.ore,first.ore);
 assert.equal(second.hq.x,16);
 b.qa.endWin(0);b.dbg.showCampaign();assert.equal(b.dbg.startLevel('c1-l3'),true);
 const third=b.dbg.map();assert.notDeepEqual(third.path,second.path);
 assert.notDeepEqual(third.path,first.path);
 for(const map of [first,second,third]){
  assert.equal(map.path.at(-1)[0],map.hq.x);assert.equal(map.path.at(-1)[1],map.hq.y);
  const road=new Set(map.path.map(v=>v.join(',')));
  const ore=new Set(map.ore);
  assert.equal(ore.size,map.ore.length,'ore positions must be unique');
  for(const [i,p] of map.path.entries()){
   assert.ok(p[0]>=0&&p[0]<18&&p[1]>=0&&p[1]<20);
   if(i)assert.equal(Math.abs(p[0]-map.path[i-1][0])+Math.abs(p[1]-map.path[i-1][1]),1);
  }
  for(const o of map.ore){const [x,y]=o.split(',').map(Number);assert.ok(x>=0&&x<18&&y>=0&&y<20);assert.equal(road.has(o),false,'ore must never overlap road');}
 }
});
for(const level of ['c1-l1','c1-l2','c1-l3'])for(const mode of ['standard','hard']){
 test(`Real MG-only victory ${level}/${mode} after 6 waves with boss killed`,()=>{
  const {history,state,b}=runGame(mode,PLANS[level],level);
  assert.equal(history.length,6,JSON.stringify(history));
  assert.equal(state.mode,'won',JSON.stringify(history));
  assert.equal(state.bossDefeated,true);assert.equal(state.bossEscaped,false);
  assert.ok(state.hp>0);assert.ok(state.producedAmmo+1e-6>=state.ammoSpent);
  assert.equal(state.kills+state.leaks,b.dbg.waves().reduce((n,w)=>n+w.count,0)+1);
  assert.equal(state.buildings.filter(b=>['cannon','mortar'].includes(b.type)).length,0);
 });
}

test('Boss escape on level 3 causes loss despite remaining HQ HP, never awards stars',()=>{
 const b=boot('standard');b.qa.endWin();b.dbg.showCampaign();b.dbg.startLevel('c1-l2');
 b.qa.endWin();b.dbg.showCampaign();b.dbg.startLevel('c1-l3');
 b.qa.forceFinal('boss',true);b.dbg.advance(.5);
 const s=b.dbg.snapshot();assert.equal(s.mode,'lost');assert.ok(s.hp>0);
 assert.equal(s.bossDefeated,false);assert.equal(s.bossEscaped,true);
 assert.equal(b.dbg.save().results['c1-l3'],undefined);
});


test('DEV test access is ephemeral and does not grant medals or story progress',()=>{
 const b=boot('standard');b.dbg.showCampaign();
 assert.equal(b.dbg.startLevel('c1-l2'),false);
 b.E['dev-test-levels'].events.click();
 assert.equal(b.dbg.testAccess(),true);
 assert.equal(b.dbg.startLevel('c1-l3'),true);
 b.qa.endWin(0);
 assert.equal(b.dbg.snapshot().mode,'won');
 assert.deepEqual(Object.keys(b.dbg.save().results),[]);
 const fresh=boot('standard',b.storage);
 assert.equal(fresh.dbg.testAccess(),false);
 assert.equal(fresh.dbg.startLevel('c1-l2'),false);
});

test('DEV1 preferences migrate but invalid old medals are not credited to redesigned maps',()=>{
 const storage=new Map();storage.set('forgefront.progress.v1',JSON.stringify({version:1,difficulty:'hard',theme:'light',tutorialSeen:true,results:{'c1-l1':{hard:{stars:3,leaks:0}},'c1-l2':{hard:{stars:3,leaks:0}}}}));
 const b=boot('hard',storage);
 assert.equal(b.dbg.save().version,2);
 assert.equal(b.dbg.save().theme,'light');
 assert.equal(b.dbg.save().tutorialSeen,true);
 assert.deepEqual(Object.keys(b.dbg.save().results),[]);
 assert.equal(b.dbg.startLevel('c1-l2'),false);
});

test('All four chapters share precisely the same three terrain maps',()=>{
 const b=boot(),maps=[];
 assert.equal(b.dbg.levels().length,12);
 assert.equal(JSON.stringify(b.dbg.chapters().map(c=>c.unlocked)),JSON.stringify([true,false,false,false]));
 b.E['dev-test-levels'].events.click();
 for(let c=1;c<=4;c++)for(let i=1;i<=3;i++){
  assert.equal(b.dbg.startLevel('c'+c+'-l'+i),true);
  maps.push({c,i,map:JSON.stringify(b.dbg.map())});
 }
 for(let c=2;c<=4;c++)for(let i=1;i<=3;i++){
  assert.equal(maps.find(m=>m.c===c&&m.i===i).map,maps.find(m=>m.c===1&&m.i===i).map);
 }
});
test('Four chapter wins unlock next weapon and persist per-map stars',()=>{
 const b=boot('standard');assert.equal(b.dbg.startLevel('c2-l1'),false);
 for(let c=1;c<=4;c++)for(let i=1;i<=3;i++){
  if(c!==1||i!==1)assert.equal(b.dbg.startLevel('c'+c+'-l'+i),true);
  assert.equal(b.dbg.allowedBuilding('cannon'),c>=2);
  assert.equal(b.dbg.allowedBuilding('mortar'),c>=3);
  assert.equal(b.dbg.allowedBuilding('research'),false);
  b.qa.endWin(0);
  if(i===3){
   assert.equal(b.E['result-unlock'].hidden,false);
   assert.match(b.E['o-title'].textContent,/ABGESCHLOSSEN/);
   if(c===1)assert.match(b.E['result-unlock'].textContent,/KANONE/);
   if(c===2)assert.match(b.E['result-unlock'].textContent,/MÖRSER/);
  }
 }
 assert.equal(Object.keys(b.dbg.save().results).length,12);
 assert.equal(b.dbg.chapters().every(ch=>ch.completed),true);
});
test('Boss escape at chapter boundary cannot grant weapon unlock',()=>{
 const b=boot('standard');
 b.qa.endWin();assert.equal(b.dbg.startLevel('c1-l2'),true);
 b.qa.endWin();assert.equal(b.dbg.startLevel('c1-l3'),true);
 b.qa.endLoss();
 assert.equal(b.dbg.chapters()[1].unlocked,false);
 assert.equal(b.dbg.startLevel('c2-l1'),false);
 assert.equal(b.E['result-unlock'].hidden,true);
});
test('Temporary test access opens all chapter maps, but never saves medals',()=>{
 const b=boot();assert.equal(b.dbg.startLevel('c4-l3'),false);
 b.E['dev-test-levels'].events.click();
 assert.equal(b.dbg.startLevel('c4-l3'),true);
 assert.equal(b.dbg.allowedBuilding('cannon'),true);
 assert.equal(b.dbg.allowedBuilding('mortar'),true);
 b.qa.endWin();assert.deepEqual(Object.keys(b.dbg.save().results),[]);
 const fresh=boot('standard',b.storage);assert.equal(fresh.dbg.startLevel('c4-l3'),false);
});
