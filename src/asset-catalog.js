// Asset metadata is pure data; safe to validate in Node or in the browser.
const ID=/^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)*$/;
export function validateCatalog(catalog){
  if(!catalog||catalog.version!==1||!Array.isArray(catalog.assets))throw Error('Invalid asset catalog');
  const seen=new Set();
  for(const a of catalog.assets){
    if(!a||typeof a.id!=='string'||!ID.test(a.id)||seen.has(a.id))throw Error('Invalid or duplicate asset id');
    if(a.type!=='gltf'||typeof a.url!=='string'||!a.url.startsWith('./assets/')||!(/\.glb$/i.test(a.url)||/\.gltf$/i.test(a.url))||a.url.includes('..'))throw Error('Invalid asset path');
    if(a.scale!==undefined&&(!Number.isFinite(a.scale)||a.scale<=0))throw Error('Invalid scale');
    seen.add(a.id);
  }
  return catalog;
}
export function findAsset(catalog,id){return validateCatalog(catalog).assets.find(a=>a.id===id)??null;}
