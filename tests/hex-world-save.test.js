import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexWorld,createHexWorldStore,validateHexWorld} from '../src/hex-world.js';

test('mixed terrain, buildings and shared edges survive JSON roundtrip',()=>{
  const store=createHexWorldStore(createHexWorld(2,'wasteland'));
  assert.equal(store.setTerrain(0,0,'meadow'),true);
  assert.equal(store.setTerrain(1,0,'meadow'),true);
  assert.equal(store.setBuilding(0,0,'sample-building'),true);
  assert.equal(store.setEdge(0,0,0,'road'),true);
  const saved=JSON.stringify(store.snapshot());
  const restored=createHexWorldStore(createHexWorld(0));
  restored.replace(saved);
  assert.deepEqual(restored.snapshot(),JSON.parse(saved));
  assert.equal(restored.readCell(0,0).terrain,'meadow');
  assert.equal(restored.readCell(0,0).building,'sample-building');
});
test('invalid imports leave existing world and revision unchanged',()=>{
  const store=createHexWorldStore(createHexWorld(2));
  store.setTerrain(0,0,'meadow');
  const before=store.snapshot(),revision=store.revision;
  for(const raw of ['{broken',JSON.stringify({...before,version:999}),JSON.stringify({...before,cells:before.cells.slice(1)}),JSON.stringify({...before,cells:before.cells.map((c,i)=>i===0?{...c,terrain:'forbidden'}:c)})]){
    assert.throws(()=>store.replace(raw));
    assert.deepEqual(store.snapshot(),before);
    assert.equal(store.revision,revision);
  }
});
test('world save contains all cells at 217 tile radius',()=>{
  const store=createHexWorldStore(createHexWorld(8));
  assert.equal(store.snapshot().cells.length,217);
  const raw=JSON.stringify(store.snapshot());
  assert.equal(validateHexWorld(JSON.parse(raw)),true);
  const second=createHexWorldStore();
  second.replace(raw);
  assert.deepEqual(second.snapshot(),store.snapshot());
});
