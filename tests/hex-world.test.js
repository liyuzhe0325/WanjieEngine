import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexWorld,createHexWorldStore,validateHexWorld,hexCell} from '../src/hex-world.js';
test('hex world uses axial coordinates and exact disk sizes',()=>{
 for(const [r,n] of [[0,1],[2,19],[8,217]]){
  const w=createHexWorld(r);assert.equal(w.cells.length,n);assert.equal(validateHexWorld(w),true);
  assert.ok(hexCell(w,0,0));assert.equal(hexCell(w,r+1,0),null);
 }
});
test('one shared edge across opposite directions',()=>{
 const s=createHexWorldStore();assert.equal(s.setEdge(0,0,0,'road'),true);
 assert.equal(s.readEdge(1,0,3),'road');assert.equal(Object.keys(s.snapshot().edges).length,1);
 assert.equal(s.setEdge(1,0,3,'river'),true);assert.equal(s.readEdge(0,0,0),'river');
 assert.equal(s.setEdge(0,0,0,null),true);assert.equal(s.readEdge(1,0,3),null);
});
test('outside world and invalid edits never increment revision',()=>{
 const s=createHexWorldStore();const before=s.snapshot();
 assert.equal(s.setTerrain(40,0,'meadow'),false);assert.equal(s.setEdge(2,0,0,'road'),false);
 assert.throws(()=>s.setTerrain(0,0,'unknown'));assert.throws(()=>s.setEdge(0,0,0,'bogus'));
 assert.equal(s.revision,0);assert.deepEqual(s.snapshot(),before);
});
test('store detaches input and output and survives JSON roundtrip',()=>{
 const world=createHexWorld(),s=createHexWorldStore(world);
 world.cells[0].terrain='meadow';assert.equal(s.snapshot().cells[0].terrain,'wasteland');
 const snapshot=s.snapshot();snapshot.cells[0].terrain='meadow';assert.equal(s.snapshot().cells[0].terrain,'wasteland');
 assert.equal(s.setBuilding(0,0,'tower'),true);
 const raw=JSON.stringify(s.snapshot());const s2=createHexWorldStore(JSON.parse(raw));
 assert.deepEqual(s2.snapshot(),s.snapshot());
 const modified=s.snapshot();modified.cells.push({...modified.cells[0]});assert.throws(()=>s.replace(modified));
 assert.equal(s.revision,1);
});
test('reject forged edge and duplicate cells',()=>{
 const a=createHexWorld();a.edges['0,0|99,99']='road';assert.throws(()=>validateHexWorld(a));
 const b=createHexWorld();b.cells[1]={...b.cells[0]};assert.throws(()=>validateHexWorld(b));
});
