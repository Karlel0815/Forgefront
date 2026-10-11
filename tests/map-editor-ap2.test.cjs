'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/map-editor.js');
function draft(){
 const s=m.makeState();
 m.paintCell(s,'spawn',3,4);m.paintCell(s,'hq',3,11);
 m.paintLine(s,'path',{x:3,y:5},{x:3,y:10});
 m.paintCell(s,'ore',8,8);
 return s;
}
test('custom route includes start and HQ without mutating the drawing',()=>{
 const s=draft(),before=s.path.size;
 assert.equal(m.validate(s).valid,true);
 const map=m.mapSnapshot(s);
 assert.deepEqual(map.path[0],[3,4]);
 assert.deepEqual(map.path[map.path.length-1],[3,11]);
 assert.equal(map.path.length,8);
 assert.equal(s.path.size,before);
});
test('finger redraw and path deletion make a formerly valid map invalid',()=>{
 const s=draft();assert.equal(m.validate(s).valid,true);
 const sign=m.mapSignature(s);
 m.paintCell(s,'erase',3,8);
 assert.equal(m.mapSignature(s),null);
 m.paintCell(s,'path',3,8);
 assert.equal(m.mapSignature(s),sign);
});
test('snapshot restores only validated drawn maps',()=>{
 const s=draft(),out=m.mapSnapshot(s);
 const again=m.restoreSnapshot(out);
 assert.ok(again);
 assert.equal(m.validate(again).valid,true);
 assert.equal(m.mapSignature(again),m.mapSignature(s));
 assert.equal(m.restoreSnapshot({path:[[0,0],[7,7]],ore:[],hq:{x:7,y:7}}),null);
});
