'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8').replace(
 'window.ForgefrontDebug={',
 "window.TestFinish={win(){g.wave=6;g.bossDefeated=true;g.bossEscaped=false;g.hp=10;finish(true);},escape(){g.wave=6;g.bossDefeated=false;g.bossEscaped=true;g.hp=10;finish(true);}};window.ForgefrontDebug={");
function boot(){
 const noop=()=>{},ctx=new Proxy({},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const elems={},store=new Map(),events=[];
 const elem=id=>elems[id]??(elems[id]={id,hidden:id==='game-shell',value:'standard',dataset:{},style:{},textContent:'',innerHTML:'',
  classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,setAttribute:noop,getContext:()=>ctx,
  getBoundingClientRect:()=>({width:864,height:960,left:0,top:0}),clientWidth:390,clientHeight:650});
 const builds=['turret','cannon','mortar','mine','factory','pipe','bridge','eraser'].map(type=>({...elem('build-'+type),dataset:{type}}));
 const document={hidden:false,body:{dataset:{}},getElementById:elem,querySelectorAll:s=>s==='.build'?builds:[],querySelector:elem,addEventListener:noop};
 const window={innerWidth:390,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},dispatchEvent:e=>events.push(e)};
 class CustomEvent{constructor(type,opt){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(code,{document,window,CustomEvent,performance:{now:()=>0},requestAnimationFrame:noop,console},{timeout:12000});
 return{debug:window.ForgefrontDebug,custom:window.ForgefrontCustom,finish:window.TestFinish,store,events};
}
const map={path:[[2,4],[2,5],[2,6],[2,7],[2,8],[2,9]],ore:['8,8'],hq:{x:2,y:9}};
test('custom map is real hard-mode combat with 155 gold and all weapons',()=>{
 const s=boot(),before=s.store.get('forgefront.progress.v2');
 assert.equal(s.custom.start(map),true);
 const state=s.debug.snapshot();
 assert.equal(state.difficulty,'hard');assert.equal(state.gold,155);assert.equal(state.hp,15);
 assert.equal(s.debug.allowedBuilding('turret'),true);
 assert.equal(s.debug.allowedBuilding('cannon'),true);
 assert.equal(s.debug.allowedBuilding('mortar'),true);
 assert.equal(s.debug.waves().length,6);
 assert.equal(s.debug.waves()[0].count,16);
 assert.equal(s.custom.verifiedWin(),false);
 assert.equal(s.store.get('forgefront.progress.v2'),before);
});
test('only verified boss kill unlocks local save; no campaign progression',()=>{
 const s=boot();assert.equal(s.custom.start(map),true);
 const before=s.store.get('forgefront.progress.v2');
 s.finish.win();
 assert.equal(s.custom.verifiedWin(),true);
 assert.equal(s.events.at(-1).detail.won,true);
 assert.equal(s.store.get('forgefront.progress.v2'),before);
 assert.equal(Object.keys(s.debug.save().results).length,0);
});
test('boss escape cannot unlock saving despite surviving HQ',()=>{
 const s=boot();assert.equal(s.custom.start(map),true);
 s.finish.escape();
 assert.equal(s.custom.verifiedWin(),false);
 assert.equal(s.events.at(-1).detail.won,false);
 assert.equal(s.debug.snapshot().mode,'lost');
});
test('invalid custom maps are rejected without starting combat',()=>{
 const s=boot();
 assert.equal(s.custom.start({...map,path:[[2,4],[2,6]],hq:{x:2,y:6}}),false);
 assert.equal(s.custom.active(),false);
});
