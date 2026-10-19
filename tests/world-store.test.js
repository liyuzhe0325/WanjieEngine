import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,cell} from '../src/world.js';
import {createWorldStore} from '../src/world-store.js';
test('inputs and snapshots cannot mutate owned state',()=>{
 const initial=createWorld(),store=createWorldStore(initial);
 const original=store.readCell(1,1).type;
 initial.cells[25].type='blight';
 const snapshot=store.snapshot();snapshot.cells[25].type='blight';
 const returned=store.readCell(1,1);returned.type='blight';
 assert.equal(store.readCell(1,1).type,original);
 assert.equal(store.revision,0);
});
test('only valid patch commits one revision and returns detached changes',()=>{
 const store=createWorldStore(),before=store.readCell(1,1);
 const result=store.patchCell(1,1,{type:'blight'});
 assert.equal(store.revision,1);
 assert.equal(store.readCell(1,1).type,'blight');
 result.after.type='forest';
 assert.equal(store.readCell(1,1).type,'blight');
 assert.equal(result.before.type,before.type);
});
test('invalid patch and absent cell cannot commit',()=>{
 const store=createWorldStore(),before=store.snapshot();
 assert.throws(()=>store.patchCell(1,1,{x:10}),/Cannot move/);
 assert.throws(()=>store.patchCell(1,1,{extra:true}),/Unknown cell field/);
 assert.equal(store.patchCell(100,100,{type:'forest'}),null);
 assert.equal(store.revision,0);
 assert.deepEqual(store.snapshot(),before);
});
test('replacement validates before publishing and breaks caller aliases',()=>{
 const store=createWorldStore(),candidate=createWorld(42);
 assert.equal(store.replaceWorld(candidate),1);
 const before=store.snapshot();
 candidate.cells[0].type='blight';
 assert.deepEqual(store.snapshot(),before);
 const bad=store.snapshot();[bad.cells[0],bad.cells[1]]=[bad.cells[1],bad.cells[0]];
 assert.throws(()=>store.replaceWorld(bad));
 assert.equal(store.revision,1);
 assert.deepEqual(store.snapshot(),before);
});
