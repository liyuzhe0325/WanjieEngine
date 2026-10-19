import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTerrainManifest,locateTerrainFile,getTerrainAsset} from '../src/terrain-assets.js';
const data=JSON.parse(readFileSync(new URL('../experiments/hex-assembly-lod/terrain-assets.json',import.meta.url),'utf8'));
test('terrain manifest is valid',()=>{assert.equal(validateTerrainManifest(data),data);assert.equal(data.assets.length,3)});
test('meadow LODs have stable identities',()=>{assert.deepEqual(locateTerrainFile(data,'meadow_lod4.glb'),{assetId:'meadow',type:'surface',lod:3});assert.equal(getTerrainAsset(data,'meadow').lods.length,4)});
test('blocks traversal and duplicate files',()=>{const m=structuredClone(data);m.assets[1].lods[0]='../escape.glb';assert.throws(()=>validateTerrainManifest(m));const n=structuredClone(data);n.assets[1].lods[0]='base_lod1.glb';assert.throws(()=>validateTerrainManifest(n))});
test('placement rejects malformed transforms',()=>{const m=structuredClone(data);m.assets[2].placement.scale=[0,1,1];assert.throws(()=>validateTerrainManifest(m))});
