#!/usr/bin/env node
'use strict';
// FORGEFRONT P0: Internal seeded ore candidates, never a player game mode.
// Deliberately no campaign/save writes, real wave simulation or difficulty claims.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const W=18,H=20,START_GOLD=155;
const COST={mine:22,factory:18,turret:24,pipe:4,bridge:10};
const DIR=[[1,0],[-1,0],[0,1],[0,-1]];
const id=(x,y)=>x+','+y,within=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
const adjacent=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;
const adjacentCells=([x,y])=>DIR.map(([dx,dy])=>[x+dx,y+dy]).filter(([i,j])=>within(i,j));
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const randomFor=seed=>{let state=(seed>>>0)||1;return()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);};
const order=(a,b)=>a[1]-b[1]||a[0]-b[0];
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);

function extractBlueprints(source){
  // Evaluate the narrow map-constant block only, not the game/application.
  const start=source.indexOf('const BASE_PATH='),end=source.indexOf('const CHAPTERS=');
  if(start<0||end<=start||end-start>16000)throw Error('Map anchors changed; inspect source');
  const constants=source.slice(start,end);
  if(!constants.includes('const MAP_BLUEPRINTS='))throw Error('No map blueprints');
  const maps=vm.runInNewContext(constants+
    '\nMAP_BLUEPRINTS.map(m=>({name:m.name,path:m.path,ore:m.ore,hq:m.hq}));',
    Object.create(null),{timeout:1500});
  if(!Array.isArray(maps)||maps.length!==3)throw Error('Expected three reference routes');
  return JSON.parse(JSON.stringify(maps)).map((m,i)=>({
    ...m,routeId:i+1,ore:m.ore.map(p=>typeof p==='string'?p.split(',').map(Number):p)
  }));
}
function validateMap(m){
  const errors=[],seenPath=new Set(),seenOre=new Set();
  if(!Array.isArray(m.path)||m.path.length<2)errors.push('missing enemy path');
  for(let i=0;i<(m.path||[]).length;i++){
    const p=m.path[i];
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||!within(...p)){
      errors.push('invalid road cell');continue;
    }
    const k=id(...p);
    if(seenPath.has(k))errors.push('road revisits cell');
    seenPath.add(k);
    if(i&&m.path[i-1].length===2&&!adjacent(p,m.path[i-1]))errors.push('road jump');
  }
  if(!m.hq||!Number.isInteger(m.hq.x)||!Number.isInteger(m.hq.y)||
    !within(m.hq.x,m.hq.y)||!m.path?.length||
    id(...m.path.at(-1))!==id(m.hq.x,m.hq.y))errors.push('HQ must end road');
  if(!Array.isArray(m.ore)||!m.ore.length)errors.push('missing ore');
  for(const p of m.ore||[]){
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||!within(...p)){
      errors.push('invalid ore cell');continue;
    }
    const k=id(...p);
    if(seenOre.has(k))errors.push('duplicate ore');
    if(seenPath.has(k))errors.push('ore overlaps road/HQ');
    seenOre.add(k);
  }
  return [...new Set(errors)];
}
const fireCells=(map,cell)=>map.path.reduce((a,p)=>{
  const dx=cell[0]-p[0],dy=cell[1]-p[1];
  return a+(dx*dx+dy*dy<=3.3*3.3?1:0);
},0);
function freeCells(m){
  const road=new Set(m.path.map(p=>id(...p))),ore=new Set(m.ore.map(p=>id(...p)));
  const free=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)
    if(!road.has(id(x,y))&&!ore.has(id(x,y)))free.push([x,y]);
  return {road,ore,free};
}
function generateOre(template,seed,motif='split'){
  if(!['front','remote','split'].includes(motif))throw Error('Unknown ore motif');
  const rnd=randomFor(seed),road=new Set(template.path.map(p=>id(...p))),open=[];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++)if(!road.has(id(x,y)))open.push([x,y]);
  const rank=open.map(p=>({p,fire:fireCells(template,p)}));
  const near=[...rank].sort((a,b)=>b.fire-a.fire).slice(0,Math.ceil(rank.length*.35)).map(a=>a.p);
  const far=[...rank].sort((a,b)=>a.fire-b.fire).slice(0,Math.ceil(rank.length*.45)).map(a=>a.p);
  const centers=[],n=motif==='split'?3:2;
  for(let i=0;i<n;i++){
    const preferred=motif==='front'?(i?far:near):motif==='remote'?(i?near:far):(i===0?near:i===1?far:open);
    let pool=preferred.filter(p=>centers.every(c=>distance(p,c)>=7));
    if(!pool.length)pool=open.filter(p=>centers.every(c=>distance(p,c)>=5));
    if(!pool.length)throw Error('Could not place ore clusters');
    centers.push(pool[Math.floor(rnd()*pool.length)]);
  }
  const chosen=new Set();
  for(const center of centers){
    const wanted=7+Math.floor(rnd()*3),frontier=[center];
    let added=0;
    while(frontier.length&&added<wanted){
      const i=Math.floor(rnd()*frontier.length),p=frontier.splice(i,1)[0],k=id(...p);
      if(road.has(k)||chosen.has(k))continue;
      chosen.add(k);added++;
      for(const next of adjacentCells(p))if(!road.has(id(...next))&&!chosen.has(id(...next)))frontier.push(next);
    }
  }
  return [...chosen].map(s=>s.split(',').map(Number)).sort(order);
}
function cheapestPipeRoute(m,from,to,blocked,oppositePipes=[],oppositeTerminals=[]){
  if(adjacent(from,to))return [];
  const {road,ore}=freeCells(m),forbidden=new Set(blocked.map(p=>id(...p)));
  const forbiddenPipe=new Set(oppositePipes.map(p=>id(...p)));
  const best=new Map([[id(...from),0]]),parent=new Map(),todo=[[0,from]];
  while(todo.length){
    todo.sort((a,b)=>b[0]-a[0]);
    const [score,at]=todo.pop(),k=id(...at);
    if(score!==best.get(k))continue;
    if(adjacent(at,to)){
      const result=[];let cur=k;while(cur!==id(...from)){result.push(cur.split(',').map(Number));cur=parent.get(cur);}
      return result.reverse();
    }
    for(const next of adjacentCells(at)){
      const v=id(...next);
      if(v===id(...from)||v===id(...to)||ore.has(v)||forbidden.has(v)||
        forbiddenPipe.has(v)||v===id(m.hq.x,m.hq.y))continue;
      if(oppositeTerminals.some(p=>adjacent(p,next))||
        oppositePipes.some(p=>adjacent(p,next)))continue;
      const cost=score+(road.has(v)?10:4);
      if(cost<(best.get(v)??Infinity)){best.set(v,cost);parent.set(v,k);todo.push([cost,next]);}
    }
  }
  return null;
}
function validateStartPlan(m,buildings){
  const errors=validateMap(m),{road,ore}=freeCells(m),occupied=new Set();
  let cost=0;
  const by=t=>buildings.filter(b=>b.type===t);
  for(const b of buildings){
    if(!within(b.x,b.y)){errors.push('outside board');continue;}
    const k=id(b.x,b.y);if(occupied.has(k))errors.push('overlapping builds');occupied.add(k);
    if(!Object.hasOwn(COST,b.type))errors.push('unknown building');
    else cost+=COST[b.type];
    if(b.type==='mine'&&!ore.has(k))errors.push('mine off ore');
    if(b.type!=='mine'&&ore.has(k))errors.push('other building on ore');
    if(b.type==='bridge'&&!road.has(k))errors.push('bridge off road');
    if(b.type!=='bridge'&&road.has(k))errors.push('non-bridge on road');
    if(k===id(m.hq.x,m.hq.y))errors.push('building on HQ');
  }
  const mine=by('mine'),factory=by('factory'),gun=by('turret');
  if(mine.length!==1||factory.length!==1||gun.length!==1)errors.push('P0 requires one mine, factory and MG');
  const pipes=buildings.filter(b=>b.type==='pipe'||b.type==='bridge'),groups=[],seen=new Set();
  const touches=(a,b)=>adjacent([a.x,a.y],[b.x,b.y]);
  for(const pipe of pipes){
    if(seen.has(pipe))continue;
    const group=[],pending=[pipe];seen.add(pipe);
    while(pending.length){const node=pending.pop();group.push(node);
      for(const next of pipes)if(!seen.has(next)&&touches(node,next)){seen.add(next);pending.push(next);}
    }
    groups.push(group);
    const metal=group.some(p=>mine.some(n=>touches(p,n)));
    const ammo=group.some(p=>gun.some(n=>touches(p,n)));
    if(metal&&ammo)errors.push('metal/ammo pipe conflict');
  }
  const reachable=(a,b)=>touches(a,b)||groups.some(g=>g.some(p=>touches(p,a))&&g.some(p=>touches(p,b)));
  if(mine.length===1&&factory.length===1&&!reachable(mine[0],factory[0]))errors.push('mine/factory disconnected');
  if(factory.length===1&&gun.length===1&&!reachable(factory[0],gun[0]))errors.push('factory/MG disconnected');
  if(cost>START_GOLD)errors.push('over start budget');
  return {valid:errors.length===0,errors:[...new Set(errors)],cost};
}
function findPlans(m){
  if(validateMap(m).length)return [];
  const {road,free}=freeCells(m),freeSet=new Set(free.map(p=>id(...p)));
  const guns=free.map(p=>({p,fire:fireCells(m,p)})).filter(g=>g.fire>=4)
    .sort((a,b)=>b.fire-a.fire||order(a.p,b.p));
  const positions=guns.slice(0,12).map(g=>g.p);
  for(const g of guns.filter(g=>g.p[0]>=12).slice(0,5))
    if(!positions.some(p=>id(...p)===id(...g.p)))positions.push(g.p);
  const ores=[...m.ore].sort((a,b)=>
    Math.min(...positions.map(p=>distance(a,p)))-Math.min(...positions.map(p=>distance(b,p)))||order(a,b)).slice(0,16);
  const plans=[];
  for(const mine of ores)for(const gun of positions){
    const sites=[...adjacentCells(mine),...adjacentCells(gun)]
      .filter(p=>freeSet.has(id(...p))&&id(...p)!==id(...gun));
    const unique=[...new Map(sites.map(p=>[id(...p),p])).values()];
    for(const factory of unique){
      const blocked=[mine,factory,gun];
      const metal=cheapestPipeRoute(m,mine,factory,blocked,[],[gun]);
      if(metal===null)continue;
      const ammo=cheapestPipeRoute(m,factory,gun,blocked,metal,[mine]);
      if(ammo===null)continue;
      const pipes=[...metal,...ammo].map(p=>({type:road.has(id(...p))?'bridge':'pipe',x:p[0],y:p[1]}));
      const buildings=[
        {type:'mine',x:mine[0],y:mine[1]},
        {type:'factory',x:factory[0],y:factory[1]},
        {type:'turret',x:gun[0],y:gun[1]},...pipes
      ];
      const result=validateStartPlan(m,buildings);
      if(result.valid)plans.push({cost:result.cost,fire:fireCells(m,gun),mine,factory,gun,buildings});
    }
  }
  plans.sort((a,b)=>a.cost-b.cost||b.fire-a.fire||order(a.mine,b.mine)||order(a.gun,b.gun));
  const used=new Set(),selected=[];
  for(const p of plans){const k=id(...p.mine)+'|'+id(...p.gun);if(used.has(k))continue;
    used.add(k);selected.push(p);if(selected.length===30)break;
  }
  return selected;
}
function candidate(template,seed,motif,engineHash){
  const m={candidateId:'route-'+template.routeId+'-seed-'+seed,
    seed,motif,routeId:template.routeId,generatorVersion:'P0.1',engineSourceHash:engineHash,
    width:W,height:H,path:template.path.map(p=>[...p]),ore:generateOre(template,seed,motif),
    hq:{...template.hq}};
  m.mapHash=digest(JSON.stringify({path:m.path,ore:m.ore,hq:m.hq}));
  const errors=validateMap(m),plans=errors.length?[]:findPlans(m);
  m.validation={valid:errors.length===0&&plans.length>0,
    errors:errors.length?errors:plans.length?[]:['No affordable connected MG start found']};
  m.analysis={startPlansFound:plans.length,minStartGold:plans[0]?.cost??null,
    plans:plans.slice(0,3)};
  m.engineResult='NOT_TESTED';m.difficulty='NOT_CALIBRATED';return m;
}
function previewSvg(m){
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pieces=[];
  pieces.push('<svg viewBox="0 0 288 320" role="img" aria-label="'+esc(m.candidateId)+'">');
  pieces.push('<rect width="288" height="320" fill="#182a33"/>');
  pieces.push('<polyline points="'+m.path.map(p=>(p[0]*16+8)+','+(p[1]*16+8)).join(' ')+'" fill="none" stroke="#8e9da7" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>');
  for(const [x,y] of m.ore)pieces.push('<rect x="'+(x*16+2)+'" y="'+(y*16+2)+'" width="12" height="12" rx="3" fill="#dca446"/>');
  for(const b of m.analysis.plans[0]?.buildings||[]){
    const color={mine:'#3ab8d8',factory:'#a293fc',turret:'#63da91',pipe:'#d3d6e3',bridge:'#d3d6e3'}[b.type];
    pieces.push('<rect x="'+(b.x*16+3)+'" y="'+(b.y*16+3)+'" width="10" height="10" rx="2" fill="'+color+'"/>');
  }
  pieces.push('<circle cx="'+(m.hq.x*16+8)+'" cy="'+(m.hq.y*16+8)+'" r="8" fill="#f3707d"/></svg>');
  return pieces.join('');
}
function renderPreview(maps){
  const cards=maps.filter(m=>m.validation.valid).slice(0,12).map(m=>
    '<article>'+previewSvg(m)+'<h2>'+m.candidateId+'</h2><p>'+m.motif+
    ' · Startnetz ab '+m.analysis.minStartGold+' Gold · MG-Fenster '+m.analysis.plans[0].fire+
    ' Wegzellen</p><p>Map-Hash '+m.mapHash.slice(0,12)+
    ' · <b>Kein Wellen-/Boss-Test!</b></p></article>').join('');
  return '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'+
    '<title>Forgefront – interne Karten P0</title><style>body{font:16px system-ui;background:#0e1921;color:#edf3f5;margin:2rem}'+
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1rem}'+
    'article{border:1px solid #435767;background:#182936;border-radius:12px;padding:1rem}svg{width:100%}'+
    'p{color:#c2d0d7;font-size:.9rem}</style><h1>Forgefront – interne Erzvarianten</h1>'+
    '<p>Nur strukturelle Vorprüfung, keine Sieggarantie und keine Schwierigkeitsbewertung.</p><main>'+
    cards+'</main></html>';
}
function run(options={}){
  const filename=options.game||path.join(__dirname,'..','src','game.js');
  const source=fs.readFileSync(filename,'utf8'),templates=extractBlueprints(source);
  const count=Number(options.count??12),seed=Number(options.seed??52741),route=Number(options.route??1);
  if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295||
    !Number.isSafeInteger(count)||count<1||count>100||!Number.isInteger(route)||route<1||route>3)
    throw Error('Invalid seed, count (1..100) or route (1..3)');
  const motifs=['front','remote','split'],engineHash=digest(source),maps=[];
  for(let i=0;i<count;i++){
    const nextSeed=(seed+i*1013)>>>0;
    maps.push(candidate(templates[(i+route-1)%3],nextSeed,motifs[i%3],engineHash));
  }
  const out=path.resolve(options.out||path.join(__dirname,'..','generated','map-candidates'));
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'candidates.json'),JSON.stringify({
    generatorVersion:'P0.1',engineHash,candidates:maps},null,2)+'\n');
  fs.writeFileSync(path.join(out,'review.html'),renderPreview(maps));
  const result={generated:maps.length,structurallyValid:maps.filter(m=>m.validation.valid).length,
    engineResult:'NOT_TESTED',output:out,sourceHash:engineHash.slice(0,12)};
  if(!options.silent)console.log(JSON.stringify(result));return {result,maps};
}
function parseArgs(args){
  const options={};
  for(let i=0;i<args.length;i++){const flag=args[i];
    if(!['--count','--seed','--route','--out','--game'].includes(flag)||!args[i+1])
      throw Error('Unknown or incomplete argument: '+flag);
    options[flag.slice(2)]=args[++i];
  }
  return options;
}
if(require.main===module){
  try{run(parseArgs(process.argv.slice(2)));}catch(e){console.error('Forgefront P0:',e.message);process.exitCode=1;}
}
module.exports={extractBlueprints,validateMap,generateOre,validateStartPlan,findPlans,
  candidate,renderPreview,run,parseArgs};
