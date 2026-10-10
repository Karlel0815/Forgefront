#!/usr/bin/env node
'use strict';
// Internal only. A VM-level test hook injects candidates without changing game code.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('./map-generator.cjs');
const src=path.join(__dirname,'..','src','game.js');
const id=(x,y)=>x+','+y;
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
const adjacent=(a,b)=>distance(a,b)===1;
const COST={turret:24};
function boot(candidate){
 const source=fs.readFileSync(src,'utf8');
 if(!source.includes('window.ForgefrontDebug={'))throw Error('Debug API changed');
 const hook=[
 'window.ForgefrontMapQA={inject(data){',
 'const level=ALL_LEVELS.find(l=>l.id==="c1-l1");',
 'level.path=data.path.map(p=>[p[0],p[1]]);',
 'level.ore=data.ore.map(p=>Array.isArray(p)?p.join(","):p);',
 'level.hq={...data.hq};level.challenge=0;',
 'if(!startLevel(level.id))throw Error("Invalid test level");',
 '}};'
 ].join('\n');
 const instrumented=source.replace('window.ForgefrontDebug={',hook+'\nwindow.ForgefrontDebug={');
 const noop=()=>{};
 const ctx=new Proxy({},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const E={};
 function elem(name){return {id:name,value:'standard',hidden:false,textContent:'',innerHTML:'',
   dataset:{},style:{},classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,
   addEventListener:noop,getContext(){return ctx},
   getBoundingClientRect(){return {width:864,height:960,left:0,top:0}},
   clientWidth:390,clientHeight:650};}
 const buttons=['turret','cannon','mortar','mine','factory','pipe','bridge','eraser']
  .map(t=>{const e=elem(t);e.dataset.type=t;return e});
 const doc={hidden:false,body:{dataset:{}},getElementById(name){return E[name]??(E[name]=elem(name))},
   querySelectorAll:q=>q==='.build'?buttons:[],
   querySelector:q=>E[q]??(E[q]=elem(q)),addEventListener:noop};
 const storage=new Map(),win={innerWidth:390,localStorage:{
  getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(instrumented,{window:win,document:doc,performance:{now:()=>0},
   requestAnimationFrame:noop,console},{timeout:12000});
 const references=G.extractBlueprints(source);
 candidate??=references[0];
 const errors=G.validateMap(candidate);
 if(errors.length)throw Error('Invalid candidate: '+errors.join(','));
 const dbg=win.ForgefrontDebug;
 if(!dbg.setDifficulty('hard'))throw Error('Cannot select hard');
 win.ForgefrontMapQA.inject(candidate);
 return dbg;
}
function isVerifiedVictory(s){
 return s.wave===6&&s.mode==='won'&&s.bossDefeated===true&&
   s.bossEscaped===false&&s.hp>0;
}
function playWave(dbg,wave){
 const before=dbg.snapshot();
 if(before.mode!=='playing'||before.phase!=='build'||before.wave!==wave-1)
   throw Error('Cannot start wave '+wave+' from '+before.mode+'/'+before.phase+'/'+before.wave);
 if(!dbg.startWave())throw Error('Engine rejected wave');
 dbg.advance(200);
 const s=dbg.snapshot();
 if(s.phase==='combat'&&s.mode==='playing')throw Error('Wave timeout');
 return {wave:s.wave,mode:s.mode,phase:s.phase,hp:s.hp,leaks:s.leaks,kills:s.kills,
   gold:s.gold,bossDefeated:s.bossDefeated,bossEscaped:s.bossEscaped,ammoSpent:s.ammoSpent};
}
function placeGroup(dbg,actions){
 const existing=new Map(dbg.snapshot().buildings.map(b=>[id(b.x,b.y),b.type]));
 const added=[],seen=new Set();
 for(const b of actions){
   const k=id(b.x,b.y);if(seen.has(k))continue;seen.add(k);
   if(existing.has(k)&&existing.get(k)===b.type)continue;
   if(existing.has(k)||!dbg.place(b.type,b.x,b.y,true)){
     for(const c of added.reverse())dbg.erase(c.x,c.y,true);
     return false;
   }
   added.push(b);
 }
 return true;
}
function coverage(map,[x,y]){
 const out=[];
 for(let i=0;i<map.path.length;i++){
   const dx=x-map.path[i][0],dy=y-map.path[i][1];
   if(dx*dx+dy*dy<=3.3*3.3)out.push(i);
 }
 return out;
}
function extendGuns(dbg,map,limit=2){
 let built=0;
 for(let n=0;n<limit;n++){
   const state=dbg.snapshot();
   if(state.gold<COST.turret)break;
   const occupied=new Set(state.buildings.map(b=>id(b.x,b.y)));
   const ore=new Set(map.ore.map(p=>id(...p)));
   const road=new Set(map.path.map(p=>id(...p)));
   const attached=state.buildings.filter(b=>b.type==='factory'||
    ((b.type==='pipe'||b.type==='bridge')&&dbg.pipeMedium(b.x,b.y)==='ammo'));
   const taken=new Set(state.buildings.filter(b=>b.type==='turret')
     .flatMap(b=>coverage(map,[b.x,b.y])));
   const choices=[];
   for(let y=0;y<20;y++)for(let x=0;x<18;x++){
     const p=[x,y],k=id(x,y);
     if(occupied.has(k)||ore.has(k)||road.has(k))continue;
     if(!attached.some(b=>adjacent(p,[b.x,b.y])))continue;
     const hit=coverage(map,p);if(hit.length<3)continue;
     choices.push({p,score:hit.length+2*hit.filter(i=>!taken.has(i)).length});
   }
   choices.sort((a,b)=>b.score-a.score||a.p[1]-b.p[1]||a.p[0]-b.p[0]);
   let success=false;
   for(const c of choices.slice(0,12)){
     if(!dbg.place('turret',...c.p,true))continue;
     const newTurret=dbg.snapshot().buildings.find(b=>b.type==='turret'&&
       b.x===c.p[0]&&b.y===c.p[1]);
     const rate=dbg.rates().find(b=>b.id===newTurret.id);
     if(rate?.ratio>=99){success=true;built++;break;}
     dbg.erase(...c.p,true);
   }
   if(!success)break;
 }
 return built;
}
function sortedPlans(plans,map,family){
 const score=p=>family==='economy'?-p.cost+.4*p.fire:
  family==='fire'?3*p.fire-.45*p.cost:
  family==='lastline'?1.6*p.fire-.55*p.cost-1.8*distance(p.gun,[map.hq.x,map.hq.y]):
  2*p.fire-.75*p.cost;
 return [...plans].sort((a,b)=>score(b)-score(a)||a.cost-b.cost);
}
function nextNetwork(dbg,map,plans,family){
 const st=dbg.snapshot(),taken=new Map(st.buildings.map(b=>[id(b.x,b.y),b.type]));
 const guns=st.buildings.filter(b=>b.type==='turret').map(b=>[b.x,b.y]);
 const candidates=sortedPlans(plans,map,family).filter(p=>p.cost<=st.gold&&
   guns.every(g=>distance(g,p.gun)>=3)&&
   p.buildings.every(b=>!taken.has(id(b.x,b.y))||taken.get(id(b.x,b.y))===b.type));
 for(const p of candidates.slice(0,24)){
   if(!placeGroup(dbg,p.buildings))continue;
   const turret=dbg.snapshot().buildings.find(b=>b.type==='turret'&&
     b.x===p.gun[0]&&b.y===p.gun[1]);
   const rate=turret&&dbg.rates().find(b=>b.id===turret.id);
   if(rate?.ratio>=99)return true;
   // Unexpected undersupply: keep legal build but never declare it successful.
 }
 return false;
}
function runFamily(map,plans,family){
 const dbg=boot(map),history=[],builds=[];
 const start=sortedPlans(plans,map,family).find(p=>p.cost<=155&&placeGroup(dbg,p.buildings));
 if(!start)return {family,status:'NO_LEGAL_START_FOUND',history,builds};
 builds.push({wave:1,action:'initial',cost:start.cost,mine:start.mine,gun:start.gun});
 const extra=extendGuns(dbg,map,1);
 if(extra)builds.push({wave:1,action:'connected_MG',count:extra});
 for(let wave=1;wave<=6;wave++){
   if(wave>1){
     if(nextNetwork(dbg,map,plans,family))builds.push({wave,action:'independent_network'});
     const added=extendGuns(dbg,map,2);
     if(added)builds.push({wave,action:'connected_MG',count:added});
   }
   history.push(playWave(dbg,wave));
   if(dbg.snapshot().mode!=='playing')break;
 }
 const final=dbg.snapshot();
 return {family,status:isVerifiedVictory(final)?'WIN_VERIFIED':'NO_WIN_FOUND_WITHIN_SEARCH_BUDGET',
  builds,history,bossDefeated:final.bossDefeated,bossEscaped:final.bossEscaped,
  hp:final.hp,playedWaves:final.wave};
}
function analyze(candidate,opts={}){
 const errors=G.validateMap(candidate);
 if(errors.length)return {candidateId:candidate.candidateId||'invalid',
   status:'REJECT_INVALID_MAP',errors,runs:[]};
 const plans=G.findPlans(candidate);
 if(!plans.length)return {candidateId:candidate.candidateId||'unknown',
   status:'NO_LEGAL_START_FOUND',planCount:0,runs:[]};
 const families=(opts.families||['economy','fire','balanced','lastline']).slice(0,4);
 const runs=families.map(f=>runFamily(candidate,plans,f));
 const winningFamilies=runs.filter(r=>r.status==='WIN_VERIFIED').map(r=>r.family);
 return {candidateId:candidate.candidateId,mapHash:candidate.mapHash??null,
   profile:'hard-c1-l1-fixed-challenge0',planCount:plans.length,
   status:winningFamilies.length?'WIN_VERIFIED':'NO_WIN_FOUND_WITHIN_SEARCH_BUDGET',
   winningFamilies,runs};
}
function scriptedReference(map,steps){
 const dbg=boot(map),history=[];
 for(let wave=1;wave<=6;wave++){
   for(const [t,x,y] of steps[wave]||[])if(!dbg.place(t,x,y,true))
     throw Error('Illegal reference build '+t+'@'+x+','+y);
   history.push(playWave(dbg,wave));
   if(dbg.snapshot().mode!=='playing')break;
 }
 const st=dbg.snapshot();
 return {status:isVerifiedVictory(st)?'WIN_VERIFIED':'NO_WIN_FOUND_WITHIN_SEARCH_BUDGET',
   history,bossDefeated:st.bossDefeated,bossEscaped:st.bossEscaped,hp:st.hp};
}
function cli(argv=process.argv.slice(2)){
 let seed=52741,count=2,out=null;
 for(let i=0;i<argv.length;i++){
   const k=argv[i],v=argv[++i];
   if(v===undefined)throw Error('Missing value '+k);
   if(k==='--seed')seed=Number(v);else if(k==='--count')count=Number(v);
   else if(k==='--out')out=v;else throw Error('Unknown option '+k);
 }
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||
   !Number.isInteger(count)||count<1||count>10)throw Error('Invalid seed/count');
 const source=fs.readFileSync(src,'utf8'),templates=G.extractBlueprints(source),results=[];
 for(let i=0;i<count;i++){
   const c=G.candidate(templates[i%3],(seed+i*1013)>>>0,
     ['split','front','remote'][i%3],'game-hash');
   results.push(analyze(c,{families:['balanced','fire']}));
 }
 const result={simulatorVersion:'P1.0',profile:'hard-c1-l1-fixed-challenge0',
   note:'Unsuccessful bounded search is not proof of unplayability.',results};
 if(out){const file=path.resolve(out);fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({trials:results.length,
   confirmedWins:results.filter(x=>x.status==='WIN_VERIFIED').length,
   uncertain:results.filter(x=>x.status==='NO_WIN_FOUND_WITHIN_SEARCH_BUDGET').length,
   output:out}));
 return result;
}
if(require.main===module)try{cli();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={boot,isVerifiedVictory,playWave,placeGroup,runFamily,analyze,scriptedReference,cli};
