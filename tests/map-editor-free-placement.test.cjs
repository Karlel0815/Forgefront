'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../src/map-editor.js');
test('start and target are freely placeable',()=>{const s=m.makeState();m.paintCell(s,'spawn',3,4);m.paintCell(s,'hq',3,11);m.paintLine(s,'path',{x:3,y:4},{x:3,y:11});m.paintCell(s,'ore',7,7);assert.equal(m.validate(s).valid,true);});
