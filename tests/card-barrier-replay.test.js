import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,snapshot} from '../src/card-world-experiment.js';
import {createCardQueue} from '../src/card-command-queue.js';
import {replayBarriers} from '../src/card-barrier-replay.js';
const tiles=[{q:0,r:0,fuel:80,moisture:0},{q:1,r:0,fuel:50,moisture:0}];
function history(){
 const world=createSimulation(tiles),queue=createCardQueue(world);
 assert.equal(queue.submit({id:'fire',card:'spark',q:0,r:0}).ok,true);
 const records=[queue.flush()];
 assert.equal(queue.submit({id:'rain',card:'rain',q:0,r:0}).ok,true);
 records.push(queue.flush());records.push(queue.flush());
 return {records,ending:snapshot(world)};
}
test('replays multiple barriers including an empty barrier',()=>{
 const {records,ending}=history();const out=replayBarriers(tiles,records);
 assert.deepEqual(out.snapshot,ending);
 assert.deepEqual(out.verified.map(x=>x.commands),[1,1,0]);
});
test('cannot silently accept tampered final state',()=>{
 const {records}=history();records[0].after.tiles[0].fuel=0;
 assert.throws(()=>replayBarriers(tiles,records),/replay diverged/);
});
test('detects changed pre-state and duplicate commands',()=>{
 const {records}=history();records[1].before.tick=99;
 assert.throws(()=>replayBarriers(tiles,records),/before snapshot mismatch/);
 const {records:another}=history();another[1].commands[0].id='fire';
 assert.throws(()=>replayBarriers(tiles,another),/duplicate-id/);
});
test('does not mutate source records or tiles',()=>{
 const {records}=history(),raw=JSON.stringify({tiles,records});
 replayBarriers(tiles,records);
 assert.equal(JSON.stringify({tiles,records}),raw);
});
