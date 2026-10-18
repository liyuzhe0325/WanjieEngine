import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,snapshot} from '../src/card-world-experiment.js';
import {createCardQueue} from '../src/card-command-queue.js';
import {previewBarrier} from '../src/card-action-preview.js';

const tiles=[{q:0,r:0,fuel:80,moisture:0},{q:1,r:0,fuel:80,moisture:80}];
test('preview is non-destructive and equals an immediate flush of same commands',()=>{
 const world=createSimulation(tiles),before=snapshot(world),commands=[{id:'first',card:'spark',q:0,r:0}];
 const preview=previewBarrier(world,commands);
 assert.equal(preview.ok,true);
 assert.equal(preview.conditional,true);
 assert.deepEqual(snapshot(world),before);
 assert.deepEqual(world.events,[]);
 const queue=createCardQueue(world);
 assert.equal(queue.submit(commands[0]).ok,true);
 const actual=queue.flush();
 for(const key of ['tick','commands','changes','before','after'])
   assert.deepEqual(preview[key],actual[key]);
});
test('illegal target and duplicate IDs return reasons without modifying world',()=>{
 const world=createSimulation(tiles),before=snapshot(world);
 assert.deepEqual(previewBarrier(world,[{id:'a',card:'spark',q:99,r:0}]),
   {ok:false,index:0,reason:'invalid-target'});
 assert.deepEqual(previewBarrier(world,[{id:'a',card:'spark',q:0,r:0},{id:'a',card:'rain',q:1,r:0}]),
   {ok:false,index:1,reason:'duplicate-id'});
 assert.deepEqual(snapshot(world),before);
});
test('different environments produce different preview outcomes for same card',()=>{
 const world=createSimulation(tiles);
 const a=previewBarrier(world,[{id:'a',card:'spark',q:0,r:0}]);
 const b=previewBarrier(world,[{id:'b',card:'spark',q:1,r:0}]);
 assert.equal(a.after.tiles.find(t=>t.q===0).burning,true);
 assert.equal(b.after.tiles.find(t=>t.q===1).burning,false);
});
test('empty barrier prediction advances only the clone',()=>{
 const world=createSimulation(tiles);
 const result=previewBarrier(world);
 assert.equal(result.tick,1);assert.equal(world.tick,0);
});
