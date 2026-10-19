import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexWorld,createHexWorldStore} from '../src/hex-world.js';
import {projectHexTiles} from '../src/hex-view-projection.js';
test('render projection reproduces 217 canonical axial positions',()=>{
 const world=createHexWorld(8),view=projectHexTiles(world);
 assert.equal(view.length,217);
 assert.deepEqual(view.find(t=>t.q===1&&t.r===-1),{q:1,r:-1,terrain:'wasteland',x:1.42,z:-0.823});
});
test('view reflects terrain edits without mutating authoritative data',()=>{
 const store=createHexWorldStore(),before=projectHexTiles(store.snapshot());
 assert.equal(store.setTerrain(0,0,'meadow'),true);
 const after=projectHexTiles(store.snapshot());
 assert.equal(before.find(t=>t.q===0&&t.r===0).terrain,'wasteland');
 assert.equal(after.find(t=>t.q===0&&t.r===0).terrain,'meadow');
 after[0].terrain='INVALID';
 assert.equal(store.readCell(after[0].q,after[0].r).terrain,'wasteland');
});
