import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,getTile,snapshot} from '../src/card-world-experiment.js';
import {createCardQueue} from '../src/card-command-queue.js';
const tile=(q,r,fuel=80,moisture=0)=>({q,r,fuel,moisture});
test('submitting a card does not mutate world until barrier',()=>{
 const w=createSimulation([tile(0,0)]),q=createCardQueue(w),before=snapshot(w);
 assert.deepEqual(q.submit({id:'a',card:'spark',q:0,r:0}),{ok:true,id:'a'});
 assert.deepEqual(snapshot(w),before);assert.equal(q.pending,1);
 const result=q.flush();
 assert.equal(q.pending,0);assert.equal(w.tick,1);
 assert.equal(getTile(w,0,0).burning,true);
 assert.deepEqual(result.commands,[{id:'a',card:'spark',q:0,r:0}]);
 assert.equal(result.changes.length,1);
});
test('invalid or duplicate commands never enter the queue',()=>{
 const w=createSimulation([tile(0,0)]),q=createCardQueue(w);
 assert.equal(q.submit({id:'x',card:'spark',q:0,r:0}).ok,true);
 for(const bad of [{id:'x',card:'rain',q:0,r:0},{id:'z',card:'unknown',q:0,r:0},{id:'t',card:'spark',q:2,r:2},{id:'t',card:'spark',q:0.4,r:0},{}])
 assert.equal(q.submit(bad).ok,false);
 assert.equal(q.pending,1);q.flush();assert.equal(w.events.filter(e=>e.kind==='card').length,1);
});
test('two cards are applied in stable submission order, then exactly one settlement',()=>{
 const w=createSimulation([tile(0,0,80,0)]),q=createCardQueue(w);
 q.submit({id:'fire',card:'spark',q:0,r:0});
 q.submit({id:'rain',card:'rain',q:0,r:0});
 const out=q.flush();
 assert.deepEqual(out.commands.map(x=>x.id),['fire','rain']);
 assert.deepEqual(w.events.map(x=>x.kind),['card','card','settlement']);
 assert.equal(getTile(w,0,0).burning,false);
});
test('multiple empty barriers advance deterministic world clock once each',()=>{
 const w=createSimulation([tile(0,0)]),q=createCardQueue(w);
 q.flush();q.flush();assert.equal(w.tick,2);
 assert.equal(w.events.filter(x=>x.kind==='settlement').length,2);
});
test('snapshot results cannot mutate authoritative world',()=>{
 const w=createSimulation([tile(0,0)]),q=createCardQueue(w);
 const x=q.flush();x.after.tiles[0].fuel=0;x.changes.length=0;
 assert.equal(getTile(w,0,0).fuel,80);
});
test('same commands produce same state regardless of source tile ordering',()=>{
 const src=[tile(0,0),tile(1,0),tile(0,1,50,80)];
 const a=createSimulation(src),b=createSimulation([...src].reverse());
 const qa=createCardQueue(a),qb=createCardQueue(b);
 for(const q of [qa,qb]){q.submit({id:'1',card:'spark',q:0,r:0});q.submit({id:'2',card:'rain',q:0,r:1});q.flush();q.flush()}
 assert.deepEqual(snapshot(a),snapshot(b));
});
