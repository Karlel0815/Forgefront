'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { WIDTH, HEIGHT, makeState, cloneState, paintCell, paintLine, validate } = require('../src/map-editor.js');
const key=(x,y)=>x+','+y;
function completeMap() {
  const s=makeState();
  paintLine(s,'path',{x:0,y:3},{x:16,y:3});
  paintLine(s,'path',{x:16,y:3},{x:16,y:18});
  paintCell(s,'ore',5,8);
  paintCell(s,'spawn',0,3);
  paintCell(s,'hq',16,18);
  return s;
}
test('AP1 uses the unchanged 18 x 20 Forgefront raster',()=>{
  assert.equal(WIDTH,18);
  assert.equal(HEIGHT,20);
  assert.equal(makeState().spawn,null);
  assert.equal(makeState().hq,null);
});
test('complete nonbranching route with ore passes technical validation',()=>{
  const s=completeMap();
  assert.equal(validate(s).valid,true);
});
test('no gap when finger moves diagonally across multiple tiles',()=>{
  const s=makeState();
  assert.equal(paintLine(s,'path',{x:0,y:3},{x:2,y:5}),true);
  for(const p of [[0,3],[1,3],[1,4],[2,4],[2,5]]) assert.ok(s.path.has(key(...p)));
});
test('eraser removes individual road and ore fields; an undo snapshot restores them',()=>{
  const s=completeMap(), before=cloneState(s);
  assert.equal(paintCell(s,'erase',10,3),true);
  assert.equal(validate(s).valid,false);
  assert.equal(paintCell(s,'erase',5,8),true);
  assert.ok(!s.ore.has('5,8'));
  assert.ok(before.path.has('10,3'));
  assert.ok(before.ore.has('5,8'));
  assert.equal(validate(before).valid,true);
});
test('brush eraser works on dragged segments, without deleting unrelated cells',()=>{
  const s=completeMap();
  assert.equal(paintLine(s,'erase',{x:5,y:3},{x:7,y:3}),true);
  for(const x of [5,6,7]) assert.ok(!s.path.has(key(x,3)));
  assert.ok(s.path.has('8,3'));
  assert.ok(s.ore.has('5,8'));
});
test('unwanted branches and loops cannot be validated',()=>{
  const a=completeMap();
  paintCell(a,'path',4,4);
  assert.equal(validate(a).valid,false);
  const b=completeMap();
  paintCell(b,'path',15,4);
  assert.equal(validate(b).valid,false);
});
test('start and goal are chosen by creator, never overlapping',()=>{
  const s=completeMap();
  assert.equal(paintCell(s,'hq',0,3),false);
  assert.equal(paintCell(s,'spawn',5,8),false);
  assert.equal(paintCell(s,'ore',0,3),false);
  assert.equal(paintCell(s,'ore',16,18),false);
  assert.equal(paintCell(s,'ore',3,3),false);
  assert.equal(paintCell(s,'path',5,8),false);
  assert.equal(validate(s).valid,true);
});
test('route missing HQ and empty ore are both rejected',()=>{
  const a=makeState();
  paintLine(a,'path',{x:0,y:3},{x:10,y:3});
  paintCell(a,'ore',3,9);
  paintCell(a,'spawn',0,3);
  assert.match(validate(a).message,/HQ/);
  const b=completeMap();
  b.ore.clear();
  assert.match(validate(b).message,/Erz/);
});
test('out-of-range editor taps cannot change state',()=>{
  const s=makeState();
  assert.equal(paintCell(s,'path',-1,0),false);
  assert.equal(paintCell(s,'ore',18,19),false);
  assert.equal(paintCell(s,'erase',0,20),false);
  assert.equal(s.path.size,0);
  assert.equal(s.ore.size,0);
});
