import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalog,findAsset} from '../src/asset-catalog.js';
const good=()=>({version:1,assets:[{id:'pieces/castle',type:'gltf',url:'./assets/castle.glb',scale:1.2}]});
test('accept a valid local glTF asset catalog',()=>assert.deepEqual(findAsset(good(),'pieces/castle')?.scale,1.2));
test('reject duplicate IDs',()=>{const a=good();a.assets.push({...a.assets[0]});assert.throws(()=>validateCatalog(a));});
test('reject traversal and remote URLs',()=>{for(const url of ['https://example.com/a.glb','./assets/../secret.glb']){const a=good();a.assets[0].url=url;assert.throws(()=>validateCatalog(a));}});
test('reject invalid IDs and scales',()=>{let a=good();a.assets[0].id='../x';assert.throws(()=>validateCatalog(a));a=good();a.assets[0].scale=0;assert.throws(()=>validateCatalog(a));});
