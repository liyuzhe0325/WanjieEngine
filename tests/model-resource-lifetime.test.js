import test from 'node:test';
import assert from 'node:assert/strict';
import {disposeUnretainedModels} from '../src/model-resource-lifetime.js';
const resource=()=>({calls:0,dispose(){this.calls++}});
function root(geometry,material){return {traverse(fn){fn({geometry,material});}};}
test('disposes removed model geometry material and texture exactly once',()=>{
 const geo=resource(),tex={...resource(),isTexture:true},mat={...resource(),map:tex};
 const result=disposeUnretainedModels([root(geo,mat)]);
 assert.deepEqual(result,{geometries:1,materials:1,textures:1});
 assert.equal(geo.calls,1);assert.equal(mat.calls,1);assert.equal(tex.calls,1);
});
test('shared resources are retained by another active model',()=>{
 const geo=resource(),tex={...resource(),isTexture:true},mat={...resource(),map:tex};
 const dropped=root(geo,mat),kept=root(geo,mat);
 assert.deepEqual(disposeUnretainedModels([dropped],[kept]),{geometries:0,materials:0,textures:0});
});
test('a derived proxy material can preserve texture ownership',()=>{
 const geo=resource(),tex={...resource(),isTexture:true},mat={...resource(),map:tex};
 const out=disposeUnretainedModels([root(geo,mat)],[],[{map:tex}]);
 assert.deepEqual(out,{geometries:1,materials:1,textures:0});
});
test('duplicate mesh references are disposed only once',()=>{
 const geo=resource(),mat=resource();
 const duplicate={traverse(fn){fn({geometry:geo,material:mat});fn({geometry:geo,material:mat})}};
 disposeUnretainedModels([duplicate]);
 assert.equal(geo.calls,1);assert.equal(mat.calls,1);
});
