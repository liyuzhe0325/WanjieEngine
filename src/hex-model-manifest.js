// GLB hex-board asset contract. Pure data; no Three.js, DOM or file access.
// This validates a manifest, not the binary geometry inside a GLB.
export const HEX_MODEL_ROLES=Object.freeze({
  base_lod1:Object.freeze({kind:'base',lod:0,required:true}),
  base_lod2:Object.freeze({kind:'base',lod:1,required:true}),
  terrain:Object.freeze({kind:'terrain',lod:0,required:true}),
  terrain_lod1:Object.freeze({kind:'terrain',lod:1,required:false}),
  terrain_lod2:Object.freeze({kind:'terrain',lod:2,required:false})
});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function validateHexModelManifest(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
    manifest.version!==1||!manifest.models||typeof manifest.models!=='object'||
    Array.isArray(manifest.models))throw Error('Invalid hex model manifest');
  const found={};
  for(const [role,path] of Object.entries(manifest.models)){
    if(!own(HEX_MODEL_ROLES,role))throw Error('Unknown hex model role: '+role);
    if(typeof path!=='string'||!/^\.\/models\/[a-z0-9_-]+\.glb$/.test(path)||
      path!==`./models/${role}.glb`)throw Error('Invalid hex model path: '+role);
    found[role]=path;
  }
  const missing=Object.keys(HEX_MODEL_ROLES).filter(role=>HEX_MODEL_ROLES[role].required&&!own(found,role));
  if(missing.length)throw Error('Missing required hex models: '+missing.join(', '));
  return Object.freeze({version:1,models:Object.freeze({...found})});
}
export function defaultHexModelManifest(){
  return validateHexModelManifest({version:1,models:Object.fromEntries(
    Object.keys(HEX_MODEL_ROLES).map(role=>[role,`./models/${role}.glb`]))});
}
export function describeHexModelAvailability(manifest,availableRoles){
  const validated=validateHexModelManifest(manifest);
  if(!Array.isArray(availableRoles)||availableRoles.some(role=>!own(HEX_MODEL_ROLES,role)))
    throw Error('Invalid available model roles');
  const present=new Set(availableRoles);
  return {
    ready:Object.keys(HEX_MODEL_ROLES).every(role=>!HEX_MODEL_ROLES[role].required||present.has(role)),
    missingRequired:Object.keys(HEX_MODEL_ROLES).filter(role=>HEX_MODEL_ROLES[role].required&&!present.has(role)),
    missingOptional:Object.keys(validated.models).filter(role=>!HEX_MODEL_ROLES[role].required&&!present.has(role))
  };
}
