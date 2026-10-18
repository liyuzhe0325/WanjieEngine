import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultHexModelManifest,validateHexModelManifest,describeHexModelAvailability} from '../src/hex-model-manifest.js';
test('default manifest lists the five known GLB filenames',()=>{
 const manifest=defaultHexModelManifest();
 assert.deepEqual(Object.keys(manifest.models),['base_lod1','base_lod2','terrain','terrain_lod1','terrain_lod2']);
 assert.equal(manifest.models.terrain,'./models/terrain.glb');
});
test('required vs optional resources are independently reported',()=>{
 const manifest=defaultHexModelManifest();
 const partial=describeHexModelAvailability(manifest,['base_lod1','base_lod2','terrain']);
 assert.equal(partial.ready,true);
 assert.deepEqual(partial.missingRequired,[]);
 assert.deepEqual(partial.missingOptional,['terrain_lod1','terrain_lod2']);
 const absent=describeHexModelAvailability(manifest,['terrain']);
 assert.equal(absent.ready,false);
 assert.deepEqual(absent.missingRequired,['base_lod1','base_lod2']);
});
test('malformed roles and paths are rejected',()=>{
 const manifest=defaultHexModelManifest();
 assert.throws(()=>validateHexModelManifest({version:1,models:{terrain:'../terrain.glb'}}));
 assert.throws(()=>validateHexModelManifest({version:1,models:{...manifest.models,unknown:'./models/unknown.glb'}}));
 assert.throws(()=>validateHexModelManifest({version:1,models:{...manifest.models,terrain:'https://example.org/file.glb'}}));
 assert.throws(()=>describeHexModelAvailability(manifest,['unrecognized']));
});
