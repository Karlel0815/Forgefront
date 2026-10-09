(() => {
'use strict';
const W=18,H=20,S=60,MAX_WAVES=6,FIRST_DELAY=10,TRAVEL=.34,DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const ECONOMY={startGold:180,goldPerKill:5,goldPerWave:10,refundByDifficulty:{easy:1,normal:.75,hard:.5},difficulty:'easy'}; // Easy = test mode; difficulty selector later.
const HQ={x:16,y:18};
const PATH=[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[6,4],[6,5],[7,5],[8,5],[9,5],[10,5],[10,6],[10,7],[10,8],[11,8],[12,8],[13,8],[13,9],[13,10],[12,10],[11,10],[11,11],[11,12],[12,12],[13,12],[14,12],[15,12],[15,13],[15,14],[15,15],[16,15],[16,16],[16,17],[16,18]];
const ORE=new Set(['7,14','6,14','7,15','6,15','4,13','3,13','3,12','4,12','2,9','3,9','5,9','9,17','10,17','12,16','13,16','14,5','15,5','15,6','2,5','3,5','15,18','14,18']);
const COST={turret:24,mine:22,factory:18,pipe:4,bridge:10};
const WAVES=[
 {label:'ERSTE PROBE',count:5,hp:12,speed:1.35,interval:1.55,pattern:['normal']},
 {label:'SCHNELLE FEINDE',count:8,hp:15,speed:1.62,interval:1.3,pattern:['normal','normal','scout']},
 {label:'PANZER',count:10,hp:19,speed:1.7,interval:1.18,pattern:['normal','scout','normal','heavy']},
 {label:'GEMISCHTER ANGRIFF',count:12,hp:23,speed:1.8,interval:1.1,pattern:['scout','normal','heavy','normal']},
 {label:'GROSSER SCHWARM',count:15,hp:24,speed:1.92,interval:1.04,pattern:['normal','scout','scout','heavy','normal']},
 {label:'BOSS: EISENBRECHER',count:9,hp:27,speed:1.85,interval:1.7,pattern:['scout','heavy','normal','scout','heavy','scout','heavy','scout','normal'],boss:true}
];
const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d'),boardbox=$('boardbox'),mini=$('minimap'),mc=mini.getContext('2d');
const buildButtons=[...document.querySelectorAll('.build')],speedValues=[1,1.5,2],minZoom=.35,maxZoom=3;
const key=(x,y)=>x+','+y,adj=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
let g,previous=performance.now(),acc=0,speedIndex=0,zoom=1,nextId=1,pointerPositions=new Map(),gesture=null;
function building(type,x,y){return {id:nextId++,type,x,y,clock:0,cool:0,input:0,output:0,events:[],blocked:false,lacking:false};}
function inform(msg){$('hint').textContent=msg;$('status').textContent=msg;}
function overlay(icon,title,description,action){$('o-icon').textContent=icon;$('o-title').textContent=title;$('o-text').textContent=description;$('start').textContent=action;$('overlay').classList.remove('hidden');}
function at(x,y){return g.buildings.find(b=>b.x===x&&b.y===y);}
function isRoad(x,y){return PATH.some(p=>p[0]===x&&p[1]===y);}
function isPipe(b){return !!b&&(b.type==='pipe'||b.type==='bridge');}
function nearby(b){return DIRS.map(d=>at(b.x+d[0],b.y+d[1])).filter(Boolean);}
function reset(){
 nextId=1;speedIndex=0;
 g={mode:'intro',phase:'build',wave:0,paused:false,time:0,enemyDelay:null,gold:ECONOMY.startGold,metal:0,ammo:0,hp:20,kills:0,
  selected:null,buildings:[],packets:[],enemies:[],shots:[],spawner:null,deliveredMetal:0,deliveredAmmo:0,producedMetal:0,producedAmmo:0,shotsFired:0,
  waves:Array.from({length:MAX_WAVES},()=>({started:false,doneSpawning:false,alive:0,paid:false})),goldEarned:0,goldRefunded:0};
 acc=0;pointerPositions.clear();gesture=null;
 $('overlay').classList.remove('hidden');
 $('dock').classList.remove('open');$('build-tray').hidden=true;$('dock-toggle').setAttribute('aria-expanded','false');
 overlay('⬡','DEINE LOGISTIK. DEINE VERTEIDIGUNG.','Baue mit 180 Gold eine funktionierende Versorgung. Während der Bauphasen steht die Industrie still. Fünf Wellen und dann der Boss – schaffst du die Erzfront?','MISSION VORBEREITEN →');
 inform('BAUPHASE: Mine, Fabrik, Rohre und MG verbinden. Erst mit Welle starten beginnen Produktion und Angriff.');update();draw();
}
function buildError(type,x,y){
 if(g.mode!=='playing'||g.phase!=='build')return 'Bauen ist nur zwischen den Wellen erlaubt.';
 if(x<0||y<0||x>=W||y>=H)return 'Außerhalb der Karte.';
 if(at(x,y))return 'Dieses Feld ist bereits belegt.';
 if(type==='bridge'){if(!isRoad(x,y))return 'Eine Brücke kann nur auf dem Gegnerweg stehen.';const q=PATH[PATH.length-1];if(x===q[0]&&y===q[1])return 'HQ-Feld darf nicht überbaut werden.';}
 else if(isRoad(x,y))return 'Hier verläuft der Gegnerweg – nimm eine Brücke.';
 if(type==='mine'&&!ORE.has(key(x,y)))return 'Eine Mine braucht ein Erzfeld.';
 if(type!=='mine'&&ORE.has(key(x,y)))return 'Dieses Erzfeld ist für eine Mine reserviert.';
 if(g.gold<COST[type])return 'Es fehlen '+(COST[type]-g.gold)+' Gold.';
 return null;
}
function payGold(cost){if(g.gold<cost)return false;g.gold-=cost;return true;}
function refundRate(){return ECONOMY.refundByDifficulty[ECONOMY.difficulty];}
function erase(x,y,silent=false){
 if(g.mode!=='playing'||g.phase!=='build'){if(!silent)inform('Abriss ist während einer Angriffswelle gesperrt.');return false;}
 const b=at(x,y);if(!b){if(!silent)inform('Hier steht kein Gebäude.');return false;}
 const occupied=g.packets.some(p=>p.at.id===b.id||p.to?.id===b.id||p.targetId===b.id);
 if(occupied||b.input||b.output){if(!silent)inform('In diesem Bauteil befinden sich noch Rohstoffe oder Pakete. Erst nach dem Abtransport löschen.');return false;}
 g.buildings.splice(g.buildings.indexOf(b),1);
 const refund=Math.floor(COST[b.type]*refundRate());g.gold+=refund;g.goldRefunded+=refund;
 if(!silent)inform('Abgebaut: '+refund+' Gold zurück.');update();return true;
}
function select(type){if(g.mode!=='playing'||g.phase!=='build')return;
 g.selected=g.selected===type?null:type;
 inform(g.selected==='pipe'?'Rohr aktiv: mit Finger über die Karte ziehen.':g.selected==='eraser'?'Radierer aktiv: Zum Entfernen auf Gebäude oder Rohr tippen.':g.selected?'Feld wählen: '+({mine:'Mine braucht Erz.',factory:'Fabrik frei platzieren.',turret:'MG frei platzieren.',bridge:'Brücke auf Gegnerweg bauen.'}[g.selected]||''):'Karte verschieben; mit zwei Fingern zoomen.');
 $('dock').classList.remove('open');$('build-tray').hidden=true;$('dock-toggle').setAttribute('aria-expanded','false');update();
}
function place(type,x,y,silent=false){
 if(g.mode!=='playing'||g.phase!=='build'){if(!silent)inform('Während der Angriffswelle ist Bauen gesperrt.');return false;}
 let desired=type;if(type==='pipe'&&isRoad(x,y))desired='bridge';
 const err=buildError(desired,x,y);if(err){if(!silent)inform(err);return false;}
 if(!payGold(COST[desired]))return false;
 g.buildings.push(building(desired,x,y));if(!silent)inform(desired==='bridge'?'Brücke verbunden.':desired==='pipe'?'Rohr gebaut – automatisch verbunden.':desired==='mine'?'Mine: Für Metalltransport an Fabrik anschließen.':'Gebäude steht – Versorgung über Rohre anschließen.');
 update();return true;
}
function startWave(){
 if(g.mode!=='playing'||g.phase!=='build'||g.wave>=MAX_WAVES)return false;
 g.wave++;g.phase='combat';g.paused=false;g.selected=null;g.enemyDelay=FIRST_DELAY;g.spawner=null;
 g.waves[g.wave-1].started=true;
 $('dock').classList.remove('open');$('build-tray').hidden=true;$('dock-toggle').setAttribute('aria-expanded','false');
 inform((g.wave===MAX_WAVES?'BOSSWELLE':'WELLE '+g.wave)+' läuft an! Produktion startet sofort; erster Gegner in '+FIRST_DELAY+' Sekunden.');update();return true;
}
function checkWaveComplete(){
 const r=g.waves[g.wave-1];if(!r||!r.doneSpawning||r.alive!==0||g.spawner||g.enemyDelay!==null||g.phase!=='combat')return;
 if(!r.paid){r.paid=true;g.gold+=ECONOMY.goldPerWave;g.goldEarned+=ECONOMY.goldPerWave;}
 if(g.wave===MAX_WAVES){finish(true);return;}
 g.phase='build';g.selected=null;g.paused=false;
 inform('Welle '+g.wave+' überstanden! +'+ECONOMY.goldPerWave+' Gold. Industrie pausiert. In Ruhe umbauen, dann Welle '+(g.wave+1)+' starten.');
 update();
}
function enemyPos(e){const i=Math.min(Math.floor(e.pos),PATH.length-2),a=PATH[i],b=PATH[i+1],t=Math.min(1,e.pos-i);return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t};}
function finish(win){g.mode=win?'won':'lost';g.paused=false;
 overlay(win?'★':'⚠',win?'BOSS BESIEGT!':'BASIS VERLOREN',win?'Fünf Wellen und den Boss überstanden! '+g.kills+' Kills · HQ: '+g.hp+' Leben.':'Die Logistikkette hat nicht gehalten. '+g.kills+' Gegner besiegt. Optimier deine Rohrführung und Produktionsraten.','NEUE RUNDE STARTEN');
 inform(win?'Sieg: Erzfront gehalten!':'Niederlage – Beim nächsten Versuch cleverer planen.');update();}
function accepts(b,kind){return b&&(kind==='metal'?b.type==='factory':b.type==='turret');}
function incoming(target,kind){return g.packets.filter(p=>p.targetId===target.id&&p.kind===kind).length;}
function sinkSpace(target,kind){if(kind==='metal')return target.input===0&&target.output===0&&incoming(target,kind)===0;
 return incoming(target,kind)<3;}
// Only pipes and bridges relay materials. Buildings are endpoints, never shortcuts.
function routesFrom(source,kind){
 if(!source)return [];let queue=[{b:source,dist:0,first:null}],head=0,seen=new Set([source.id]),found=[];
 while(head<queue.length){const {b,dist,first}=queue[head++];for(const n of nearby(b)){
  if(accepts(n,kind)&&n.id!==source.id&&sinkSpace(n,kind))found.push({target:n,dist:dist+1,first:first||n});
  else if(isPipe(n)&&!seen.has(n.id)){seen.add(n.id);queue.push({b:n,dist:dist+1,first:first||n});}
 }}return found;
}
function nextToTarget(source,target){if(!source||!target)return null;
 let q=[{b:source,first:null}],head=0,seen=new Set([source.id]);
 while(head<q.length){const {b,first}=q[head++];for(const n of nearby(b)){
  if(n.id===target.id)return first||n;
  if(isPipe(n)&&!seen.has(n.id)){seen.add(n.id);q.push({b:n,first:first||n});}
 }}return null;
}
function chooseRoute(source,kind){const paths=routesFrom(source,kind);if(!paths.length)return null;
 paths.sort((a,b)=>(a.dist+incoming(a.target,kind)*3)-(b.dist+incoming(b.target,kind)*3)||a.target.id-b.target.id);
 return paths[0];
}
function launch(source,kind,amount){if(g.packets.length>=130)return false;
 const route=chooseRoute(source,kind);if(!route)return false;
 // A package must physically leave the producer; never teleport inventory.
 g.packets.push({id:nextId++,sourceId:source.id,kind,amount,at:source,to:route.first,targetId:route.target.id,progress:0});return true;
}
function recordRate(b,amount){b.events.push({t:g.time,amount});if(b.events.length>100)b.events.shift();}
function rate(b){if(g.phase!=='combat')return 0;return b.events.filter(e=>e.t>=g.time-4).reduce((v,e)=>v+e.amount,0)/4;}
function receive(p){const b=p.at;
 if(p.kind==='metal'&&b.type==='factory'&&b.input===0&&b.output===0){b.input=1;g.deliveredMetal+=p.amount;return true;}
 return false; // Ammo remains visible at end of pipe until a turret actually fires.
}
function movePackets(dt){
 for(let i=g.packets.length-1;i>=0;i--){const p=g.packets[i];
  if(p.to){p.progress=Math.min(1,p.progress+dt/TRAVEL);if(p.progress>=1){
   if(p.to.type==='turret'&&p.kind==='ammo')continue; // Wait at the pipe mouth, NOT inside a magazine.
   // Pipes have independent virtual lanes. Output waits at a full destination, not in a junction deadlock.
   if(p.to.type==='factory'&&p.kind==='metal'&&(p.to.input||p.to.output))continue;
   p.at=p.to;p.to=null;p.progress=0;
   if(receive(p)){g.packets.splice(i,1);continue;}
  }}
  if(!p.to){let target=g.buildings.find(b=>b.id===p.targetId);
   if(!target||!accepts(target,p.kind)){
    const path=chooseRoute(p.at,p.kind);if(path){target=path.target;p.targetId=target.id;}else continue;
   }
   let next=nextToTarget(p.at,target);
   if(!next){const reroute=chooseRoute(p.at,p.kind);if(reroute){p.targetId=reroute.target.id;next=reroute.first;}}
   if(next){p.to=next;p.progress=0;}
  }
 }
}
function makePlan(def){const list=[];
 if(def.boss){
  for(let i=0;i<def.count;i++){if(i===4)list.push({kind:'boss',hp:110,speed:.98,armor:0});
   const kind=def.pattern[i]||'normal';list.push({kind,hp:kind==='heavy'?42:kind==='scout'?15:28,speed:kind==='heavy'?1.13:kind==='scout'?2.55:1.8,armor:kind==='heavy'?1:0});}
 }else for(let i=0;i<def.count;i++){
  const kind=def.pattern[i%def.pattern.length];list.push({kind,hp:kind==='heavy'?def.hp*1.4:kind==='scout'?def.hp*.68:def.hp,speed:kind==='heavy'?def.speed*.65:kind==='scout'?def.speed*1.36:def.speed,armor:kind==='heavy'?1:0});}
 return list;
}
function makeTarget(turret){let target=null;for(const e of g.enemies){const p=enemyPos(e);if(Math.hypot(p.x-turret.x,p.y-turret.y)<=3.3&&(!target||e.hp<target.hp||(e.hp===target.hp&&e.pos>target.pos)))target=e;}return target;}
function shoot(turret,target){const packet=g.packets.find(p=>p.kind==='ammo'&&p.targetId===turret.id&&p.to?.id===turret.id&&p.progress>=1&&p.amount>0);
 if(!packet)return false;
 packet.amount-=1;if(packet.amount===0)g.packets.splice(g.packets.indexOf(packet),1);
 const point=enemyPos(target);const damage=Math.max(1,3-(target.armor||0));target.hp-=damage;
 turret.cool=.57;turret.lacking=false;g.shotsFired++;recordRate(turret,1);g.shots.push({x:turret.x,y:turret.y,tx:point.x,ty:point.y,life:.15});
 if(target.kind==='boss'&&target.hp<=target.max*.5&&!target.enraged){target.enraged=true;target.speed*=1.38;target.armor=1;inform('⚠ BOSS-PHASE 2: Eisenbrecher wird schneller und stärker gepanzert!');}
 if(target.hp<=0){g.enemies.splice(g.enemies.indexOf(target),1);g.waves[target.wave-1].alive--;g.kills++;g.gold+=ECONOMY.goldPerKill;g.goldEarned+=ECONOMY.goldPerKill;if(target.kind==='boss')inform('BOSS GESTOPPT! Besiege die letzten Begleitgegner.');}
 return true;
}
function simulate(dt){if(!g||g.mode!=='playing'||g.paused||g.phase!=='combat')return;
 g.time+=dt;
 for(const b of g.buildings){
  if(b.type==='mine'){b.clock=Math.min(1.02,b.clock+dt);if(b.clock>=1){
   if(launch(b,'metal',1)){b.clock-=1;b.blocked=false;g.producedMetal++;recordRate(b,1);}else{b.clock=1;b.blocked=true;}
  }}
  if(b.type==='factory'){
   if(b.output){if(launch(b,'ammo',b.output)){g.producedAmmo+=b.output;recordRate(b,b.output);b.output=0;b.blocked=false;}else b.blocked=true;}
   if(b.input){b.clock+=dt;if(b.clock>=2.5){b.input=0;b.clock=0;b.output=3;}}
   else if(!b.output){b.clock=0;b.blocked=false;}
  }
 }
 movePackets(dt);
 if(g.enemyDelay!==null){g.enemyDelay-=dt;if(g.enemyDelay<=0){g.enemyDelay=null;const def=WAVES[g.wave-1];g.spawner={plan:makePlan(def),index:0,timer:0,interval:def.interval};inform((def.boss?'BOSSANGRIFF':'Welle '+g.wave)+' hat begonnen! Das Netz muss jetzt halten.');}}
 if(g.spawner){const sp=g.spawner;sp.timer-=dt;
  if(sp.index<sp.plan.length&&sp.timer<=0){const unit=sp.plan[sp.index++];const e={id:nextId++,pos:0,hp:unit.hp,max:unit.hp,speed:unit.speed,armor:unit.armor,kind:unit.kind,wave:g.wave,enraged:false};g.enemies.push(e);g.waves[g.wave-1].alive++;sp.timer+=sp.interval;}
  if(sp.index===sp.plan.length){g.waves[g.wave-1].doneSpawning=true;g.spawner=null;}
 }
 for(let i=g.enemies.length-1;i>=0;i--){const e=g.enemies[i];e.pos+=e.speed*dt;
  if(e.pos>=PATH.length-1){g.enemies.splice(i,1);g.waves[e.wave-1].alive--;g.hp=Math.max(0,g.hp-(e.kind==='boss'?6:e.kind==='heavy'?2:1));}}
 if(g.hp<=0){finish(false);return;}
 for(const b of g.buildings){if(b.type!=='turret')continue;b.cool=Math.max(0,b.cool-dt);const target=makeTarget(b);b.lacking=false;
  if(b.cool<=0&&target){if(!shoot(b,target))b.lacking=true;}
 }
 for(const q of g.shots)q.life-=dt;g.shots=g.shots.filter(q=>q.life>0);
 checkWaveComplete();
}
function update(){if(!g)return;
 $('gold').textContent=g.gold;$('metal').textContent=g.packets.filter(p=>p.kind==='metal').reduce((n,p)=>n+p.amount,0)+g.buildings.reduce((n,b)=>n+b.input,0);
 $('ammo').textContent=g.packets.filter(p=>p.kind==='ammo').reduce((n,p)=>n+p.amount,0)+g.buildings.reduce((n,b)=>n+b.output,0);
 g.metal=Number($('metal').textContent);g.ammo=Number($('ammo').textContent);
 $('hp').textContent=g.hp;$('wave').textContent=g.wave+'/'+MAX_WAVES;
 const build=g.phase==='build';$('phase-label').textContent=build?'BAUPHASE':'KAMPFPHASE';$('phase-label').classList.toggle('combat',!build);
 $('indicator').textContent=g.mode!=='playing'?'Bereit':build?'Produktion pausiert':g.paused?'Ⅱ PAUSE':g.enemyDelay!==null?'Gegner in '+Math.max(0,Math.ceil(g.enemyDelay))+'s':'Verteidigung läuft';
 $('threat').textContent=g.wave===MAX_WAVES?'⚠ BOSS':g.wave===MAX_WAVES-1?'BOSS ALS NÄCHSTES':'5 WELLEN + BOSS';
 $('pause').disabled=g.mode!=='playing';$('pause').textContent=build?'▶ '+(g.wave===MAX_WAVES-1?'BOSS STARTEN':'WELLE '+(g.wave+1)+' STARTEN'):g.paused?'▶ FORTSETZEN':'Ⅱ PAUSE';
 $('speed').textContent=speedValues[speedIndex]+'×';
 $('dock-label').textContent=build?'BAUEN':'BAUEN GESPERRT';$('selection-label').textContent=build?(g.selected?({turret:'MG',mine:'Mine',factory:'Fabrik',pipe:'Rohr',bridge:'Brücke',eraser:'Radierer'}[g.selected]+' gewählt'):'Menü öffnen'):'Angriff läuft';
 $('dock-toggle').disabled=g.mode!=='playing'||!build;
 for(const b of buildButtons){b.disabled=g.mode!=='playing'||!build;b.classList.toggle('selected',g.selected===b.dataset.type);b.setAttribute('aria-pressed',String(g.selected===b.dataset.type));}
}
function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function draw(){if(!g)return;const c=ctx;c.clearRect(0,0,W*S,H*S);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  c.fillStyle=(x+y)%2?'#102238':'#142a41';c.fillRect(x*S,y*S,S,S);c.strokeStyle='#2a4054';c.lineWidth=1;c.strokeRect(x*S+.5,y*S+.5,S-1,S-1);
  if(ORE.has(key(x,y))&&!at(x,y)){c.fillStyle='#815c37';c.beginPath();c.moveTo(x*S+30,y*S+9);c.lineTo(x*S+47,y*S+30);c.lineTo(x*S+30,y*S+47);c.lineTo(x*S+11,y*S+30);c.closePath();c.fill();c.fillStyle='#f1c480';c.fillRect(x*S+25,y*S+24,10,11);}
 }
 for(const p of PATH){c.fillStyle='#2c576d';c.fillRect(p[0]*S+1,p[1]*S+1,S-2,S-2);}
 c.strokeStyle='#9dcbd9';c.globalAlpha=.32;c.lineWidth=2;c.setLineDash([7,7]);c.beginPath();PATH.forEach((p,i)=>i?c.lineTo((p[0]+.5)*S,(p[1]+.5)*S):c.moveTo((p[0]+.5)*S,(p[1]+.5)*S));c.stroke();c.setLineDash([]);c.globalAlpha=1;
 // Connected pipes draw from their center toward each neighboring pipe or building: automatic elbows and junctions.
 for(const b of g.buildings){if(!isPipe(b))continue;const x=(b.x+.5)*S,y=(b.y+.5)*S;
  c.strokeStyle=b.type==='bridge'?'#e6bd84':'#6dded4';c.lineWidth=12;c.lineCap='round';
  for(const d of DIRS){const n=at(b.x+d[0],b.y+d[1]);if(!n)continue;c.beginPath();c.moveTo(x,y);c.lineTo(x+d[0]*S/2,y+d[1]*S/2);c.stroke();}
  c.fillStyle=b.type==='bridge'?'#edca8e':'#83eae0';c.beginPath();c.arc(x,y,7,0,7);c.fill();
  if(b.type==='bridge'){c.strokeStyle='#e8b16d';c.lineWidth=2;c.strokeRect(b.x*S+8,b.y*S+8,44,44);}
 }
 for(const b of g.buildings){if(isPipe(b))continue;const x=b.x*S,y=b.y*S,color=b.type==='mine'?'#f3bf75':b.type==='factory'?'#b6b0f5':'#79e6dc';
  c.fillStyle='#091e2e';rounded(x+7,y+7,46,46,8);c.fill();c.strokeStyle=color;c.lineWidth=3;c.stroke();c.fillStyle=color;c.textAlign='center';c.font='bold 29px sans-serif';
  if(b.type==='mine')c.fillText('◆',x+30,y+39);
  else if(b.type==='factory')c.fillText('⚙',x+30,y+39);
  else{c.beginPath();c.arc(x+30,y+29,12,0,7);c.fill();c.strokeStyle='#d6fff5';c.lineWidth=6;c.beginPath();c.moveTo(x+30,y+29);c.lineTo(x+30,y+12);c.stroke();}
  const val=rate(b),sign=b.type==='turret'?'−':'+';
  const active=g.mode==='playing'&&g.phase==='combat';
  const hasTarget=b.type==='turret'?!!makeTarget(b):false;
  const rateColor=!active?'#a6b6c2':b.type==='turret'&&!hasTarget?'#acbbc6':(b.lacking||b.blocked)?'#ff8a81':val>0?'#92e5a7':'#f0bd6f';
  const txt=sign+val.toFixed(1)+'/s';c.font='bold 11px system-ui,sans-serif';c.textAlign='center';
  c.fillStyle='#091727';rounded(x+5,y+46,50,15,4);c.fill();c.strokeStyle=rateColor;c.lineWidth=1;c.stroke();c.fillStyle=rateColor;c.fillText(txt,x+30,y+57);
 }
 const hq=[HQ.x,HQ.y];c.fillStyle='#195768';rounded(hq[0]*S+5,hq[1]*S+5,50,50,8);c.fill();c.strokeStyle='#a4e9df';c.lineWidth=3;c.stroke();c.textAlign='center';c.fillStyle='#f0ffff';c.font='bold 15px sans-serif';c.fillText('HQ',hq[0]*S+30,hq[1]*S+36);
 for(const p of g.packets){const a=p.at,b=p.to||p.at,t=p.to?p.progress:0,x=(a.x+(b.x-a.x)*t+.5)*S,y=(a.y+(b.y-a.y)*t+.5)*S;
  if(p.kind==='metal'){c.fillStyle='#ffd18a';rounded(x-6,y-6,12,12,2);c.fill();}else{c.fillStyle='#80f2ed';c.beginPath();c.moveTo(x,y-8);c.lineTo(x+8,y);c.lineTo(x,y+8);c.lineTo(x-8,y);c.closePath();c.fill();}}
 for(const e of g.enemies){const p=enemyPos(e),x=(p.x+.5)*S,y=(p.y+.5)*S;
  const boss=e.kind==='boss',heavy=e.kind==='heavy',scout=e.kind==='scout',r=boss?23:heavy?18:scout?11:14;
  c.fillStyle=boss?'#ef6f85':heavy?'#ab91dc':scout?'#ffcd72':'#fb8e84';c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();c.fill();
  if(boss){c.lineWidth=3;c.strokeStyle=e.enraged?'#ffbd72':'#ffdce2';c.stroke();c.font='bold 20px sans-serif';c.textAlign='center';c.fillStyle='#351b34';c.fillText('✦',x,y+7);}
  const bar=boss?56:34,offset=boss?35:26;c.fillStyle='#0c1d30';c.fillRect(x-bar/2,y-offset,bar,5);c.fillStyle=e.hp/e.max<.5?'#ff8a6d':'#b9f4aa';c.fillRect(x-bar/2,y-offset,bar*Math.max(0,e.hp/e.max),5);
 }
 for(const s of g.shots){c.strokeStyle='#ffe8ad';c.globalAlpha=s.life/.15;c.lineWidth=4;c.beginPath();c.moveTo((s.x+.5)*S,(s.y+.5)*S);c.lineTo((s.tx+.5)*S,(s.ty+.5)*S);c.stroke();}c.globalAlpha=1;
 if(g.mode==='playing'&&g.phase==='build'&&g.selected&&g.selected!=='pipe'&&g.selected!=='eraser'){for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!buildError(g.selected,x,y)){c.strokeStyle='#f6c581';c.lineWidth=2;c.strokeRect(x*S+4,y*S+4,S-8,S-8);}}
 drawMini();
}
function drawMini(){const c=mc,wx=mini.width/W,hy=mini.height/H;c.clearRect(0,0,mini.width,mini.height);c.fillStyle='#0c2032';c.fillRect(0,0,mini.width,mini.height);
 for(const p of PATH){c.fillStyle='#3d748c';c.fillRect(p[0]*wx,p[1]*hy,wx,hy);}for(const b of g.buildings){c.fillStyle={mine:'#f2c281',factory:'#b4abed',turret:'#73ddd6',pipe:'#6db4ad',bridge:'#ebc27f'}[b.type];c.fillRect(b.x*wx,b.y*hy,Math.max(2,wx-1),Math.max(2,hy-1));}
 for(const e of g.enemies){const p=enemyPos(e);c.fillStyle='#ff7873';c.fillRect(p.x*wx,p.y*hy,3,3);}
 const r=canvas.getBoundingClientRect(),b=boardbox.getBoundingClientRect(),scale=r.width/(W*S);
 c.strokeStyle='#fff5be';c.lineWidth=1.7;c.strokeRect(boardbox.scrollLeft/r.width*mini.width,boardbox.scrollTop/(H*S*scale)*mini.height,Math.min(1,b.width/r.width)*mini.width,Math.min(1,b.height/(H*S*scale))*mini.height);
}
function gridPos(event){const r=canvas.getBoundingClientRect();return{x:Math.floor((event.clientX-r.left)/r.width*W),y:Math.floor((event.clientY-r.top)/r.height*H)};}
function drawAcross(a,b,tool){if(!a||!b)return;let x=a.x,y=a.y,limit=0;
 while(limit++<W+H+5){if(x!==a.x||y!==a.y){if(tool==='eraser')erase(x,y,true);else place('pipe',x,y,true);}
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
 pointerPositions.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(canvas.setPointerCapture){try{canvas.setPointerCapture(e.pointerId);}catch(_){/* synthetic accessibility/test events may lack an active pointer */}}
 if(pointerPositions.size===2){const mid=pinchMid();gesture={mode:'pinch',distance:pinchDistance(),mid};}
 else if(pointerPositions.size===1){gesture={mode:'single',start:{x:e.clientX,y:e.clientY},last:{x:e.clientX,y:e.clientY},startCell:gridPos(e),lastCell:gridPos(e),moved:false,tool:g.selected};}
 e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
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
  if(!gesture.moved){if(tool==='eraser')erase(p.x,p.y);else if(tool)place(tool,p.x,p.y);}
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
canvas.addEventListener('click',e=>{if(e.detail!==0||g.mode!=='playing')return;const p=gridPos(e);if(g.selected==='eraser')erase(p.x,p.y);else if(g.selected)place(g.selected,p.x,p.y);});
buildButtons.forEach(b=>b.addEventListener('click',()=>select(b.dataset.type)));
$('dock-toggle').addEventListener('click',()=>{
 if(g.mode!=='playing'||g.phase!=='build')return;
 const tray=$('build-tray'),open=tray.hidden;tray.hidden=!open;
 $('dock').classList.toggle('open',open);$('dock-toggle').setAttribute('aria-expanded',String(open));
});
function pause(){if(g.mode!=='playing')return;if(g.phase==='build'){startWave();return;}
 g.paused=!g.paused;inform(g.paused?'Pause: Kampf und Industrie stehen.':'Kampf und Materialfluss laufen weiter.');update();}
$('pause').addEventListener('click',pause);
$('speed').addEventListener('click',()=>{speedIndex=(speedIndex+1)%speedValues.length;update();});
function goto(x,y){const scale=canvas.getBoundingClientRect().width/(W*S);boardbox.scrollLeft=Math.max(0,(x+.5)*S*scale-boardbox.clientWidth/2);boardbox.scrollTop=Math.max(0,(y+.5)*S*scale-boardbox.clientHeight/2);drawMini();}
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();goto(Math.floor((e.clientX-r.left)/r.width*W),Math.floor((e.clientY-r.top)/r.height*H));});
$('reset').addEventListener('click',()=>{reset();goto(8,10);});
$('start').addEventListener('click',()=>{if(g.mode==='intro'){g.mode='playing';$('overlay').classList.add('hidden');inform('BAUPHASE: 180 Gold Startkapital, keine Produktion bis du Welle 1 startest.');update();goto(8,10);}else reset();});
document.addEventListener('keydown',e=>{if(e.key==='1')select('turret');if(e.key==='2')select('mine');if(e.key==='3')select('factory');if(e.key==='4')select('pipe');if(e.key==='5')select('bridge');if(e.key==='6'||e.key==='Delete')select('eraser');if(e.key==='Escape'){g.selected=null;update();}if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();pause();}});
document.addEventListener('visibilitychange',()=>{previous=performance.now();acc=0;});

window.ForgefrontDebug={snapshot:()=>JSON.parse(JSON.stringify(g)),advance:seconds=>{for(let i=0;i<Math.ceil(seconds*30);i++)simulate(1/30);update();draw();},place:(type,x,y)=>place(type,x,y),erase,select,startWave,routes:(id,kind)=>routesFrom(g.buildings.find(b=>b.id===id),kind).map(p=>({id:p.target.id,distance:p.dist})),goto,paint:(a,b)=>drawAcross(a,b,'pipe'),setZoom,config:()=>JSON.parse(JSON.stringify(ECONOMY)),rates:()=>g.buildings.map(b=>({id:b.id,type:b.type,rate:rate(b)}))};
function frame(now){const dt=Math.min(.1,(now-previous)/1000);previous=now;if(!document.hidden&&g?.mode==='playing'&&g.phase==='combat'&&!g.paused){acc+=dt*speedValues[speedIndex];while(acc>=1/30){simulate(1/30);acc-=1/30;}}else acc=0;update();draw();requestAnimationFrame(frame);}

reset();setZoom((window.innerWidth||900)<700?.7:.82);requestAnimationFrame(frame);
})();

