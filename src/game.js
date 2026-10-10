(() => {
'use strict';
const BUILD_ID='0.4.0-dev3';
const W=18,H=20,S=60,MAX_WAVES=6,FIRST_DELAY=2,DISPLAY_UPDATE_MS=250,DISPLAY_RESPONSE_S=1.5,DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const ECONOMY={startGold:180,goldPerKill:5,goldPerType:{scout:1,normal:2,heavy:6,boss:20},goldPerWave:10,refundByDifficulty:{easy:1,normal:.75,hard:.5},difficulty:'easy'}; // Easy = test mode; difficulty selector later.
const DIFFICULTIES={
 easy:{name:'Leicht',startGold:220,hq:30,enemyHp:.75,spawn:.95},
 normal:{name:'Mittel',startGold:180,hq:20,enemyHp:1.12,spawn:1},
 hard:{name:'Schwer',startGold:155,hq:15,enemyHp:1.32,spawn:1.14},
 crazy:{name:'Verrückt',startGold:135,hq:10,enemyHp:1.52,spawn:1.28}
};
let selectedDifficulty='normal';

const BASE_PATH=[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[6,4],[6,5],[7,5],[8,5],[9,5],[10,5],[10,6],[10,7],[10,8],[10,9],[11,9],[12,9],[12,8],[13,8],[13,9],[13,10],[12,10],[11,10],[11,11],[11,12],[12,12],[13,12],[14,12],[15,12],[15,13],[15,14],[15,15],[16,15],[16,16],[16,17],[16,18]];
const BASE_ORE=new Set(['7,14','6,14','7,15','6,15','4,13','3,13','3,12','4,12','2,9','3,9','5,9','9,17','10,17','12,16','13,16','14,5','15,5','15,6','2,5','3,5','15,18','14,18','11,4','10,14','7,17']);
// Campaign chapters and their maps are independent of the combat engine.
const PATH_ENGPASS=[
 ...Array.from({length:10},(_,x)=>[x,3]),
 ...Array.from({length:5},(_,i)=>[9,4+i]),
 ...Array.from({length:5},(_,i)=>[8-i,8]),
 ...Array.from({length:3},(_,i)=>[4,9+i]),
 ...Array.from({length:9},(_,i)=>[5+i,11]),
 ...Array.from({length:4},(_,i)=>[13,12+i]),
 [14,15],[15,15],[15,16],[15,17],[15,18],[16,18]
];
const ORE_ENGPASS=['2,5','3,5','2,6','3,6','12,4','12,5','11,4','11,6','15,7','16,7','15,8','16,8','6,13','7,13','8,13','6,14','7,14','8,14','9,17','10,17','10,18','5,16','15,12'];
const PATH_BELAGERUNG=[
 ...Array.from({length:7},(_,x)=>[x,2]),
 ...Array.from({length:4},(_,i)=>[6,3+i]),
 ...Array.from({length:4},(_,i)=>[5-i,6]),
 ...Array.from({length:4},(_,i)=>[2,7+i]),
 ...Array.from({length:10},(_,i)=>[3+i,10]),
 ...Array.from({length:4},(_,i)=>[12,11+i]),
 ...Array.from({length:5},(_,i)=>[11-i,14]),
 ...Array.from({length:3},(_,i)=>[7,15+i]),
 ...Array.from({length:9},(_,i)=>[8+i,17]),
 [16,18]
];
const ORE_BELAGERUNG=['1,4','1,5','0,5','3,4','4,4','8,3','9,3','8,4','9,4','4,12','5,12','4,13','5,13','6,12','14,12','15,12','14,13','15,13','13,15','14,15','9,18','10,18','11,18','12,18','4,17','5,17'];
// Terrain is shared across chapters; only the weapon choices change.
const MAP_BLUEPRINTS=[
 {name:'Die Versorgung',path:BASE_PATH,ore:[...BASE_ORE],hq:{x:16,y:18},challenge:0},
 {name:'Der Engpass',path:PATH_ENGPASS,ore:ORE_ENGPASS,hq:{x:16,y:18},challenge:1},
 {name:'Die Belagerung',path:PATH_BELAGERUNG,ore:ORE_BELAGERUNG,hq:{x:16,y:18},challenge:2}
];
const CHAPTERS=[
 {id:'c1',name:'Die ersten Minen',reward:'Kanone',weapon:'MG'},
 {id:'c2',name:'Schwere Geschütze',reward:'Mörser',weapon:'MG + Kanone'},
 {id:'c3',name:'Flächenverteidigung',reward:'Kapitel 4',weapon:'MG + Kanone + Mörser'},
 {id:'c4',name:'Forschung',reward:'Kampagnenabschluss',weapon:'MG + Kanone + Mörser'}
].map((chapter,ci)=>({...chapter,levels:MAP_BLUEPRINTS.map((template,i)=>({...template,id:'c'+(ci+1)+'-l'+(i+1),ready:true}))}));
const ALL_LEVELS=CHAPTERS.flatMap(ch=>ch.levels);
let PATH=BASE_PATH.map(p=>p.slice()),ORE=new Set(BASE_ORE),HQ={x:16,y:18},currentLevel=null;
let activeChapter=CHAPTERS[0].id;
let devTestAccess=false;
const BASE_WEAPON_UNLOCKS={turret:1,cannon:2,mortar:3};
const levelChapter=id=>CHAPTERS.findIndex(ch=>ch.levels.some(l=>l.id===id))+1;
const buildingAvailable=type=>['turret','cannon','mortar','mine','factory','pipe','bridge','eraser'].includes(type)&&(!(type in BASE_WEAPON_UNLOCKS)||BASE_WEAPON_UNLOCKS[type]<=levelChapter(currentLevel?.id));
const SAVE_KEY='forgefront.progress.v2';
const EMPTY_SAVE=()=>({version:2,difficulty:'normal',theme:'dark',tutorialSeen:false,results:{}});
function loadSave(){
 try{
  const old=JSON.parse(window.localStorage?.getItem('forgefront.progress.v1')||'null');
  const data=JSON.parse(window.localStorage?.getItem(SAVE_KEY)||'null');
  // DEV1 ratings were earned with all weapons on different layouts, so only
  // migrate player preferences, never medals or unlocked levels.
  if(!data&&old?.version===1){return {version:2,difficulty:DIFFICULTIES[old.difficulty]?old.difficulty:'normal',theme:old.theme==='light'?'light':'dark',tutorialSeen:old.tutorialSeen===true,results:{}};}
  if(!data||data.version!==2||typeof data.results!=='object'||!data.results||Array.isArray(data.results))return EMPTY_SAVE();
  return {version:2,difficulty:DIFFICULTIES[data.difficulty]?data.difficulty:'normal',theme:data.theme==='light'?'light':'dark',tutorialSeen:data.tutorialSeen===true,results:data.results};
 }catch{return EMPTY_SAVE();}
}
const save=loadSave();selectedDifficulty=save.difficulty;
function persist(){try{window.localStorage?.setItem(SAVE_KEY,JSON.stringify(save));}catch{/* Game remains playable in private mode. */}}
function best(levelId,difficulty){const v=save.results[levelId]?.[difficulty];return v&&Number.isInteger(v.stars)&&v.stars>=1&&v.stars<=3&&Number.isInteger(v.leaks)&&v.leaks>=0?v:null;}
function completed(levelId){return Object.keys(DIFFICULTIES).some(d=>!!best(levelId,d));}
function chapterCompleted(ch){return ch.levels.every(l=>completed(l.id));}
function chapterUnlocked(i){return devTestAccess||i===0||chapterCompleted(CHAPTERS[i-1]);}
function unlocked(levelId){const idx=ALL_LEVELS.findIndex(l=>l.id===levelId);return idx>=0&&(devTestAccess||idx===0||completed(ALL_LEVELS[idx-1].id));}
function availableLevel(id){const level=ALL_LEVELS.find(l=>l.id===id);return level&&level.ready&&unlocked(id)?level:null;}
function score(leaks){return leaks===0?3:leaks<=4?2:1;}
function storeVictory(){if(!currentLevel||!g?.bossDefeated||g.bossEscaped)return null;
 const stars=score(g.leaks);
 if(devTestAccess)return stars; // Test levels can be sampled without contaminating campaign records.
 const old=best(currentLevel.id,selectedDifficulty);
 if(!old||stars>old.stars||stars===old.stars&&g.leaks<old.leaks){
  if(!save.results[currentLevel.id]||typeof save.results[currentLevel.id]!=='object')save.results[currentLevel.id]={};
  save.results[currentLevel.id][selectedDifficulty]={stars,leaks:g.leaks};persist();
 }
 return stars;
}
function renderCampaign(){
 $('difficulty').value=selectedDifficulty;
 document.querySelectorAll('[data-difficulty]').forEach(b=>{const active=b.dataset.difficulty===selectedDifficulty;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 const total=ALL_LEVELS.filter(l=>l.ready).length,done=ALL_LEVELS.filter(l=>l.ready&&completed(l.id)).length;
 $('campaign-progress').textContent=done+' / '+total+' Level geschafft'+(devTestAccess?' · TESTZUGANG':'');
 $('chapter-tabs').innerHTML=CHAPTERS.map((ch,i)=>'<button type="button" data-chapter="'+ch.id+'" class="chapter-tab'+(ch.id===activeChapter?' selected':'')+'" '+(chapterUnlocked(i)?'':'disabled')+' aria-label="Kapitel '+(i+1)+(chapterUnlocked(i)?' auswählen':' gesperrt')+'">'+String(i+1).padStart(2,'0')+(chapterCompleted(ch)?' ★':chapterUnlocked(i)?'':' 🔒')+'</button>').join('');
 const requested=CHAPTERS.find(ch=>ch.id===activeChapter)||CHAPTERS[0];
  const chapter=chapterUnlocked(CHAPTERS.indexOf(requested))?requested:CHAPTERS[0];activeChapter=chapter.id;
 $('chapter-title').textContent='Kapitel '+(CHAPTERS.indexOf(chapter)+1)+' · '+chapter.name;
 $('chapter-subtitle').textContent=chapter.levels.length+' Karten';
 $('level-grid').innerHTML=chapter.levels.map((l,i)=>{
  const isOpen=l.ready&&unlocked(l.id),rating=best(l.id,selectedDifficulty);
  const stars=Array.from({length:3},(_,j)=>'<span class="'+(rating&&j<rating.stars?'earned':'')+'">'+(rating&&j<rating.stars?'★':'☆')+'</span>').join('');
  return '<button class="level-card'+(isOpen?' available':' locked')+'" type="button" data-level="'+l.id+'" '+(isOpen?'':'disabled')+' aria-label="Level '+(i+1)+': '+l.name+(isOpen?' öffnen':l.ready?' gesperrt':' noch in Entwicklung')+'">'+
  '<span class="level-number">LEVEL '+String(i+1).padStart(2,'0')+'</span><span class="level-glyph">'+(isOpen?(l.challenge===1?'⌁':l.challenge===2?'⚑':'⬡'):'🔒')+'</span><strong>'+l.name+'</strong>'+
  (l.ready?'<span class="level-stars" aria-label="'+(rating?rating.stars+' von 3 Sternen':'Noch keine Sterne')+'">'+stars+'</span>':'<span class="level-unavailable">IN VORBEREITUNG</span>')+
  ''+'</button>';
 }).join('');
 $('campaign-note').textContent='Verfügbare Waffen: '+chapter.weapon+'. Welle 1 startest du selbst.';
  const chIndex=CHAPTERS.indexOf(chapter),chDone=chapterCompleted(chapter);
  $('chapter-reward').textContent=chDone?(chIndex===3?'★ Kampagne abgeschlossen':'★ Kapitel abgeschlossen · '+chapter.reward+' freigeschaltet'):'Belohnung für 3 Siege: '+chapter.reward+(chIndex===2?' · Labor folgt später':'');
  $('chapter-reward').classList.toggle('completed',chDone);
}
function showCampaign(){
 g=null;currentLevel=null;acc=0;pointerPositions.clear();gesture=null;warningExpires=0;
 $('overlay').classList.add('hidden');$('tutorial').hidden=true;$('details').hidden=true;
 $('game-shell').hidden=true;$('campaign').hidden=false;
 $('settings-panel').hidden=true;document.body.dataset.menuTheme=save.theme;
 renderCampaign();
}
function loadMap(level){
 PATH=level.path.map(([x,y])=>[x,y]);ORE=new Set(level.ore);
 HQ={...level.hq};
}
function syncWeaponUnlocks(){
 buildButtons.forEach(b=>{const allowed=buildingAvailable(b.dataset.type);b.hidden=!allowed;b.disabled=!allowed;});
}
function startLevel(id){
 const level=availableLevel(id);if(!level)return false;
 currentLevel=level;loadMap(level);syncWeaponUnlocks();
 $('campaign').hidden=true;$('game-shell').hidden=false;$('settings-panel').hidden=true;
 reset();goto(HQ.x===16?8:9,10);
 return true;
}
function changeDifficulty(value){if(!$('campaign').hidden&&DIFFICULTIES[value]){selectedDifficulty=value;save.difficulty=value;persist();renderCampaign();return true;}return false;}
function applyTheme(theme){save.theme=theme==='light'?'light':'dark';document.body.dataset.menuTheme=save.theme;$('theme-choice').value=save.theme;persist();}
const COST={turret:24,cannon:38,mortar:42,mine:22,factory:18,pipe:4,bridge:10};
const WEAPONS={turret:{range:3.3,interval:.45,damage:3,demand:0.6},cannon:{range:4,interval:1.9,damage:11,demand:0.6},mortar:{range:5,minRange:1.5,interval:2.2,damage:7,radius:1.45,demand:0.65}};
const isWeapon=b=>!!b&&WEAPONS[b.type]!==undefined,weaponDemand=b=>WEAPONS[b.type]?.demand||0;
const LEGACY_WAVES=[
 {label:"ERSTE VERTEIDIGUNG",count:30,groupSize:6,interval:0.221,gap:0.75,hp:8,speed:1.45,pattern:["normal","normal","scout","normal","scout","normal","normal","normal","scout","normal","scout","normal","normal","scout","normal","scout"]},
 {label:"SCOUT-ANSTURM",count:50,groupSize:10,interval:0.173,gap:0.72,hp:9,speed:1.65,pattern:["scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","normal","scout","normal","scout"]},
 {label:"PANZERKOLONNE",count:65,groupSize:13,interval:0.230,gap:0.90,hp:11,speed:1.52,pattern:["heavy","normal","normal","scout","heavy","normal","heavy","normal","scout","normal","heavy","normal","scout","normal","heavy","normal","normal","scout","heavy","normal","scout","normal","heavy","normal","scout","normal","heavy","normal","normal","scout"]},
 {label:"GROSSANGRIFF",count:90,groupSize:15,interval:0.165,gap:0.76,hp:12,speed:1.68,pattern:["scout","normal","scout","heavy","normal","scout","normal","heavy","scout","normal","scout","normal","scout","heavy","normal","scout","normal","heavy","scout","normal","scout","heavy","normal","scout","normal","scout","normal","heavy","scout","normal","scout","normal","heavy","scout","normal","scout","normal","scout","heavy","normal","scout","normal","scout","heavy","scout"]},
 {label:"ÜBERMACHT",count:130,groupSize:26,interval:0.139,gap:0.70,hp:11,speed:1.86,pattern:["scout","scout","normal","scout","normal","scout","scout","heavy","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","heavy","normal","scout","scout","normal","scout","normal","scout","scout","normal","scout","scout","heavy","scout","normal","scout","scout","normal","scout","scout","scout","normal","scout","scout","normal","heavy","scout","scout","normal","scout","scout","normal","scout","scout","normal","scout","scout","normal","heavy","scout","scout","normal","scout","scout","normal"]},
 {label:"BOSS: EISENBRECHER",count:74,groupSize:14,interval:0.216,gap:0.99,hp:13,speed:1.58,pattern:["scout","normal","scout","heavy","normal","scout","normal","scout","heavy","normal","scout","normal","scout","heavy","scout","normal","scout","normal","heavy","scout","normal","scout","heavy","normal","scout","normal","scout","heavy","scout","normal","scout","normal","scout","normal"],boss:true}
];
// MG-only introduction: every map has its own enemy pressure, timing and boss.
const MG_LEVEL_WAVES=[
 {counts:[10,14,18,22,26,22],hp:[6,7,7,8,9,10],speed:[1.2,1.3,1.4,1.42,1.5,1.45],bossHp:48,bossSpeed:.78,intervals:[.55,.47,.43,.40,.37,.43]},
 {counts:[12,17,22,27,31,26],hp:[6,7,8,9,10,11],speed:[1.25,1.35,1.45,1.53,1.6,1.54],bossHp:60,bossSpeed:.80,intervals:[.52,.44,.39,.36,.33,.40]},
 {counts:[11,17,21,25,29,27],hp:[7,8,9,10,11,12],speed:[1.22,1.33,1.42,1.50,1.58,1.49],bossHp:65,bossSpeed:.80,intervals:[.52,.46,.41,.38,.35,.40]}
];
function levelWaves(){
 if(!currentLevel)return LEGACY_WAVES;
 const design=MG_LEVEL_WAVES[currentLevel.challenge];
 if(!design)return LEGACY_WAVES;
 return design.counts.map((count,i)=>({
  label:['ERSTE VERTEIDIGUNG','SCHNELLE SCOUTS','VERSORGUNG UNTER DRUCK','DER ANSTURM','GROSSANGRIFF','KAPITELBOSS'][i],
  count,hp:design.hp[i],speed:design.speed[i],interval:design.intervals[i],groupSize:Math.max(5,Math.ceil(count/3)),gap:.85,
  pattern:i===0?['normal','normal','normal','scout']:
   i===1?['scout','normal','scout','normal']:
   i===2?['normal','scout','normal','normal','scout']:
   i===3?['scout','scout','normal','scout','normal']:
   i===4?['normal','scout','scout','normal','normal','scout']:
   ['normal','scout','normal','scout','normal'],
  boss:i===5,bossHp:design.bossHp,bossSpeed:design.bossSpeed,bossArmor:0
 }));
}
const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d'),boardbox=$('boardbox'),mini=$('minimap'),mc=mini.getContext('2d');
const buildButtons=[...document.querySelectorAll('.build')],speedValues=[2],minZoom=.35,maxZoom=3;
const key=(x,y)=>x+','+y,adj=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
let g,previous=performance.now(),acc=0,speedIndex=0,zoom=1,nextId=1,pointerPositions=new Map(),gesture=null,networkConnectionCache=new Map(),topologyVersion=0,flowCache=null,activeFlowCache=null,pipeTypeCache=null,displayRatios=new Map(),lastDisplayAt=null;
// Per-tick spatial index makes mortar targeting predictable under dense swarms.
const enemyPositions=new Map(),enemyBuckets=new Map(),splashCache=new Map(),targetCache=new Map();
function refreshEnemyGeometry(){
 enemyPositions.clear();enemyBuckets.clear();splashCache.clear();targetCache.clear();
 for(const e of g.enemies){const p=enemyPos(e);enemyPositions.set(e.id,p);
  const k=key(Math.floor(p.x),Math.floor(p.y));if(!enemyBuckets.has(k))enemyBuckets.set(k,[]);enemyBuckets.get(k).push(e);
 }
}
const cachedPos=e=>enemyPositions.get(e.id)||enemyPos(e);
function building(type,x,y){return {id:nextId++,type,x,y,cool:0,fireCharge:0,waveAmount:0,lastWaveRate:null,lastIssue:'Noch nicht getestet',committed:false};}
function inform(msg){$('hint').textContent=msg;$('status').textContent=msg;}
function overlay(icon,title,description,action){$('o-icon').textContent=icon;$('o-title').textContent=title;$('o-text').textContent=description;$('start').textContent=action;$('intro-skip').hidden=true;$('overlay').classList.remove('hidden');}
function at(x,y){return g.buildings.find(b=>b.x===x&&b.y===y);}
function isRoad(x,y){return PATH.some(p=>p[0]===x&&p[1]===y);}
function isPipe(b){return !!b&&(b.type==='pipe'||b.type==='bridge');}
function nearby(b){return DIRS.map(d=>at(b.x+d[0],b.y+d[1])).filter(Boolean);}
let activeCategory=null;
function showBuildTray(open){if(!open)activeCategory=null;else if(!activeCategory)activeCategory='weapons';renderBuildCategory();}
function renderBuildCategory(){
 const open=!!activeCategory&&g?.phase==='build'&&g?.mode==='playing';
 $('build-tray').hidden=!open;$('dock').classList.toggle('open',open);
 $('dock-toggle').setAttribute('aria-expanded',String(open));
 for(const b of document.querySelectorAll('.category')){const yes=b.dataset.category===activeCategory;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));}
 for(const b of buildButtons)b.hidden=!open||b.dataset.category!==activeCategory||!buildingAvailable(b.dataset.type);
}
function toggleCategory(name){if(g.mode!=='playing'||g.phase!=='build')return;activeCategory=activeCategory===name?null:name;renderBuildCategory();}

// Auto-detect a pipe component's material from its terminal buildings.
// Factories are converters/endpoints, NOT transit nodes for either medium.
// A component with both mine and turret terminals is not constructible.
function scanPipeTypes(){
 const types=new Map(),conflicts=[],visited=new Set();
 for(const start of g.buildings){if(!isPipe(start)||visited.has(start.id))continue;
  const stack=[start],group=[],terminals=new Set();visited.add(start.id);
  while(stack.length){const b=stack.pop();group.push(b);
   for(const n of nearby(b)){
    if(isPipe(n)&&!visited.has(n.id)){visited.add(n.id);stack.push(n);}
    else if(n.type==='mine')terminals.add('metal');
    else if(isWeapon(n))terminals.add('ammo');
   }
  }
  const mixed=terminals.size>1,material=mixed?'conflict':terminals.size===1?[...terminals][0]:null;
  for(const b of group)types.set(b.id,material);
  if(mixed)conflicts.push(group.map(b=>b.id));
 }
 return {types,conflicts};
}
function pipeTypes(){if(pipeTypeCache&&pipeTypeCache.version===topologyVersion)return pipeTypeCache.types;
 const scanned=scanPipeTypes();pipeTypeCache={version:topologyVersion,types:scanned.types};return scanned.types;
}
function reset(){
 warningExpires=0;warningText='';hoverCell=null;$('gold-warning').hidden=true;$('gold').classList.remove('low-gold');
 activeCategory=null;delete $('wave-list').dataset.ready;
 nextId=1;speedIndex=0;networkConnectionCache.clear();topologyVersion++;flowCache=null;pipeTypeCache=null;activeFlowCache=null;displayRatios.clear();lastDisplayAt=null;
 const difficulty=DIFFICULTIES[selectedDifficulty];
 g={mode:'playing',levelId:currentLevel.id,phase:'build',wave:0,paused:false,time:0,enemyDelay:null,difficulty:selectedDifficulty,gold:difficulty.startGold,metal:0,ammo:0,hp:difficulty.hq,kills:0,leaks:0,bossDefeated:false,bossEscaped:false,
  selected:null,buildings:[],packets:[],enemies:[],shots:[],spawner:null,deliveredMetal:0,deliveredAmmo:0,producedMetal:0,producedAmmo:0,ammoSpent:0,shotsFired:0,
  waves:Array.from({length:MAX_WAVES},()=>({started:false,doneSpawning:false,alive:0,paid:false})),goldEarned:0,goldRefunded:0,waveStart:0,tutorial:{active:false,stage:0,completed:false},selectedBuildingId:null};
 acc=0;pointerPositions.clear();gesture=null;refreshEnemyGeometry();
 $('overlay').classList.add('hidden');showBuildTray(false);$('tutorial').hidden=true;$('details').hidden=true;
 const firstTutorial=!save.tutorialSeen;g.tutorial.active=firstTutorial;if(firstTutorial){save.tutorialSeen=true;persist();}
 inform('BAUPHASE: Plane dein Netz in Ruhe. Starte Welle 1 erst, wenn du bereit bist.');update();draw();
}
function buildError(type,x,y){
 if(g.mode!=='playing'||g.phase!=='build')return 'Bauen ist nur zwischen den Wellen erlaubt.';
 if(!buildingAvailable(type))return 'Dieses Geschütz wird in einem späteren Kapitel freigeschaltet.';
 if(x<0||y<0||x>=W||y>=H)return 'Außerhalb der Karte.';
 if(at(x,y))return 'Dieses Feld ist bereits belegt.';
 if(type==='bridge'){if(!isRoad(x,y))return 'Eine Brücke kann nur auf dem Gegnerweg stehen.';const q=PATH[PATH.length-1];if(x===q[0]&&y===q[1])return 'HQ-Feld darf nicht überbaut werden.';}
 else if(isRoad(x,y))return 'Hier verläuft der Gegnerweg – nimm eine Brücke.';
 if(type==='mine'&&!ORE.has(key(x,y)))return 'Eine Mine braucht ein Erzfeld.';
 if(type!=='mine'&&ORE.has(key(x,y)))return 'Dieses Erzfeld ist für eine Mine reserviert.';
 if(g.gold<COST[type])return 'Es fehlen '+(COST[type]-g.gold)+' Gold.';
 return null;
}
let warningExpires=0,warningText='',hoverCell=null;
function warnGold(cost,type){
 const labels={turret:'MG',cannon:'Kanone',mortar:'Mörser',mine:'Erzmine',factory:'Fabrik',pipe:'Rohr',bridge:'Brücke'};
 warningText='⚠ ZU WENIG GOLD: '+(labels[type]||'Gebäude')+' '+cost+' · vorhanden '+g.gold+' · fehlen '+(cost-g.gold);
 warningExpires=performance.now()+2400;
 $('gold-warning').textContent=warningText;$('gold-warning').hidden=false;
 $('gold').classList.add('low-gold');
 inform(warningText);
}
function payGold(cost){if(g.gold<cost)return false;g.gold-=cost;return true;}
function refundRate(){return ECONOMY.refundByDifficulty[ECONOMY.difficulty];}
function erase(x,y,silent=false){
 if(g.mode!=='playing'||g.phase!=='build'){if(!silent)inform('Abriss ist während einer Angriffswelle gesperrt.');return false;}
 const b=at(x,y);if(!b){if(!silent)inform('Hier steht kein Gebäude.');return false;}
 g.buildings.splice(g.buildings.indexOf(b),1);networkConnectionCache.clear();topologyVersion++;flowCache=null;pipeTypeCache=null;activeFlowCache=null;if(g.selectedBuildingId===b.id)hideDetails();
 const refund=Math.floor(COST[b.type]*(b.committed?.5:1));g.gold+=refund;g.goldRefunded+=refund;
 if(!silent)inform('Abgebaut: '+refund+' Gold zurück.');update();return true;
}
function select(type){if(g.mode!=='playing'||g.phase!=='build'||!buildingAvailable(type))return;
 hoverCell=null;
 g.selected=g.selected===type?null:type;
 inform(g.selected==='pipe'?'Rohr aktiv: mit Finger über die Karte ziehen.':g.selected==='eraser'?'Radierer aktiv: Zum Entfernen auf Gebäude oder Rohr tippen.':g.selected?'Feld wählen: '+({mine:'Erzmine: fördert Metall (MAX 1,0/s) auf Erzfeldern.',factory:'Fabrik frei platzieren.',turret:'MG frei platzieren.',cannon:'Kanone gegen Panzer.',mortar:'Mörser für Gruppen.',bridge:'Brücke auf Gegnerweg bauen.'}[g.selected]||''):'Karte verschieben; mit zwei Fingern zoomen.');
 update();
}
function place(type,x,y,silent=false){
 if(g.mode!=='playing'||g.phase!=='build'){if(!silent)inform('Während der Angriffswelle ist Bauen gesperrt.');return false;}
 let desired=type;if(type==='pipe'&&isRoad(x,y))desired='bridge';
 const err=buildError(desired,x,y);if(err){if(!silent){if(g.gold<COST[desired]&&err.includes('Gold'))warnGold(COST[desired],desired);else inform(err);}return false;}
 // Validate entire topology before spending gold; abort mixed-medium networks.
 const candidate=building(desired,x,y);g.buildings.push(candidate);
 if(scanPipeTypes().conflicts.length){g.buildings.pop();inform('Rohrkonflikt: Metall und Munition dürfen nicht im selben Rohrnetz sein. Trenne die Leitungen an der Fabrik.');return false;}
 if(!payGold(COST[desired])){g.buildings.pop();if(!silent)warnGold(COST[desired],desired);return false;}
 networkConnectionCache.clear();topologyVersion++;flowCache=null;pipeTypeCache=null;activeFlowCache=null;if(!silent)inform(desired==='bridge'?'Brücke verbunden.':desired==='pipe'?'Rohr gebaut – automatisch verbunden.':desired==='mine'?'Erzmine: MAX 1 Metall/s. Über Rohre mit einer Fabrik verbinden.':'Gebäude steht – Versorgung über Rohre anschließen.');
 update();return true;
}
function startWave(){
 if(g.mode!=='playing'||g.phase!=='build'||g.wave>=MAX_WAVES)return false;
 primeDisplayRatios();g.wave++;g.phase='combat';g.paused=false;g.selected=null;hoverCell=null;g.enemyDelay=FIRST_DELAY;g.spawner=null;g.waveStart=g.time;for(const b of g.buildings){b.waveAmount=0;b.cool=0;b.fireCharge=0;}
 g.waves[g.wave-1].started=true;for(const b of g.buildings)b.committed=true;syncTutorial();
 showBuildTray(false);
 inform((g.wave===MAX_WAVES?'BOSSWELLE':'WELLE '+g.wave)+' startet! Die Versorgungsbilanz gilt sofort, Gegner erscheinen in '+FIRST_DELAY+' Sekunden.');update();return true;
}
function checkWaveComplete(){
 const r=g.waves[g.wave-1];if(!r||!r.doneSpawning||r.alive!==0||g.spawner||g.enemyDelay!==null||g.phase!=='combat')return;
 if(!r.paid){r.paid=true;const reward=currentLevel?.challenge!==undefined?20:ECONOMY.goldPerWave;g.gold+=reward;g.goldEarned+=reward;}
 captureWaveMetrics();if(g.wave===MAX_WAVES){finish(g.bossDefeated&&!g.bossEscaped);return;}
 g.phase='build';g.selected=null;g.paused=false;showBuildTray(false);
 inform('Welle '+g.wave+' überstanden! +'+(currentLevel?.challenge!==undefined?20:ECONOMY.goldPerWave)+' Gold. Industrie pausiert. In Ruhe umbauen, dann Welle '+(g.wave+1)+' starten.');
 update();
}
function enemyPos(e){const i=Math.min(Math.floor(e.pos),PATH.length-2),a=PATH[i],b=PATH[i+1],t=Math.min(1,e.pos-i);return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t};}
function finish(win){
 win=!!win&&g.bossDefeated&&!g.bossEscaped;if(!win&&g.phase==='combat')captureWaveMetrics();
 g.mode=win?'won':'lost';g.paused=false;
 const chapterIndex=levelChapter(currentLevel.id)-1,chapter=CHAPTERS[chapterIndex];
 const firstChapterClear=win&&currentLevel.challenge===2&&!chapterCompleted(chapter)&&!devTestAccess;
 const stars=win?storeVictory():null;
 g.chapterClear=firstChapterClear;
 overlay(win?'★':'⚠',firstChapterClear?(chapterIndex===3?'KAMPAGNE ABGESCHLOSSEN!':'KAPITEL '+(chapterIndex+1)+' ABGESCHLOSSEN!'):win?'BOSS BESIEGT!':g.bossEscaped?'BOSS ENTWISCHT!':'BASIS VERLOREN',
 win?'Boss besiegt! '+g.kills+' Abschüsse · '+g.leaks+' Durchbrüche · HQ: '+g.hp+' Leben.':
 g.bossEscaped?'Der Boss ist durchgekommen. Das Level ist unabhängig von den HQ-Leben verloren.':
 g.kills+' Gegner besiegt, '+g.leaks+' Durchbrüche. Verbessere Standorte und Versorgung.','Nochmal versuchen');
 $('result-rating').hidden=!win;$('result-rating').textContent=win?('★'.repeat(stars)+'☆'.repeat(3-stars)+'  ·  '+DIFFICULTIES[selectedDifficulty].name):'';
 $('result-unlock').hidden=!firstChapterClear;
 $('result-unlock').textContent=firstChapterClear?(chapterIndex===0?'✹ KANONE FREIGESCHALTET · KAPITEL 2':chapterIndex===1?'◉ MÖRSER FREIGESCHALTET · KAPITEL 3':chapterIndex===2?'⚗ KAPITEL 4 FREIGESCHALTET · LABOR FOLGT':'★ ALLE KAPITEL ABGESCHLOSSEN'):'';
 const next=ALL_LEVELS[ALL_LEVELS.findIndex(l=>l.id===currentLevel.id)+1];
 $('result-next').hidden=!win||!next||!availableLevel(next.id);
 $('result-next').textContent=currentLevel.challenge===2?'Nächstes Kapitel':'Nächstes Level';
 inform(win?'Sieg: Boss besiegt!':'Niederlage – Beim nächsten Versuch cleverer planen.');update();
}
// KISS: Connections are pipes/bridges (buildings are endpoints, never relay nodes).
function nextToTarget(source,target){if(!source||!target)return null;
  const required=source.type==='mine'&&target.type==='factory'?'metal':source.type==='factory'&&isWeapon(target)?'ammo':null;
  if(!required)return null;
  const types=pipeTypes();
  const visited=new Set([source.id]),q=[{b:source,first:null}];
 for(let i=0;i<q.length;i++){const {b,first}=q[i];for(const n of nearby(b)){
  if(n.id===target.id)return first||n;
  if(isPipe(n)&&types.get(n.id)===required&&!visited.has(n.id)){visited.add(n.id);q.push({b:n,first:first||n});}
 }}return null;
}
function netReachable(source,target){const id=source.id+','+target.id;if(!networkConnectionCache.has(id))networkConnectionCache.set(id,!!nextToTarget(source,target));return networkConnectionCache.get(id);}
const METAL_PER_FACTORY=.4,AMMO_PER_FACTORY=1.2,AMMO_PER_MG=WEAPONS.turret.demand;
function maxRate(b){return b.type==='mine'?1:b.type==='factory'?AMMO_PER_FACTORY:isWeapon(b)?weaponDemand(b):0;}
function clamp(n){return Math.max(0,Math.min(1,n));}
// Allocation has no pipe throughput limit. A source can serve only a reachable sink.
// Uniform %-coverage is computed before any spare capacity is redistributed.
function allocate(sources,sinks,capacity,demand){
 const result=new Map(sinks.map(s=>[s.id,0]));result.sourceUsed=new Map(sources.map(s=>[s.id,0]));if(!sources.length||!sinks.length)return result;
 const edges=sources.map(p=>sinks.map(c=>netReachable(p,c)));
 const adjS=edges.map(row=>row.map((ok,j)=>ok?j:-1).filter(j=>j>=0));
 const activeS=new Set(),activeT=new Set(),done=new Set();
 for(let i=0;i<sources.length;i++)if(adjS[i].length){activeS.add(i);for(const j of adjS[i])activeT.add(j);}
 // Independent bipartite components never share material.
 for(const si of activeS){if(done.has(si))continue;
  const from=[si],srcIds=new Set(),dstIds=new Set();
  while(from.length){const i=from.pop();if(srcIds.has(i))continue;srcIds.add(i);done.add(i);
   for(const j of adjS[i]){dstIds.add(j);for(let k=0;k<sources.length;k++)if(edges[k][j]&&!srcIds.has(k))from.push(k);}}
  const src=[...srcIds],dst=[...dstIds];if(!dst.length)continue;
  const flow=(quotas,needResult=false,sourceFraction=1)=>{
   const n=2+src.length+dst.length,T=n-1,res=Array.from({length:n},()=>new Array(n).fill(0));
   for(let a=0;a<src.length;a++){
    res[0][1+a]=Math.max(0,capacity(sources[src[a]])*sourceFraction);
    for(let b=0;b<dst.length;b++)if(edges[src[a]][dst[b]])res[1+a][1+src.length+b]=1e5;
   }
   let goal=0;for(let b=0;b<dst.length;b++){const want=Math.max(0,quotas[b]);res[1+src.length+b][T]=want;goal+=want;}
   let sent=0;while(true){const parent=new Array(n).fill(-1),queue=[0];parent[0]=0;
    for(let h=0;h<queue.length&&parent[T]<0;h++)for(let v=0;v<n;v++)if(parent[v]<0&&res[queue[h]][v]>1e-8){parent[v]=queue[h];queue.push(v);}
    if(parent[T]<0)break;let push=1e9;for(let v=T;v!==0;v=parent[v])push=Math.min(push,res[parent[v]][v]);
    for(let v=T;v!==0;v=parent[v]){res[parent[v]][v]-=push;res[v][parent[v]]+=push;}sent+=push;
   }
   if(!needResult)return sent>=goal-1e-6;
   return {sent,delivered:dst.map((_,b)=>quotas[b]-res[1+src.length+b][T]),res};
  };
  // Max-min fair: every same-level consumer receives equal % of its own demand.
  let lo=0,hi=1;for(let z=0;z<25;z++){const mid=(lo+hi)/2;if(flow(dst.map(j=>demand(sinks[j])*mid)))lo=mid;else hi=mid;}
  const quotas=dst.map(j=>demand(sinks[j])*lo);let allocation=flow(quotas,true);
  for(let b=0;b<dst.length;b++)result.set(sinks[dst[b]].id,allocation.delivered[b]);
  // If a subset is constrained by its own pipes, use the other sources' surplus
  // without taking away the common baseline. This honours physical reachability.
  const n=2+src.length+dst.length,T=n-1,rr=allocation.res;
  for(let b=0;b<dst.length;b++){
   const node=1+src.length+b;
   rr[node][T]=Math.max(0,demand(sinks[dst[b]])-allocation.delivered[b]);
   rr[T][node]=0;
  }
  while(true){const par=new Array(n).fill(-1),queue=[0];par[0]=0;
   for(let h=0;h<queue.length&&par[T]<0;h++)for(let v=0;v<n;v++)if(par[v]<0&&rr[queue[h]][v]>1e-8){par[v]=queue[h];queue.push(v);}
   if(par[T]<0)break;
   let amount=1e9;for(let v=T;v!==0;v=par[v])amount=Math.min(amount,rr[par[v]][v]);
   for(let v=T;v!==0;v=par[v]){rr[par[v]][v]-=amount;rr[v][par[v]]+=amount;}
  }
  for(let b=0;b<dst.length;b++)result.set(sinks[dst[b]].id,Math.min(demand(sinks[dst[b]]),demand(sinks[dst[b]])-rr[1+src.length+b][T]));
  // Balance producers too: equal loading among interchangeable reachable mines.
  const finalQuotas=dst.map(j=>result.get(sinks[j].id)||0);
  let low=0,high=1;for(let k=0;k<25;k++){const mid=(low+high)/2;if(flow(finalQuotas,false,mid))high=mid;else low=mid;}
  const fair=flow(finalQuotas,true,Math.min(1,high+1e-5));
  for(let a=0;a<src.length;a++)result.sourceUsed.set(sources[src[a]].id,Math.max(0,capacity(sources[src[a]])*Math.min(1,high+1e-5)-fair.res[0][1+a]));
 }
 return result;
}
function calculateFlow(activeOnly=false){
 const mines=g.buildings.filter(b=>b.type==='mine'),factories=g.buildings.filter(b=>b.type==='factory'),turrets=g.buildings.filter(isWeapon);
 const usableTurrets=activeOnly?turrets.filter(t=>t.fireCharge<1-1e-9):turrets; // Turrets charge up to one local shot, also without a target.
 const demandedFactories=factories.filter(f=>usableTurrets.some(t=>netReachable(f,t)));
 const metalCapacity=allocate(mines,demandedFactories,()=>1,()=>METAL_PER_FACTORY);
 const factoryCapacity=new Map(factories.map(f=>[f.id,(metalCapacity.get(f.id)||0)*3]));
 const ammo=allocate(factories,usableTurrets,f=>factoryCapacity.get(f.id)||0,t=>weaponDemand(t));
 // Unneeded output is not manufactured or stored: throttle upstream production
 // to actual downstream consumption, then balance mines over that real demand.
 const metalUsed=allocate(mines,demandedFactories,()=>1,f=>(ammo.sourceUsed.get(f.id)||0)/3);
 const infos=new Map();
 const sourceLoad=metalUsed.sourceUsed;
 // Free-to-use capacity is healthy, not an error.
 for(const m of mines){const reachable=factories.some(f=>netReachable(m,f));const required=(sourceLoad.get(m.id)||0);
  infos.set(m.id,{rate:required,ratio:reachable?required:0,kind:!reachable?'danger':activeOnly&&!usableTurrets.length?'idle':'ok',issue:reachable?(required<.999?'Förderreserve verfügbar':'Volle Förderung für die Fabriken'):'Keine Fabrik verbunden',max:1,demand:required});
 }
 for(const f of factories){const supplied=metalUsed.get(f.id)||0,hasMine=mines.some(m=>netReachable(m,f)),hasMG=turrets.some(t=>netReachable(f,t)),activeDemand=usableTurrets.some(t=>netReachable(f,t));
  const rate=ammo.sourceUsed.get(f.id)||0,ratio=hasMG?clamp(rate/AMMO_PER_FACTORY):0;
  const metalShort=hasMine&&hasMG&&(factoryCapacity.get(f.id)||0)<AMMO_PER_FACTORY-.01;
  infos.set(f.id,{rate,max:AMMO_PER_FACTORY,ratio,kind:!hasMine||!hasMG?'danger':!activeDemand?'idle':metalShort?'warn':'ok',issue:!hasMine?'Keine Erzmine angeschlossen':!hasMG?'Keine Waffe angeschlossen':!activeDemand?'Bereit – gerade kein Gegner in Reichweite':metalShort?'Metallmangel: weitere Erzmine anschließen':ratio<.995?'Ausreichend versorgt – Produktionsreserve':'Metallversorgung ausreichend',demand:METAL_PER_FACTORY});
 }
 for(const t of turrets){const supplied=ammo.get(t.id)||0,ratio=clamp(supplied/weaponDemand(t)),hasFactory=factories.some(f=>netReachable(f,t)),isActive=usableTurrets.includes(t);
  infos.set(t.id,{rate:supplied,max:weaponDemand(t),ratio:activeOnly&&!isActive&&hasFactory?1:ratio,kind:!hasFactory?'danger':activeOnly&&!isActive?'idle':ratio>=.995?'ok':'warn',issue:!hasFactory?'Keine Fabrik angeschlossen':activeOnly&&!isActive?'Bereit – ein Schuss geladen':ratio>=.995?'Munition vollständig gedeckt':'Zu wenig Munition aus angeschlossenen Fabriken',demand:weaponDemand(t)});
 }
 return {infos,metalRate:[...mines].reduce((a,m)=>a+(infos.get(m.id)?.rate||0),0),ammoRate:[...factories].reduce((a,f)=>a+(infos.get(f.id)?.rate||0),0)};
}
function flow(active=false){
 if(!active&&flowCache&&flowCache.version===topologyVersion)return flowCache.data;
 if(active){const key=g.buildings.filter(b=>isWeapon(b)&&b.fireCharge<1-1e-9).map(b=>b.id).join(',');
  if(activeFlowCache&&activeFlowCache.version===topologyVersion&&activeFlowCache.key===key)return activeFlowCache.data;
  const data=calculateFlow(true);activeFlowCache={version:topologyVersion,key,data};return data;
 }
 const data=calculateFlow(false);flowCache={version:topologyVersion,data};return data;
}
function productionInfo(b){const combat=g.phase==='combat',base=flow(false).infos.get(b.id),live=combat?flow(true).infos.get(b.id):base;
 const info=live||base||{rate:0,max:0,ratio:0,kind:'idle',issue:'Keine Daten'};
 const idle=combat&&info.kind==='idle';const ratio=idle?(base?.ratio||0):info.ratio;
 return {max:info.max||0,actual:info.rate||0,ratio:Math.round(100*ratio),severity:idle?'idle':info.kind,text:info.issue,period:combat?(idle?'Kampfphase: Bereitschaft für den nächsten Angriff':'Kampfphase: Versorgung nach aktuellem Bedarf'):'Bauphase: Prognose für maximale Auslastung',planned:base?.rate||0};
}
// Display-only low-pass filter. The 30 Hz combat simulator and its resource allocation stay exact.
// Each wave begins from the instant build forecast; planning always shows exact percentages.
function primeDisplayRatios(){
 displayRatios.clear();const planned=flow(false).infos;
 for(const b of g.buildings)if(!isPipe(b))displayRatios.set(b.id,100*(planned.get(b.id)?.ratio||0));
 lastDisplayAt=null;
}
function sampleDisplayRatios(seconds){
 if(!g||g.mode!=='playing'||g.phase!=='combat'||g.paused)return;
 const alpha=1-Math.exp(-Math.min(.5,Math.max(0,seconds))/DISPLAY_RESPONSE_S);
 for(const b of g.buildings){if(isPipe(b))continue;
  const target=productionInfo(b).ratio,previous=displayRatios.get(b.id)??target;
  const next=previous+(target-previous)*alpha;
  displayRatios.set(b.id,Math.abs(target-next)<.45?target:next);
 }
}
function visibleRatio(b,info){
 return g.phase==='combat'&&displayRatios.has(b.id)?Math.round(displayRatios.get(b.id)):info.ratio;
}
function captureWaveMetrics(){for(const b of g.buildings)if(!isPipe(b)){b.lastWaveRate=b.waveAmount/Math.max(.1,g.time-g.waveStart);}}
function makePlan(def){const list=[];
 for(let i=0;i<def.count;i++){
  const kind=def.pattern[i%def.pattern.length]||'normal';
  list.push({kind,hp:Math.max(1,Math.round((kind==='heavy'?Math.round(def.hp*1.5):kind==='scout'?Math.round(def.hp*.64):def.hp)*DIFFICULTIES[g?.difficulty||selectedDifficulty].enemyHp)),speed:kind==='heavy'?def.speed*.72:kind==='scout'?def.speed*1.35:def.speed,armor:kind==='heavy'?2:0});
 }
 if(def.boss)list.splice(Math.floor(list.length/2),0,{kind:'boss',hp:Math.max(1,Math.round((def.bossHp??110)*DIFFICULTIES[g?.difficulty||selectedDifficulty].enemyHp)),speed:def.bossSpeed??.98,armor:def.bossArmor??0});
 return list;
}
// Cached local-area splash counts replace an O(enemy^2 * mortarCount) search.
function splashCount(enemy,radius){
 const signature=enemy.id+':'+radius;
 if(splashCache.has(signature))return splashCache.get(signature);
 const p=cachedPos(enemy),r2=radius*radius;let total=0;
 for(let x=Math.floor(p.x-radius);x<=Math.floor(p.x+radius);x++)
  for(let y=Math.floor(p.y-radius);y<=Math.floor(p.y+radius);y++)
   for(const e of enemyBuckets.get(key(x,y))||[]){
    if(e.hp<=0)continue;const q=cachedPos(e),dx=q.x-p.x,dy=q.y-p.y;
    if(dx*dx+dy*dy<=r2)total++;
   }
 splashCache.set(signature,total);return total;
}
function makeTarget(turret){
 if(targetCache.has(turret.id))return targetCache.get(turret.id);
 const spec=WEAPONS[turret.type],targets=g.enemies.filter(e=>{
  const p=cachedPos(e),dx=p.x-turret.x,dy=p.y-turret.y,d2=dx*dx+dy*dy;
  return d2<=spec.range*spec.range&&d2>=(spec.minRange||0)**2;
 });
 if(turret.type==='cannon')targets.sort((a,b)=>(b.armor||0)-(a.armor||0)||b.pos-a.pos);
 else if(turret.type==='mortar')targets.sort((a,b)=>splashCount(b,spec.radius)-splashCount(a,spec.radius)||b.pos-a.pos);
 else targets.sort((a,b)=>a.hp-b.hp||b.pos-a.pos);
 const found=targets[0]||null;targetCache.set(turret.id,found);return found;
}
function killEnemy(e){
 const i=g.enemies.indexOf(e);if(i<0)return;
 g.enemies.splice(i,1);g.waves[e.wave-1].alive--;g.kills++;if(e.kind==='boss')g.bossDefeated=true;enemyPositions.delete(e.id);splashCache.clear();targetCache.clear();const bounty=ECONOMY.goldPerType[e.kind]??2;g.gold+=bounty;g.goldEarned+=bounty;
 if(e.kind==='boss')inform('BOSS GESTOPPT! Besiege die letzten Begleitgegner.');
}
function hitEnemy(e,raw,pierce){
 e.hp-=Math.max(1,raw-Math.max(0,(e.armor||0)-pierce));
 if(e.kind==='boss'&&e.hp<=e.max*.5&&!e.enraged){e.enraged=true;e.speed*=1.38;e.armor=currentLevel?.challenge!==undefined?0:2;inform('⚠ BOSS-PHASE 2: Der Boss beschleunigt!');}
 if(e.hp<=0)killEnemy(e);
}
function shoot(turret,target){
 const spec=WEAPONS[turret.type],pos=cachedPos(target);
 const victims=turret.type==='mortar'?g.enemies.filter(e=>{const q=cachedPos(e),dx=q.x-pos.x,dy=q.y-pos.y;return dx*dx+dy*dy<=spec.radius*spec.radius;}):[target];
 for(const e of victims){const raw=turret.type==='cannon'&&e.kind==='scout'?4:turret.type==='mortar'&&e.kind==='heavy'?6:spec.damage;hitEnemy(e,raw,turret.type==='cannon'?3:0);}
 turret.cool=spec.interval;g.shotsFired++;g.ammoSpent+=spec.demand*spec.interval;g.shots.push({x:turret.x,y:turret.y,tx:pos.x,ty:pos.y,life:.15,mortar:turret.type==='mortar'});
 return true;
}
function simulate(dt){if(!g||g.mode!=='playing'||g.paused||g.phase!=='combat')return;
 g.time+=dt;
 if(g.enemyDelay!==null){g.enemyDelay-=dt;if(g.enemyDelay<=0){g.enemyDelay=null;const def=levelWaves()[g.wave-1];g.spawner={plan:makePlan(def),index:0,timer:0,interval:def.interval,groupSize:def.groupSize,gap:def.gap};inform((def.boss?'BOSSANGRIFF':'Welle '+g.wave)+' hat begonnen! Die Produktionsbilanz entscheidet.');}}
 if(g.spawner){const sp=g.spawner;sp.timer-=dt;
  // Each group is compact, followed by a deliberate gap. One spawn per simulation tick.
  if(sp.index<sp.plan.length&&sp.timer<=0){
   const unit=sp.plan[sp.index++];g.enemies.push({id:nextId++,pos:0,hp:unit.hp,max:unit.hp,speed:unit.speed,armor:unit.armor,kind:unit.kind,wave:g.wave,enraged:false});
   g.waves[g.wave-1].alive++;
   const crossed=sp.index%sp.groupSize===0&&sp.index<sp.plan.length;
   sp.timer+=crossed?sp.gap/DIFFICULTIES[g.difficulty].spawn:sp.interval/DIFFICULTIES[g.difficulty].spawn;
  }
  if(sp.index===sp.plan.length){g.waves[g.wave-1].doneSpawning=true;g.spawner=null;}
 }
 for(let i=g.enemies.length-1;i>=0;i--){const e=g.enemies[i];e.pos+=e.speed*dt;
  if(e.pos>=PATH.length-1){g.enemies.splice(i,1);g.waves[e.wave-1].alive--;g.leaks++;g.hp=Math.max(0,g.hp-(e.kind==='boss'?6:e.kind==='heavy'?2:1));if(e.kind==='boss')g.bossEscaped=true;}}
 if(g.hp<=0||g.bossEscaped){finish(false);return;}
 refreshEnemyGeometry();
 const live=flow(true);g.metal=live.metalRate;g.ammo=live.ammoRate;
 g.producedMetal+=live.metalRate*dt;g.producedAmmo+=live.ammoRate*dt;
 for(const b of g.buildings){if(isPipe(b))continue;const info=live.infos.get(b.id);if(info)b.waveAmount+=info.rate*dt;}
 for(const turret of g.buildings){if(!isWeapon(turret))continue;
  const supply=clamp(live.infos.get(turret.id)?.ratio||0);
  // Mine/factory ammo can prepare one chambered shot DURING combat (not build phase).
  // A charged weapon stops consuming ammo and never gains multiple stored shots.
  turret.fireCharge=Math.min(1,turret.fireCharge+dt*supply/WEAPONS[turret.type].interval);
  const target=makeTarget(turret);
  if(target&&turret.fireCharge>=1-1e-9){turret.fireCharge=0;shoot(turret,target);}
 }
 for(const q of g.shots)q.life-=dt;g.shots=g.shots.filter(q=>q.life>0);
 checkWaveComplete();
}
function wavePreview(i){
 const counts={normal:0,scout:0,heavy:0,boss:0};for(const e of makePlan(levelWaves()[i]))counts[e.kind]++;
 return Object.entries(counts).filter(([k,n])=>n).map(([k,n])=>n+'× '+({normal:'Normal',scout:'Scout',heavy:'Panzer',boss:'Boss'}[k])).join(' · ');
}

function updateWavePreview(){
 const waves=levelWaves(),descriptions=waves.map((w,i)=>wavePreview(i));
 const i=Math.min(g.wave,MAX_WAVES-1);
 const label='NÄCHSTE WELLE '+(i+1)+' · '+waves[i].label+' · '+descriptions[i];
 if($('next-wave').textContent!==label)$('next-wave').textContent=label;
 $('wave-preview').hidden=g.mode==='won'||g.mode==='lost'||g.phase!=='build';
 $('combat-count').hidden=g.mode!=='playing'||g.phase!=='combat';
 if(g.phase==='combat')$('combat-count').textContent='⚠ WELLE '+g.wave+'/'+MAX_WAVES+' · '+(g.enemies.length+(g.spawner?g.spawner.plan.length-g.spawner.index:0))+' GEGNER ÜBRIG';
 if(!$('wave-list').dataset.ready){$('wave-list').innerHTML=waves.map((w,k)=>'<div><b>'+(k+1)+'. '+w.label+'</b><span>'+descriptions[k]+'</span></div>').join('');$('wave-list').dataset.ready='1';}
}
const GUIDE=[
 {title:'Erzmine bauen',text:'Wähle unten die Erzmine und setze sie auf ein braunes Erzfeld. Sie liefert bis zu 1 Metall pro Sekunde.',tool:'mine'},
 {title:'Fabrik platzieren',text:'Die Fabrik verwandelt 1 Metall alle 2,5 Sekunden in 3 Munition. Baue eine Fabrik nahe deiner Erzmine.',tool:'factory'},
 {title:'Metallverbindung herstellen',text:'Verbinde Erzmine und Fabrik per orangefarbenem Metallrohr. Deine Versorgungsprozente werden schon beim Bauen sofort aktualisiert.',tool:'pipe'},
 {title:'MG am Gegnerweg platzieren',text:'Baue ein MG nahe der hellblauen Gegnerroute. Bei Dauerfeuer benötigt es 0,60 Munition/s. Während der Welle lädt jede Waffe höchstens einen Schuss vor.',tool:'turret'},
 {title:'MG mit Munition versorgen',text:'Verbinde die Fabrik mit dem MG über blaue Munitionsrohre. Metall und Munition bleiben getrennt. Die Prozentzahl am MG zeigt, wie viel seines maximalen Bedarfs gedeckt ist.',tool:'pipe'},
 {title:'Welle starten',text:'Prüfe zuerst die Prozentwerte. Während der Bauphase siehst du die Prognose, im Kampf läuft das System und Bauen ist gesperrt.',tool:'pause'}
];
function completeStage(step){const mines=g.buildings.filter(b=>b.type==='mine'),factories=g.buildings.filter(b=>b.type==='factory'),turrets=g.buildings.filter(isWeapon);
 if(step===0)return mines.length>0;
 if(step===1)return factories.length>0;
 if(step===2)return mines.some(m=>factories.some(f=>netReachable(m,f)));
 if(step===3)return turrets.length>0;
 if(step===4)return factories.some(f=>turrets.some(t=>netReachable(f,t)));
 return g.wave>0;
}
function clearGuideMarks(){for(const b of buildButtons)b.classList.remove('guide-focus');$('dock-toggle').classList.remove('guide-focus');$('pause').classList.remove('guide-focus');}
function syncTutorial(){if(!g?.tutorial?.active)return;clearGuideMarks();
 while(g.tutorial.stage<GUIDE.length&&completeStage(g.tutorial.stage))g.tutorial.stage++;
 if(g.tutorial.stage>=GUIDE.length){g.tutorial.active=false;g.tutorial.completed=true;save.tutorialSeen=true;persist();$('tutorial').hidden=true;inform('Tutorial abgeschlossen. Baue ein effizientes Netz und verteidige das HQ!');return;}
 if(g.mode!=='playing'||g.phase!=='build'||g.selectedBuildingId){$('tutorial').hidden=true;return;}
 const t=GUIDE[g.tutorial.stage];$('tutorial-step').textContent='TUTORIAL '+(g.tutorial.stage+1)+' / '+GUIDE.length;
 $('tutorial-title').textContent=t.title;$('tutorial-text').textContent=t.text;$('tutorial').hidden=false;
 if(t.tool==='pause')$('pause').classList.add('guide-focus');else{
  $('dock-toggle').classList.add('guide-focus');const choice=buildButtons.find(b=>b.dataset.type===t.tool);if(choice)choice.classList.add('guide-focus');
 }
}
function hideDetails(){if(!g)return;g.selectedBuildingId=null;$('details').hidden=true;}
function inspect(x,y){const b=at(x,y);if(!b||isPipe(b)){hideDetails();return false;}g.selectedBuildingId=b.id;$('tutorial').hidden=true;renderDetails();return true;}
function renderDetails(){if(!g?.selectedBuildingId)return;const b=g.buildings.find(x=>x.id===g.selectedBuildingId);
 if(!b){hideDetails();return;}const info=productionInfo(b),percent=visibleRatio(b,info);
 $('details').hidden=false;$('details-title').textContent=({mine:'Erzmine',factory:'Munitionsfabrik',turret:'MG-Turm',cannon:'Panzerbrecher',mortar:'Mörser'})[b.type]+' · VERSORGUNG';
 $('details-max').textContent=info.max.toFixed(2)+' /s';$('details-actual').textContent=(info.severity==='idle'?info.planned:info.actual).toFixed(2)+' /s';
 $('details-actual-label').textContent=g.phase==='combat'?(info.severity==='idle'?'BEREIT · PROGNOSE':'VERFÜGBAR · JETZT'):'VERFÜGBAR · PROGNOSE';
 $('details-meter').style.width=percent+'%';$('details-meter').style.background=info.severity==='danger'?'#f78383':info.severity==='warn'?'#ffbe77':info.severity==='ok'?'#80d9a4':'#9faebd';
 $('details-state').textContent=info.text;$('details-explain').textContent=info.period+' · '+percent+' %'+(b.type==='mine'?' der möglichen Förderung':' des maximalen Bedarfs');
}
function update(){if(!g)return;
 $('gold').textContent=g.gold;
 if(g.phase==='build'){g.metal=flow(false).metalRate;g.ammo=flow(false).ammoRate;}

 syncTutorial();renderDetails();updateWavePreview();$('refund-short').textContent='Neu 100% · Alt 50%';const build=g.phase==='build';$('phase-label').textContent=g.mode==='won'?'SIEG':g.mode==='lost'?'NIEDERLAGE':build?'BAUPHASE':'KAMPFPHASE';$('phase-label').classList.toggle('combat',!build);
 $('indicator').textContent=g.mode==='won'?'Boss besiegt!':g.mode==='lost'?'Verteidigung gescheitert':g.mode!=='playing'?'Bereit':build?'PROGNOSE · Industrie pausiert':g.paused?'Ⅱ PAUSE':g.enemyDelay!==null?'Gegner in '+Math.max(0,Math.ceil(g.enemyDelay))+'s':'VERSORGUNG · Kampf läuft';
 $('threat').textContent=g.mode==='won'?'★ BOSS BESIEGT':g.mode==='lost'?'⚠ VERLOREN':g.wave===MAX_WAVES?'⚠ BOSS':g.wave===MAX_WAVES-1?'BOSS ALS NÄCHSTES':'5 WELLEN + BOSS';
 $('pause').disabled=g.mode!=='playing';$('pause').textContent=g.mode==='won'?'★ SIEG':g.mode==='lost'?'VERLOREN':build?'▶ '+(g.wave===MAX_WAVES-1?'BOSS STARTEN':'WELLE '+(g.wave+1)+' STARTEN'):g.paused?'▶ FORTSETZEN':'Ⅱ PAUSE';
 
 $('dock').classList.toggle('combat',!build);$('dock-label').textContent=build?'BAUEN':'BAUEN GESPERRT';$('selection-label').textContent=build?(g.selected?({turret:'MG',mine:'Erzmine',factory:'Fabrik',pipe:'Rohr',bridge:'Brücke',eraser:'Radierer',cannon:'Kanone',mortar:'Mörser'}[g.selected]+' gewählt'):'Werkzeug wählen'):'Angriff läuft';
 $('dock-toggle').disabled=g.mode!=='playing'||!build;
 for(const b of buildButtons){b.disabled=g.mode!=='playing'||!build;b.classList.toggle('too-expensive',g.gold<COST[b.dataset.type]);b.classList.toggle('selected',g.selected===b.dataset.type);b.setAttribute('aria-pressed',String(g.selected===b.dataset.type));}
}
function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function draw(){if(!g)return;const c=ctx;c.clearRect(0,0,W*S,H*S);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  c.fillStyle=(x+y)%2?'#102238':'#142a41';c.fillRect(x*S,y*S,S,S);c.strokeStyle='#2a4054';c.lineWidth=1;c.strokeRect(x*S+.5,y*S+.5,S-1,S-1);
  if(ORE.has(key(x,y))&&!at(x,y)){c.fillStyle='#815c37';c.beginPath();c.moveTo(x*S+30,y*S+9);c.lineTo(x*S+47,y*S+30);c.lineTo(x*S+30,y*S+47);c.lineTo(x*S+11,y*S+30);c.closePath();c.fill();c.fillStyle='#f1c480';c.fillRect(x*S+25,y*S+24,10,11);}
 }
 for(const p of PATH){c.fillStyle='#2c576d';c.fillRect(p[0]*S+1,p[1]*S+1,S-2,S-2);}
 c.strokeStyle='#9dcbd9';c.globalAlpha=.32;c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();PATH.forEach((p,i)=>i?c.lineTo((p[0]+.5)*S,(p[1]+.5)*S):c.moveTo((p[0]+.5)*S,(p[1]+.5)*S));c.stroke();c.setLineDash([]);c.globalAlpha=1;
 // Material-colored pipes: amber=metal, cyan=ammo, grey=not yet assigned.
 const types=pipeTypes();
 for(const b of g.buildings){if(!isPipe(b))continue;const x=(b.x+.5)*S,y=(b.y+.5)*S;
  const medium=types.get(b.id),color=medium==='metal'?'#dfa863':medium==='ammo'?'#6dded4':'#879cae';
  c.strokeStyle=color;c.lineWidth=12;c.lineCap='round';
  for(const d of DIRS){const n=at(b.x+d[0],b.y+d[1]);if(!n)continue;
   // Factories accept either material, but different pipe networks cannot mix.
   if(isPipe(n)&&types.get(n.id)!==medium)continue;
   if(n.type==='mine'&&medium!=='metal'||isWeapon(n)&&medium!=='ammo')continue;
   c.beginPath();c.moveTo(x,y);c.lineTo(x+d[0]*S/2,y+d[1]*S/2);c.stroke();}
  c.fillStyle=color;c.beginPath();c.arc(x,y,7,0,7);c.fill();
  if(b.type==='bridge'){c.strokeStyle='#e8b16d';c.lineWidth=2;c.strokeRect(b.x*S+8,b.y*S+8,44,44);}
 }
 for(const b of g.buildings){if(isPipe(b))continue;const x=b.x*S,y=b.y*S,color=b.type==='mine'?'#f3bf75':b.type==='factory'?'#b6b0f5':b.type==='cannon'?'#ff9a86':b.type==='mortar'?'#e1b5f5':'#79e6dc';
  c.fillStyle='#091e2e';rounded(x+7,y+7,46,46,8);c.fill();c.strokeStyle=color;c.lineWidth=3;c.stroke();c.fillStyle=color;c.textAlign='center';c.font='bold 29px sans-serif';
  if(b.type==='mine')c.fillText('◆',x+30,y+39);
  else if(b.type==='factory')c.fillText('⚙',x+30,y+39);
  else if(b.type==='cannon')c.fillText('✹',x+30,y+39);
  else if(b.type==='mortar')c.fillText('◉',x+30,y+39);
  else{c.beginPath();c.arc(x+30,y+29,12,0,7);c.fill();c.strokeStyle='#d6fff5';c.lineWidth=6;c.beginPath();c.moveTo(x+30,y+29);c.lineTo(x+30,y+12);c.stroke();}
  const info=productionInfo(b),rateColor=info.severity==='danger'?'#ff8181':info.severity==='warn'?'#ffc36e':info.severity==='ok'?'#83ebb0':'#bed3df';
  // One clear KISS signal, predicted in building phase and live in combat.
  c.fillStyle='#091727';rounded(x+1,y+38,58,22,5);c.fill();c.strokeStyle=rateColor;c.lineWidth=1.5;c.stroke();
  c.textAlign='center';c.font='bold 19px system-ui,sans-serif';c.fillStyle=rateColor;c.fillText(visibleRatio(b,info)+'%',x+30,y+55);
  if(g.selectedBuildingId===b.id){c.strokeStyle='#f5d394';c.lineWidth=3;c.strokeRect(x+1,y+1,S-2,S-2);}
 }
 const hq=[HQ.x,HQ.y];c.fillStyle='#195768';rounded(hq[0]*S+5,hq[1]*S+5,50,50,8);c.fill();c.strokeStyle='#a4e9df';c.lineWidth=3;c.stroke();c.textAlign='center';c.fillStyle='#f0ffff';c.font='bold 15px sans-serif';c.fillText('HQ',hq[0]*S+30,hq[1]*S+29);c.font='bold 13px sans-serif';c.fillStyle=g.hp<=6?'#ff8686':'#fff0ae';c.fillText('♥ '+g.hp+'/'+DIFFICULTIES[g.difficulty].hq,hq[0]*S+30,hq[1]*S+47);
 const focused=g.buildings.find(b=>b.id===g.selectedBuildingId);
 const ring=g.mode==='playing'&&g.phase==='build'&&g.selected&&WEAPONS[g.selected]&&hoverCell?{type:g.selected,x:hoverCell.x,y:hoverCell.y}:focused&&isWeapon(focused)?focused:null;
 if(ring){const spec=WEAPONS[ring.type],cx=(ring.x+.5)*S,cy=(ring.y+.5)*S;
  c.beginPath();c.arc(cx,cy,spec.range*S,0,Math.PI*2);if(spec.minRange){c.moveTo(cx+spec.minRange*S,cy);c.arc(cx,cy,spec.minRange*S,0,Math.PI*2,true);}
  c.fillStyle='rgba(104,196,224,.16)';c.fill('evenodd');c.strokeStyle='#8be4f5';c.lineWidth=2;c.setLineDash([7,5]);c.beginPath();c.arc(cx,cy,spec.range*S,0,Math.PI*2);c.stroke();
  if(spec.minRange){c.strokeStyle='#ffad8b';c.beginPath();c.arc(cx,cy,spec.minRange*S,0,Math.PI*2);c.stroke();}
  c.setLineDash([]);c.font='bold 14px sans-serif';c.textAlign='center';c.fillStyle='#ccf8ff';c.fillText('R '+spec.range+' / Ø '+(spec.range*2).toFixed(1),cx,Math.max(17,cy-spec.range*S-6));
 }
 for(const e of g.enemies){const p=enemyPos(e),x=(p.x+.5)*S,y=(p.y+.5)*S;
  const boss=e.kind==='boss',heavy=e.kind==='heavy',scout=e.kind==='scout',r=boss?23:heavy?18:scout?11:14;
  c.fillStyle=boss?'#ef6f85':heavy?'#ab91dc':scout?'#ffcd72':'#fb8e84';c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();c.fill();
  if(boss){c.lineWidth=3;c.strokeStyle=e.enraged?'#ffbd72':'#ffdce2';c.stroke();c.font='bold 20px sans-serif';c.textAlign='center';c.fillStyle='#351b34';c.fillText('✦',x,y+7);}
  const bar=boss?56:34,offset=boss?35:26;c.fillStyle='#0c1d30';c.fillRect(x-bar/2,y-offset,bar,5);c.fillStyle=e.hp/e.max<.5?'#ff8a6d':'#b9f4aa';c.fillRect(x-bar/2,y-offset,bar*Math.max(0,e.hp/e.max),5);
 }
 for(const s of g.shots){c.strokeStyle=s.mortar?'#e1b5f5':'#ffe8ad';c.globalAlpha=s.life/.15;c.lineWidth=4;c.beginPath();c.moveTo((s.x+.5)*S,(s.y+.5)*S);c.lineTo((s.tx+.5)*S,(s.ty+.5)*S);c.stroke();}c.globalAlpha=1;
 if(g.mode==='playing'&&g.phase==='build'&&g.selected&&g.selected!=='pipe'&&g.selected!=='eraser'){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!buildError(g.selected,x,y)){c.strokeStyle='#f6c581';c.lineWidth=2;c.strokeRect(x*S+4,y*S+4,S-8,S-8);}}
 drawMini();
}
function drawMini(){if(!g)return;const c=mc,wx=mini.width/W,hy=mini.height/H;c.clearRect(0,0,mini.width,mini.height);c.fillStyle='#0c2032';c.fillRect(0,0,mini.width,mini.height);
 for(const p of PATH){c.fillStyle='#3d748c';c.fillRect(p[0]*wx,p[1]*hy,wx,hy);}for(const b of g.buildings){c.fillStyle=isPipe(b)?(pipeTypes().get(b.id)==='metal'?'#dfa863':pipeTypes().get(b.id)==='ammo'?'#6dded4':'#879cae'):{mine:'#f2c281',factory:'#b4abed',turret:'#73ddd6',cannon:'#ff9a86',mortar:'#e1b5f5'}[b.type];c.fillRect(b.x*wx,b.y*hy,Math.max(2,wx-1),Math.max(2,hy-1));}
 for(const e of g.enemies){const p=enemyPos(e);c.fillStyle='#ff7873';c.fillRect(p.x*wx,p.y*hy,3,3);}
 const r=canvas.getBoundingClientRect(),b=boardbox.getBoundingClientRect(),scale=r.width/(W*S);
 c.strokeStyle='#fff5be';c.lineWidth=1.7;c.strokeRect(boardbox.scrollLeft/r.width*mini.width,boardbox.scrollTop/(H*S*scale)*mini.height,Math.min(1,b.width/r.width)*mini.width,Math.min(1,b.height/(H*S*scale))*mini.height);
}
function gridPos(event){const r=canvas.getBoundingClientRect();return{x:Math.floor((event.clientX-r.left)/r.width*W),y:Math.floor((event.clientY-r.top)/r.height*H)};}
function drawAcross(a,b,tool){if(!a||!b)return;let x=a.x,y=a.y,limit=0;
 while(limit++<W+H+5){if(x!==a.x||y!==a.y){if(tool==='eraser')erase(x,y,true);else if(!at(x,y)&&!place('pipe',x,y,true)){inform('Rohr nicht gesetzt: Prüfe Leitungstyp, Baukosten und freie Felder.');break;}}
  if(x===b.x&&y===b.y)break;
  if(x!==b.x)x+=Math.sign(b.x-x);else y+=Math.sign(b.y-y);
 }
 update();
}
function setZoom(value,clientX,clientY){
 const box=boardbox.getBoundingClientRect(),rect=canvas.getBoundingClientRect();
 const px=clientX??box.left+box.width/2,py=clientY??box.top+box.height/2;
 const fx=rect.width?Math.max(0,Math.min(1,(px-rect.left)/rect.width)):.5;
 const fy=rect.height?Math.max(0,Math.min(1,(py-rect.top)/rect.height)):.5;
 zoom=Math.min(maxZoom,Math.max(minZoom,value));
 canvas.style.width=(864*zoom)+'px';
 const newWidth=864*zoom,newHeight=960*zoom;
 boardbox.scrollLeft=fx*newWidth-(px-box.left)+1;
 boardbox.scrollTop=fy*newHeight-(py-box.top)+1;
 drawMini();
}
function pinchDistance(){const a=[...pointerPositions.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
function pinchMid(){const a=[...pointerPositions.values()];return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};}
canvas.addEventListener('pointerdown',e=>{
 if(g.mode!=='playing')return;
 if(g.phase==='build'&&WEAPONS[g.selected])hoverCell=gridPos(e);
 pointerPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(canvas.setPointerCapture){try{canvas.setPointerCapture(e.pointerId);}catch(_){/* synthetic accessibility/test events may lack an active pointer */}}
 if(pointerPositions.size===2){const mid=pinchMid();gesture={mode:'pinch',distance:pinchDistance(),mid};}
 else if(pointerPositions.size===1){gesture={mode:'single',start:{x:e.clientX,y:e.clientY},last:{x:e.clientX,y:e.clientY},startCell:gridPos(e),lastCell:gridPos(e),moved:false,tool:g.selected};}
 e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
 if(g.mode==='playing'&&g.phase==='build'&&WEAPONS[g.selected])hoverCell=gridPos(e);
 if(!pointerPositions.has(e.pointerId)||!gesture)return;
 pointerPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointerPositions.size===2){const d=pinchDistance(),mid=pinchMid();if(gesture.mode!=='pinch'){gesture={mode:'pinch',distance:d,mid};return;}if(gesture.distance>0)setZoom(zoom*d/gesture.distance,mid.x,mid.y);gesture.distance=d;gesture.mid=mid;e.preventDefault();return;}
 if(gesture.mode!=='single')return;
 const dx=e.clientX-gesture.last.x,dy=e.clientY-gesture.last.y;
 if(Math.hypot(e.clientX-gesture.start.x,e.clientY-gesture.start.y)>7)gesture.moved=true;
 if(gesture.tool==='pipe'||gesture.tool==='eraser'){
  if(gesture.moved){const cell=gridPos(e);if(cell.x!==gesture.lastCell.x||cell.y!==gesture.lastCell.y){
   if(gesture.tool==='eraser')erase(gesture.lastCell.x,gesture.lastCell.y,true);else place('pipe',gesture.lastCell.x,gesture.lastCell.y,true);
   drawAcross(gesture.lastCell,cell,gesture.tool);gesture.lastCell=cell;
  }}
 }else if(gesture.moved){boardbox.scrollLeft-=dx;boardbox.scrollTop-=dy;}
 gesture.last={x:e.clientX,y:e.clientY};e.preventDefault();
});
function finishPointer(e){
 if(!pointerPositions.has(e.pointerId))return;
 const old=pointerPositions.size;pointerPositions.delete(e.pointerId);
 if(old===2){gesture=null;return;} // Do not build on finger release after pinch.
 if(old===1&&gesture?.mode==='single'&&g.mode==='playing'){
  const p=gridPos(e),tool=gesture.tool;
  if(!gesture.moved){if(tool==='eraser')erase(p.x,p.y);else if(tool&&at(p.x,p.y))inspect(p.x,p.y);else if(tool)place(tool,p.x,p.y);else inspect(p.x,p.y);}
  else if((tool==='pipe'||tool==='eraser')&&gesture.lastCell){
   if(tool==='eraser')erase(gesture.lastCell.x,gesture.lastCell.y,true);else place('pipe',gesture.lastCell.x,gesture.lastCell.y,true);
   drawAcross(gesture.lastCell,p,tool);
  }
 }
 gesture=null;update();draw();
}
canvas.addEventListener('pointerup',finishPointer);
canvas.addEventListener('pointercancel',e=>{pointerPositions.delete(e.pointerId);gesture=null;});
// Keyboard-generated click for accessibility; genuine pointer events are handled above.
canvas.addEventListener('click',e=>{if(e.detail!==0||g.mode!=='playing')return;const p=gridPos(e);if(g.selected==='eraser')erase(p.x,p.y);else if(g.selected&&!at(p.x,p.y))place(g.selected,p.x,p.y);else inspect(p.x,p.y);});
buildButtons.forEach(b=>b.addEventListener('click',()=>{select(b.dataset.type);activeCategory=null;renderBuildCategory();}));
document.querySelectorAll('.category').forEach(b=>b.addEventListener('click',()=>toggleCategory(b.dataset.category)));
$('dock-toggle').addEventListener('click',()=>{
 if(g.mode!=='playing'||g.phase!=='build')return;
 showBuildTray($('build-tray').hidden);
});
function pause(){if(g.mode!=='playing')return;if(g.phase==='build'){startWave();return;}
 g.paused=!g.paused;inform(g.paused?'Pause: Kampf und Industrie stehen.':'Kampf und Materialfluss laufen weiter.');update();}
$('pause').addEventListener('click',pause);

function goto(x,y){const scale=canvas.getBoundingClientRect().width/(W*S);boardbox.scrollLeft=Math.max(0,(x+.5)*S*scale-boardbox.clientWidth/2);boardbox.scrollTop=Math.max(0,(y+.5)*S*scale-boardbox.clientHeight/2);drawMini();}
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();goto(Math.floor((e.clientX-r.left)/r.width*W),Math.floor((e.clientY-r.top)/r.height*H));});
$('reset').addEventListener('click',()=>{if(currentLevel)startLevel(currentLevel.id);});
$('back-to-campaign').addEventListener('click',showCampaign);
$('difficulty').addEventListener('change',e=>changeDifficulty(e.target.value));
$('difficulty-buttons').addEventListener('click',e=>{const b=e.target.closest('button[data-difficulty]');if(b)changeDifficulty(b.dataset.difficulty);});
$('chapter-tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-chapter]');if(b&&!b.disabled){activeChapter=b.dataset.chapter;renderCampaign();}});
$('level-grid').addEventListener('click',e=>{const b=e.target.closest('button[data-level]');if(b&&!b.disabled)startLevel(b.dataset.level);});
$('start').addEventListener('click',()=>{if(currentLevel)startLevel(currentLevel.id);});
$('result-hub').addEventListener('click',()=>{if(g?.chapterClear){const ix=levelChapter(currentLevel.id);if(CHAPTERS[ix])activeChapter=CHAPTERS[ix].id;}showCampaign();});
$('result-next').addEventListener('click',()=>{if(currentLevel){const next=ALL_LEVELS[ALL_LEVELS.findIndex(l=>l.id===currentLevel.id)+1];if(next)startLevel(next.id);}});
$('settings-open').addEventListener('click',()=>{$('settings-panel').hidden=false;$('theme-choice').value=save.theme;});
$('settings-close').addEventListener('click',()=>{$('settings-panel').hidden=true;});
$('settings-done').addEventListener('click',()=>{$('settings-panel').hidden=true;});
$('theme-choice').addEventListener('change',e=>applyTheme(e.target.value));
$('dev-test-levels').addEventListener('click',()=>{devTestAccess=!devTestAccess;$('dev-test-levels').textContent=devTestAccess?'TESTZUGANG AN · Alle Kapitel geöffnet':'TESTZUGANG · Alle Kapitel öffnen';$('dev-test-levels').setAttribute('aria-pressed',String(devTestAccess));renderCampaign();});
$('tutorial-skip').addEventListener('click',()=>{g.tutorial.active=false;$('tutorial').hidden=true;clearGuideMarks();save.tutorialSeen=true;persist();});
$('details-close').addEventListener('click',hideDetails);
$('waves-toggle').addEventListener('click',()=>{const l=$('wave-list');l.hidden=!l.hidden;$('waves-toggle').setAttribute('aria-expanded',String(!l.hidden));});
$('help').addEventListener('click',()=>{if(g.mode!=='playing'){inform('Starte zuerst das Spiel.');return;}if(g.phase!=='build'){inform('Tutorial ab der nächsten Bauphase verfügbar. Während des Angriffs ist Bauen gesperrt.');return;}g.tutorial.active=true;g.tutorial.stage=0;hideDetails();syncTutorial();inform('Tutorial gestartet. Folge den Hinweisen auf der Karte.');});
document.addEventListener('keydown',e=>{if(e.key==='1')select('turret');if(e.key==='2')select('mine');if(e.key==='3')select('factory');if(e.key==='4')select('pipe');if(e.key==='5')select('bridge');if(e.key==='6'||e.key==='Delete')select('eraser');if(e.key==='Escape'&&g){g.selected=null;update();}if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();pause();}});
document.addEventListener('visibilitychange',()=>{previous=performance.now();acc=0;});

window.ForgefrontDebug={buildId:()=>BUILD_ID,setDifficulty:changeDifficulty,startLevel,showCampaign,levels:()=>ALL_LEVELS.map(l=>({id:l.id,ready:l.ready,unlocked:unlocked(l.id)})),chapters:()=>CHAPTERS.map((ch,i)=>({id:ch.id,unlocked:chapterUnlocked(i),completed:chapterCompleted(ch),reward:ch.reward})),map:()=>({hq:{...HQ},path:PATH.map(p=>[...p]),ore:[...ORE]}),save:()=>JSON.parse(JSON.stringify(save)),score,difficulties:()=>JSON.parse(JSON.stringify(DIFFICULTIES)),pipeMedium:(x,y)=>{const b=at(x,y);return isPipe(b)?pipeTypes().get(b.id):undefined;},snapshot:()=>JSON.parse(JSON.stringify(g)),advance:seconds=>{for(let i=0;i<Math.ceil(seconds*30);i++)simulate(1/30);update();draw();},place:(type,x,y)=>place(type,x,y),erase,select,startWave,routes:(id,kind)=>g.buildings.filter(b=>b.type===(kind==='metal'?'factory':'turret')&&netReachable(g.buildings.find(s=>s.id===id),b)).map(b=>({id:b.id})),goto,paint:(a,b)=>drawAcross(a,b,'pipe'),setZoom,config:()=>JSON.parse(JSON.stringify(ECONOMY)),rates:()=>g.buildings.filter(b=>!isPipe(b)).map(b=>({id:b.id,type:b.type,...productionInfo(b)})),weapons:()=>JSON.parse(JSON.stringify(WEAPONS)),allowedBuilding:buildingAvailable,testAccess:()=>devTestAccess,waves:()=>levelWaves().map((w,i)=>({label:w.label,composition:wavePreview(i),count:w.count,bossHp:w.bossHp||null})),forecast:()=>Array.from(flow(false).infos).map(([id,info])=>({id,...info})),tutorial:()=>JSON.parse(JSON.stringify(g.tutorial)),inspect,visiblePercent:(x,y)=>{const b=at(x,y);return b&&!isPipe(b)?visibleRatio(b,productionInfo(b)):null;},stepDisplay:(seconds=.25)=>{sampleDisplayRatios(seconds);update();draw();}};
function frame(now){
 if(warningExpires&&now>=warningExpires){warningExpires=0;$('gold-warning').hidden=true;$('gold').classList.remove('low-gold');}
 const dt=Math.min(.1,(now-previous)/1000);previous=now;
 if(!document.hidden&&g?.mode==='playing'&&g.phase==='combat'&&!g.paused){
  acc+=dt*speedValues[speedIndex];while(acc>=1/30){simulate(1/30);acc-=1/30;}
  if(g.mode==='playing'&&g.phase==='combat'){
   if(lastDisplayAt===null)lastDisplayAt=now;
   if(now-lastDisplayAt>=DISPLAY_UPDATE_MS){
    sampleDisplayRatios((now-lastDisplayAt)/1000);lastDisplayAt=now;
   }
  }
 }else{acc=0;lastDisplayAt=null;}
 if(g?.phase!=='combat')lastDisplayAt=null;
 update();draw();requestAnimationFrame(frame);
}

$('difficulty').value=selectedDifficulty;applyTheme(save.theme);showCampaign();setZoom((window.innerWidth||900)<700?.7:.82);requestAnimationFrame(frame);
})();
