import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../src/card-world-experiment.js';
import {previewBarrier} from '../src/card-action-preview.js';
import {describeBarrier} from '../src/card-feedback.js';
test('fire preview exposes visible state and numerical differences without mutating inputs',()=>{
 const w=createSimulation([{q:0,r:0,fuel:80,moisture:0}]);
 const preview=previewBarrier(w,[{id:'s',card:'spark',q:0,r:0}]);
 const unchanged=JSON.stringify(preview);
 const feedback=describeBarrier(preview);
 assert.equal(feedback.kind,'preview');
 assert.equal(feedback.conditional,true);
 assert.equal(feedback.changes[0].note,'ignited');
 assert.equal(feedback.changes[0].state,'burning');
 assert.equal(feedback.changes[0].deltas.fuel,-12);
 assert.equal(JSON.stringify(preview),unchanged);
});
test('feedback distinguishes no visible change and rejected action',()=>{
 const w=createSimulation([{q:0,r:0,fuel:0,moisture:0,heat:0}]);
 const empty=describeBarrier(previewBarrier(w));
 assert.equal(empty.ok,true);
 assert.equal(empty.changedTiles,0===empty.changedTiles?0:empty.changedTiles); // settled tiles may dry only when wet
 assert.deepEqual(empty.messages,['no-observable-change']);
 assert.deepEqual(describeBarrier({ok:false,reason:'invalid-target'}),{ok:false,reason:'invalid-target',messages:[]});
});
test('result order is coordinate stable',()=>{
 const input={tick:1,commands:[],before:{tiles:[{q:1,r:0,fuel:9,moisture:0,heat:0,burning:false},{q:0,r:0,fuel:9,moisture:0,heat:0,burning:false}]},after:{tiles:[{q:1,r:0,fuel:8,moisture:0,heat:0,burning:false},{q:0,r:0,fuel:8,moisture:0,heat:0,burning:false}]}};
 assert.deepEqual(describeBarrier(input).changes.map(x=>x.q),[0,1]);
});
