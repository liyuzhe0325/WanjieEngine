import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,cell,setCell,validateWorld,history} from '../src/world.js';
test('cell lookup refuses fractional, nonfinite and out-of-range coordinates',()=>{
 const w=createWorld();
 for(const [x,z] of [[1.5,2],[2,1.5],[NaN,2],[Infinity,0],[-1,0],[24,0]])assert.equal(cell(w,x,z),null);
 assert.equal(cell(w,1,2)?.x,1);
});
test('patch rejects identity moves and unknown fields without any mutation',()=>{
 const w=createWorld(),before=JSON.stringify(w);
 for(const patch of [{x:9},{z:9},{extra:1},{road:'yes'},{structure:'palace'},{height:Infinity},{type:'void'},null]){
  assert.throws(()=>setCell(w,1,2,patch));
  assert.equal(JSON.stringify(w),before);
 }
 assert.equal(validateWorld(w),true);
});
test('normal editing and undo/redo preserve model identity',()=>{
 const w=createWorld(),h=history(w),initial={...cell(w,1,2)};
 h.apply(1,2,'castle');
 assert.equal(cell(w,1,2).structure,'castle');
 h.undo();assert.deepEqual(cell(w,1,2),initial);
 h.redo();assert.equal(cell(w,1,2).structure,'castle');
 assert.equal(validateWorld(w),true);
});

test('rejects shuffled array slots even when coordinates remain unique',()=>{
 const w=createWorld(),first=w.cells[0],second=w.cells[1];
 [w.cells[0],w.cells[1]]=[second,first];
 assert.throws(()=>validateWorld(w),/Cell index mismatch/);
});
