// One authoritative import manifest for hex terrain render assets.
// Source is a repository-relative URL; runtime validates inputs before loading.
// Model bytes are deliberately not embedded in the manifest.
const ID = /^[a-z][a-z0-9_-]*$/;
const SAFE = /^[a-z0-9_-]+\.glb$/;
const TYPES = new Set(['base','surface']);
export function validateTerrainManifest(doc) {
  if (!doc || doc.version !== 1 || !Array.isArray(doc.assets)) throw Error('Invalid terrain manifest');
  const ids = new Set(), filenames = new Set();
  for (const entry of doc.assets) {
    if (!entry || !ID.test(entry.id) || ids.has(entry.id) || !TYPES.has(entry.type) ||
        !Array.isArray(entry.lods) || !entry.lods.length || entry.lods.length > 6) throw Error('Invalid terrain asset entry');
    ids.add(entry.id);
    for (const f of entry.lods) {
      if (typeof f !== 'string' || !SAFE.test(f) || filenames.has(f)) throw Error('Invalid or duplicate terrain GLB filename');
      filenames.add(f);
    }
    if (entry.placement) {
      const p=entry.placement;
      if (!['surface','base'].includes(p.layer) || !Array.isArray(p.scale) ||
          p.scale.length !== 3 || !p.scale.every(n=>Number.isFinite(n)&&n>0) ||
          !Array.isArray(p.offset) || p.offset.length!==3 || !p.offset.every(Number.isFinite))
        throw Error('Invalid placement metadata');
    }
  }
  return doc;
}
export function locateTerrainFile(manifest,file) {
  validateTerrainManifest(manifest);
  for(const a of manifest.assets) {
    const lod=a.lods.indexOf(file);
    if(lod!==-1)return {assetId:a.id,type:a.type,lod};
  }
  return null;
}
export function getTerrainAsset(manifest,id) {
  return validateTerrainManifest(manifest).assets.find(a=>a.id===id) ?? null;
}
export async function fetchTerrainManifest(url,fetcher=fetch) {
  const result=await fetcher(url);
  if(!result.ok)throw Error('Terrain manifest HTTP '+result.status);
  return validateTerrainManifest(await result.json());
}
