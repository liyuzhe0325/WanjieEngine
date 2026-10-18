import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,saveWorld} from '../src/world.js';
import {createProjectedSimulation,projectWorldTiles} from '../src/card-world-projection.js';
import {snapshot} from '../src/card-world-experiment.js';
const resolver=c=>({fuel:c.type==='forest'?80:10,moisture:c.type==='water'?90:20});
test('projection preserves cell count and coordinates without writing back',()=>{
 const w=createWorld(12),before=saveWorld(w),tiles=projectWorldTiles(w,resolver);
 assert.equal(tiles.length,w.cells.length);
 assert.deepEqual(tiles[0],{q:0,r:0,fuel:10,moisture:20,heat:0,burning:false});
 tiles[0].fuel=0;
 assert.equal(saveWorld(w),before);
});
test('projected simulation is independent of editor model',()=>{
 const w=createWorld(12),simulation=createProjectedSimulation(w,resolver);
 const old=snapshot(simulation);
 w.cells[0].type='blight';
 assert.deepEqual(snapshot(simulation),old);
});
test('resolver cannot mutate editor cell and must provide explicit environment',()=>{
 const w=createWorld(12);
 assert.throws(()=>projectWorldTiles(w,c=>{c.type='rock';return resolver(c);}),TypeError);
 assert.throws(()=>projectWorldTiles(w,()=>({fuel:101,moisture:0})),/Invalid environment/);
 assert.throws(()=>projectWorldTiles(w,()=>({fuel:0})),/Invalid environment/);
});
test('requires valid editor world',()=>{
 const w=createWorld();w.cells[0].type='bogus';
 assert.throws(()=>projectWorldTiles(w,resolver),/Invalid cell/);
});
