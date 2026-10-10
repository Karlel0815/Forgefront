#!/usr/bin/env node
'use strict';
// Offline engine evaluator. Never runs on Pages or changes shipped campaign maps.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto'),G=require('./map-generator.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const key=p=>p.x+','+p.y;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const PRICE={mine:22,factory:18,turret:24,cannon:38,mortar:42,pipe:4,bridge:10};
const here=path.join(__dirname,'../src/game.js');
const plain=b=>({type:b.type,x:b.x,y:b.y});
function mapCheck(m){
 const bad=G.validateMap(m);if(bad.length)throw Error('Invalid candidate: '+bad.join('; '));
 if(m.width!==18||m.height!==20)throw Error('Incorrect dimensions');
 const digest=hash(JSON.stringify({path:m.path,ore:m.ore,hq:m.hq}));
 if(digest!==m.mapHash)throw Error('Map snapshot hash mismatch');
}
function instrument(source,m){
 mapCheck(m);
 const anchor='const CHAPTERS=[';
 if(source.split(anchor).length!==2||!source.includes('window.ForgefrontDebug={'))
   throw Error('Engine anchors changed');
 return source.replace(anchor,[
   'MAP_BLUEPRINTS[0].path=__fixture.path.map(p=>p.slice());',
   "MAP_BLUEPRINTS[0].ore=__fixture.ore.map(p=>p.join(','));",
   'MAP_BLUEPRINTS[0].hq={...__fixture.hq};',
   'MAP_BLUEPRINTS[0].challenge=0;',anchor].join('\n'));
}
function boot(m,source,opts={}){
 if(![1,3].includes(opts.chapter??1))throw Error('Unsupported chapter profile');
 const noop=()=>{},ctx=new Proxy({},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const E={};
 function elem(id){return{id,value:'standard',hidden:false,textContent:'',innerHTML:'',dataset:{},style:{},
   classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,
   addEventListener(t,fn){(this.events??={})[t]=fn},getContext(){return ctx},
   getBoundingClientRect(){return{width:864,height:960,left:0,top:0}},clientWidth:390,clientHeight:650};}
 const builds=['turret','cannon','mortar','mine','factory','pipe','bridge','eraser'].map(type=>{
   const el=elem(type);el.dataset.type=type;return el;});
 const document={hidden:false,body:{dataset:{}},
   getElementById:id=>E[id]??(E[id]=elem(id)),
   querySelectorAll:q=>q==='.build'?builds:[],
   querySelector:q=>E[q]??(E[q]=elem(q)),addEventListener:noop};
 const storage=new Map(),window={innerWidth:390,
   localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(instrument(source,m),{__fixture:JSON.parse(JSON.stringify(m)),
   window,document,performance:{now:()=>0},requestAnimationFrame:noop,console},{timeout:12000});
 const dbg=window.ForgefrontDebug;
 // Use the game's existing test-access UI event; no production source injection.
 if(opts.chapter===3)E['dev-test-levels'].events.click();
 if(!dbg||!dbg.setDifficulty('hard')||!dbg.startLevel('c'+(opts.chapter??1)+'-l1'))
   throw Error('Engine start failed');
 const actual=dbg.map();
 if(JSON.stringify(actual.path)!==JSON.stringify(m.path)||
   actual.ore.length!==m.ore.length||actual.hq.x!==m.hq.x||actual.hq.y!==m.hq.y)
   throw Error('VM map injection did not take effect');
 return {dbg,combatProfileHash:hash(JSON.stringify(dbg.waves()))};
}
function build(dbg,items,wave,log){
 for(const b of items){
   const before=dbg.snapshot();
   if(before.phase!=='build'||before.mode!=='playing')
     return 'Not in planning phase';
   if(!dbg.place(b.type,b.x,b.y,true))
     return 'Illegal placement '+b.type+'@'+b.x+','+b.y+' wave '+wave;
   const after=dbg.snapshot();
   if(after.gold!==before.gold-PRICE[b.type])
     return 'Gold mismatch after placement';
   log.push({wave,...plain(b),goldAfter:after.gold});
 }
 return null;
}
function exposure(m,b){
 return m.path.reduce((s,p)=>s+((p[0]-b.x)**2+(p[1]-b.y)**2<=3.3**2?1:0),0);
}
function appendMG(m,dbg,chain,wave,log){
 const buildings=dbg.snapshot().buildings;
 if(dbg.snapshot().gold<24)return;
 const f=chain.buildings.find(b=>b.type==='factory');
 const gun=chain.buildings.find(b=>b.type==='turret');
 // Follow only the actual ammunition segment, not metal pipes.
 const pipes=chain.buildings.filter(b=>b.type==='pipe'||b.type==='bridge');
 const ammo=[],seen=new Set();
 for(const b of pipes)if(dist(b,gun)===1){ammo.push(b);seen.add(key(b));}
 for(let i=0;i<ammo.length;i++)for(const p of pipes)
   if(!seen.has(key(p))&&dist(p,ammo[i])===1){seen.add(key(p));ammo.push(p);}
 const nodes=[f,...ammo],occ=new Set(buildings.map(key));
 // A single factory supplies 1.2 ammo/s: never add more than two MGs to
 // this local ammunition component merely to improve a test outcome.
 const suppliedMGs=buildings.filter(b=>b.type==='turret'&&
   nodes.some(p=>dist(p,b)===1));
 if(suppliedMGs.length>=2)return;
 const blocked=new Set([...m.path,...m.ore].map(p=>p.join(',')));
 const options=[];
 for(const n of nodes)for(const [dx,dy] of dirs){
   const b={type:'turret',x:n.x+dx,y:n.y+dy};
   if(b.x<0||b.x>=18||b.y<0||b.y>=20||occ.has(key(b))||blocked.has(key(b)))continue;
   if(exposure(m,b)>=4)options.push(b);
 }
 options.sort((a,b)=>exposure(m,b)-exposure(m,a)||dist(a,f)-dist(b,f));
 for(const b of options.slice(0,12)){
   const before=dbg.snapshot().gold;
   if(dbg.place('turret',b.x,b.y,true)){
     if(dbg.snapshot().gold!==before-24)throw Error('Inconsistent MG charge');
     log.push({wave,...b,goldAfter:dbg.snapshot().gold});
     return;
   }
 }
}
function distinctPlans(plans,budget){
 if(budget===0)return [];
 const sorts=[
   (a,b)=>a.cost-b.cost||b.fire-a.fire,
   (a,b)=>b.fire-a.fire||a.cost-b.cost,
   (a,b)=>(b.fire/b.cost)-(a.fire/a.cost),
   (a,b)=>b.gun[0]-a.gun[0]||a.cost-b.cost];
 const seen=new Set(),result=[];
 for(const compare of sorts){
   const p=[...plans].sort(compare).find(x=>!seen.has(x.mine.join(',')+'|'+x.gun.join(',')));
   if(!p)continue;
   seen.add(p.mine.join(',')+'|'+p.gun.join(','));
   result.push({name:'strategy-'+result.length,start:p,pool:[...plans].sort(compare).filter(q=>q!==p)});
   if(result.length===budget)return result;
 }
 for(const p of plans){
   const id=p.mine.join(',')+'|'+p.gun.join(',');
   if(seen.has(id))continue;
   seen.add(id);
   result.push({name:'strategy-'+result.length,start:p,pool:plans.filter(q=>q!==p)});
   if(result.length===budget)break;
 }
 return result;
}
function simulate(m,source,strategy){
 const {dbg,combatProfileHash}=boot(m,source,{chapter:strategy.chapter??1});
 const history=[],actions=[],networks=[];
 let error=null;
 for(let wave=1;wave<=6;wave++){
   const before=dbg.snapshot();
   if(before.mode!=='playing')break;
   if(before.phase!=='build'){error='Wave not in build phase';break;}
   let next=[];
   if(strategy.fixed){
     next=(strategy.fixed[wave]||[]).map(([type,x,y])=>({type,x,y}));
   }else if(wave===1){
     next=strategy.start.buildings;networks.push(strategy.start);
   }else{
     const occupied=before.buildings;
     // Independent subnets only: no shared or touching pipe media.
     const target=strategy.armory?.[wave]||'turret';
     const extraCost=PRICE[target]-PRICE.turret;
     const viable=strategy.pool.filter(p=>p.cost+extraCost<=before.gold &&
       p.buildings.every(b=>occupied.every(a=>dist(a,b)>1)));
     const preferred=viable.find(p=>networks.every(q=>
       Math.abs(q.gun[0]-p.gun[0])+Math.abs(q.gun[1]-p.gun[1])>=5))||viable[0];
     if(preferred){next=preferred.buildings.map(b=>b.type==='turret'?{...b,type:target}:b);networks.push(preferred);}
   }
   error=build(dbg,next,wave,actions);
   if(error)break;
   if(!strategy.fixed&&(!strategy.armory||wave===1)){
     // One additional MG per supply cell family; only the engine may approve it.
     for(const n of networks){
       if(dbg.snapshot().gold<24)break;
       const connected=dbg.snapshot().buildings.filter(b=>b.type==='turret'&&
         n.buildings.some(k=>k.type==='turret'&&k.x===b.x&&k.y===b.y));
       if(connected.length===1)appendMG(m,dbg,n,wave,actions);
     }
   }
   if(typeof strategy.extraBuild==='function'&&!strategy.fixed)
     strategy.extraBuild(dbg,m,wave,actions);
   if(!dbg.startWave()){error='Engine refused wave';break;}
   dbg.advance(200);
   const s=dbg.snapshot();
   history.push({wave,hp:s.hp,mode:s.mode,phase:s.phase,gold:s.gold,
     leaks:s.leaks,kills:s.kills,bossDefeated:s.bossDefeated,
     bossEscaped:s.bossEscaped,producedAmmo:s.producedAmmo,ammoSpent:s.ammoSpent});
   if(s.mode!=='playing')break;
   if(s.phase!=='build'){error='Simulation time budget reached';break;}
 }
 const s=dbg.snapshot();
 const victory=!error&&history.length===6&&s.mode==='won'&&s.bossDefeated===true&&
   s.bossEscaped===false&&s.hp>0&&s.producedAmmo+1e-6>=s.ammoSpent;
 return {name:strategy.name,combatProfileHash,chapter:strategy.chapter??1,status:victory?'VERIFIED_HARD_BOSSKILL':
   error?'INVALID_STRATEGY_OR_TIMEOUT':'NO_WIN_IN_TESTED_STRATEGY',
   verifiedWin:victory,error,actions,history,
   final:{mode:s.mode,hp:s.hp,gold:s.gold,leaks:s.leaks,kills:s.kills,
     bossDefeated:s.bossDefeated,bossEscaped:s.bossEscaped,
     producedAmmo:s.producedAmmo,ammoSpent:s.ammoSpent}};
}
function evaluate(m,source,opts={}){
 mapCheck(m);
 const budget=Number(opts.budget??3);
 if(!Number.isInteger(budget)||budget<0||budget>12)throw Error('Bad strategy budget');
 const plans=G.findPlans(m),strategies=distinctPlans(plans,budget);
 const attempts=strategies.map(st=>simulate(m,source,st));
 if(attempts.some(a=>a.combatProfileHash!==attempts[0].combatProfileHash))
   throw Error('Combat wave profile diverged');
 const wins=attempts.filter(a=>a.verifiedWin);
 return {candidateId:m.candidateId,seed:m.seed,routeId:m.routeId,mapHash:m.mapHash,
   gameSourceHash:hash(source),combatProfileId:'hard-c1-challenge0',
   plansConsidered:plans.length,strategiesAttempted:attempts.length,
   engineResult:wins.length?'VERIFIED_HARD_BOSSKILL':'NO_WIN_FOUND_WITHIN_SEARCH_BUDGET',
   winningStrategies:wins.length,difficulty:'NOT_CALIBRATED',attempts};
}
function html(results){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rows=results.map(r=>'<article><h2>'+esc(r.candidateId)+'</h2><p>Seed '+r.seed+
   ' · '+esc(r.engineResult)+' · '+r.winningStrategies+'/'+r.strategiesAttempted+
   ' erfolgreiche Läufe</p><ul>'+r.attempts.map(a=>'<li>'+esc(a.name)+' · '+a.history.length+
   ' Wellen · HQ '+a.final.hp+' · Boss '+(a.final.bossDefeated?'getötet':'nicht getötet')+'</li>').join('')+
   '</ul><p>Schwierigkeit nicht kalibriert; kein Sieg im Suchbudget ist kein Unlösbarkeitsbeweis.</p></article>').join('');
 return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+
   '<title>Forgefront interner Engine-Test</title><style>body{font:16px system-ui;background:#15242b;color:#f4f6fa;padding:1rem}'+
   'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:1rem}article{border:1px solid #678;padding:1rem;border-radius:12px}</style>'+
   '<h1>Interne Kartentests – Schwer</h1><p>Map-Vorschau: review.html</p><main>'+rows+'</main></html>';
}
function parseArgs(args){
 const opts={};
 for(let i=0;i<args.length;i++){
   const k=args[i];if(!['--seed','--count','--route','--budget','--out','--game'].includes(k)||!args[i+1])
     throw Error('Unrecognized option '+k);
   opts[k.slice(2)]=args[++i];
 }
 return opts;
}
function run(opts={}){
 const source=fs.readFileSync(opts.game||here,'utf8');
 const runP0=G.run({seed:opts.seed??52741,count:opts.count??1,route:opts.route??1,
   out:opts.out||path.join(__dirname,'../generated/map-battle'),game:opts.game,silent:true});
 const evaluated=runP0.maps.filter(m=>m.validation.valid)
   .map(m=>evaluate(m,source,{budget:opts.budget??3}));
 const out=runP0.result.output;
 fs.writeFileSync(path.join(out,'battle-report.json'),JSON.stringify({
   version:'P1.0',sourceHash:hash(source),results:evaluated},null,2)+'\n');
 fs.writeFileSync(path.join(out,'battle-review.html'),html(evaluated));
 const result={generated:runP0.maps.length,evaluated:evaluated.length,
   strategiesTested:evaluated.reduce((n,x)=>n+x.strategiesAttempted,0),
   verifiedBosskillMaps:evaluated.filter(x=>x.winningStrategies>0).length,
   output:out};
 if(!opts.silent)console.log(JSON.stringify(result));
 return {result,evaluated};
}
if(require.main===module){try{run(parseArgs(process.argv.slice(2)));}
 catch(e){console.error('Map battle error:',e.stack||e.message);process.exitCode=1;}}
module.exports={instrument,boot,simulate,evaluate,distinctPlans,parseArgs,run};
