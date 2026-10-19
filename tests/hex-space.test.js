import test from 'node:test';
import assert from 'node:assert/strict';
import {hexDisk,hexPosition,hexNeighbor,hexDistance,hexKey} from '../src/hex-space.js';
test('disk counts and legacy coordinates are preserved',()=>{
 for(const [radius,count] of [[0,1],[2,19],[3,37],[5,91],[8,217]]){
  const disk=hexDisk(radius);
  assert.equal(disk.length,count);
  assert.equal(new Set(disk.map(t=>hexKey(t.q,t.r))).size,count);
  for(const t of disk){assert.deepEqual({x:t.x,z:t.z},hexPosition(t.q,t.r));assert.ok(hexDistance(t,{q:0,r:0})<=radius);}
 }
 assert.deepEqual(hexPosition(1,-1),{x:1.42,z:-0.823});
});
test('all six directions are adjacent and reversible',()=>{
 for(let d=0;d<6;d++){
  const target=hexNeighbor(2,-3,d);
  assert.equal(hexDistance({q:2,r:-3},target),1);
  assert.deepEqual(hexNeighbor(target.q,target.r,(d+3)%6),{q:2,r:-3});
 }
});
test('invalid radius and coordinates fail fast',()=>{
 for(const r of [-1,0.5,Infinity,NaN,257])assert.throws(()=>hexDisk(r));
 assert.throws(()=>hexPosition(0.5,0));
 assert.throws(()=>hexNeighbor(0,0,6));
});
