import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexWorldStore} from '../src/hex-world.js';
import {projectHexTiles} from '../src/hex-view-projection.js';
import {groupTerrainTiles,tileTerrainCounts} from '../src/hex-terrain-batches.js';
test('mixed 19-cell hex world batches two terrain families',()=>{
 const store=createHexWorldStore();
 store.setTerrain(0,0,'meadow');store.setTerrain(1,-1,'meadow');
 const tiles=projectHexTiles(store.snapshot()), groups=groupTerrainTiles(tiles);
 assert.equal(groups.meadow.length,2);assert.equal(groups.wasteland.length,17);
 assert.deepEqual(tileTerrainCounts(tiles),{wasteland:17,meadow:2});
 assert.equal(groups.meadow.some(t=>t.q===0&&t.r===0),true);
});
test('batching never mutates authoritative world and rejects unknown terrain',()=>{
 const store=createHexWorldStore();const tiles=projectHexTiles(store.snapshot());
 groupTerrainTiles(tiles).wasteland.splice(0,1);
 assert.equal(store.snapshot().cells.length,19);
 assert.throws(()=>groupTerrainTiles([{q:0,r:0,terrain:'forest'}]));
});
