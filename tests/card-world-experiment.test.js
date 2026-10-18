import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,playCard,stepSimulation,getTile,snapshot} from '../src/card-world-experiment.js';
const tile=(q,r,fuel=80,moisture=0)=>({q,r,fuel,moisture});
test('same spark burns dry fuel but not saturated ground',()=>{
 const a=createSimulation([tile(0,0,80,0),tile(1,0,80,95)]);
 assert.equal(playCard(a,'spark',0,0).ok,true);
 assert.equal(playCard(a,'spark',1,0).ok,true);
 stepSimulation(a);
 assert.equal(getTile(a,0,0).burning,true);
 assert.equal(getTile(a,1,0).burning,false);
});
test('spark on bare rock cannot start a fire',()=>{
 const a=createSimulation([tile(0,0,0,0)]);playCard(a,'spark',0,0);stepSimulation(a);
 assert.equal(getTile(a,0,0).burning,false);
});
test('rain changes physical conditions and can extinguish fire',()=>{
 const a=createSimulation([tile(0,0)]);playCard(a,'spark',0,0);stepSimulation(a);
 assert.equal(getTile(a,0,0).burning,true);
 playCard(a,'rain',0,0);playCard(a,'rain',0,0);stepSimulation(a);
 assert.equal(getTile(a,0,0).burning,false);
});
test('fire spreads to adjacent dry fuel but not wet tile',()=>{
 const a=createSimulation([tile(0,0),tile(1,0),tile(0,1,90,95)]);playCard(a,'spark',0,0);
 stepSimulation(a);stepSimulation(a);
 assert.equal(getTile(a,1,0).burning,true);
 assert.equal(getTile(a,0,1).burning,false);
});
test('settlement is independent of tile enumeration order',()=>{
 const ts=[tile(0,0),tile(1,0),tile(0,1),tile(-1,1)];
 const a=createSimulation(ts),b=createSimulation([...ts].reverse());
 playCard(a,'spark',0,0);playCard(b,'spark',0,0);
 for(let i=0;i<4;i++){stepSimulation(a);stepSimulation(b)}
 assert.deepEqual(snapshot(a),snapshot(b));
});
test('invalid cards and targets have no effects',()=>{
 const a=createSimulation([tile(0,0)]),initial=snapshot(a);
 assert.equal(playCard(a,'unknown',0,0).ok,false);
 assert.equal(playCard(a,'spark',20,20).ok,false);
 assert.deepEqual(snapshot(a),initial);
});
test('reject duplicate and invalid tiles',()=>{
 assert.throws(()=>createSimulation([tile(0,0),tile(0,0)]));
 assert.throws(()=>createSimulation([tile(0,0,101,0)]));
});
