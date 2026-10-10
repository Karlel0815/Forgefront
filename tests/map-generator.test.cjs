'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),os=require('node:os');
const G=require('../tools/map-generator.cjs');
const example=[
  'const BASE_PATH=[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[16,4]];',
  "const BASE_ORE=new Set(['4,8']);",
  "const MAP_BLUEPRINTS=[{name:'a',path:BASE_PATH,ore:[...BASE_ORE],hq:{x:16,y:4}},{name:'b',path:BASE_PATH,ore:[...BASE_ORE],hq:{x:16,y:4}},{name:'c',path:BASE_PATH,ore:[...BASE_ORE],hq:{x:16,y:4}}];",
  'const CHAPTERS=[];'
].join('\n');
const fixture=G.extractBlueprints(example)[0];
test('P0 parses all 3 templates, converts ore strings and rejects changed anchors',()=>{
  assert.equal(G.extractBlueprints(example).length,3);
  assert.deepEqual(fixture.ore,[[4,8]]);
  assert.throws(()=>G.extractBlueprints('const x=1'),/anchors/);
});
test('P0 map legality: road steps, no overlaps, valid HQ',()=>{
  assert.deepEqual(G.validateMap(fixture),[]);
  assert.ok(G.validateMap({...fixture,path:[[0,3],[2,3]]}).some(s=>s.includes('jump')));
  assert.ok(G.validateMap({...fixture,path:[[0,3],[1,3],[0,3]]}).some(s=>s.includes('revisits')));
  assert.ok(G.validateMap({...fixture,ore:[[0,3]]}).some(s=>s.includes('overlaps')));
  assert.ok(G.validateMap({...fixture,hq:{x:2,y:2}}).some(s=>s.includes('HQ')));
});
test('P0 connected legal MG start, no pipe mixing, no imaginary connectivity',()=>{
  const start=[{type:'mine',x:4,y:8},{type:'factory',x:4,y:7},{type:'turret',x:5,y:7}];
  assert.deepEqual(G.validateStartPlan(fixture,start),{valid:true,errors:[],cost:64});
  assert.ok(G.validateStartPlan(fixture,[...start,{type:'pipe',x:5,y:8}]).errors.includes('metal/ammo pipe conflict'));
  assert.ok(G.validateStartPlan(fixture,[{type:'mine',x:4,y:8},{type:'factory',x:6,y:7},{type:'turret',x:9,y:7}]).errors.some(s=>s.includes('disconnected')));
  assert.ok(G.validateStartPlan(fixture,[...start,{type:'pipe',x:4,y:8}]).errors.includes('other building on ore'));
});
test('P0 seed ore is reproducible and legal for all known routes',()=>{
  for(const m of G.extractBlueprints(example)){
    const a=G.generateOre(m,991,'split'),b=G.generateOre(m,991,'split');
    assert.deepEqual(a,b);assert.ok(a.length>=12);
    assert.deepEqual(G.validateMap({...m,ore:a}),[]);
  }
});
test('P0 candidate never claims a simulation win or calibrated difficulty',()=>{
  const m=G.candidate(fixture,8471,'front','fixture-hash');
  assert.equal(m.engineResult,'NOT_TESTED');assert.equal(m.difficulty,'NOT_CALIBRATED');
  assert.match(m.mapHash,/^[a-f0-9]{64}$/);
});
test('P0 CLI produces reproducible JSON and internal review, does not alter game',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forgefront-maps-'));
  try{
    const game=path.join(tmp,'game.js');fs.writeFileSync(game,example);
    const options={game,out:path.join(tmp,'out'),seed:123,count:4,silent:true};
    const first=G.run(options);assert.equal(first.maps.length,4);
    const json=fs.readFileSync(path.join(options.out,'candidates.json'),'utf8');
    assert.equal(G.run(options).result.generated,4);
    assert.equal(fs.readFileSync(path.join(options.out,'candidates.json'),'utf8'),json);
    assert.match(fs.readFileSync(path.join(options.out,'review.html'),'utf8'),/Kein Wellen-\/Boss-Test/);
    assert.equal(fs.readFileSync(game,'utf8'),example);
    assert.throws(()=>G.run({...options,count:101}),/Invalid/);
    assert.throws(()=>G.parseArgs(['--something','x']),/Unknown/);
  }finally{fs.rmSync(tmp,{force:true,recursive:true});}
});
test('P0 real shipped map constants support legal seeded layouts (no engine victory claim)',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/game.js'),'utf8');
  for(const m of G.extractBlueprints(source)){
    assert.deepEqual(G.validateMap(m),[]);
    const candidate=G.candidate(m,52741+m.routeId*1013,'split','real-code');
    assert.deepEqual(G.validateMap(candidate),[]);
    for(const p of candidate.analysis.plans)assert.equal(G.validateStartPlan(candidate,p.buildings).valid,true);
  }
});
