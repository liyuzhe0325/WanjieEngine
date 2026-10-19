// Dispose only GPU resources unreachable from retained scene roots.
// Scene instances own their instance buffers; this helper owns imported GLB assets.
const isDisposable=x=>x&&typeof x.dispose==='function';
export function collectModelResources(roots){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 for(const root of roots){
  if(!root)continue;
  root.traverse(node=>{
   if(isDisposable(node.geometry))geometries.add(node.geometry);
   for(const mat of Array.isArray(node.material)?node.material:[node.material]){
    if(isDisposable(mat))materials.add(mat);
   }
  });
 }
 for(const material of materials)for(const value of Object.values(material))
  if(value&&value.isTexture&&isDisposable(value))textures.add(value);
 return {geometries,materials,textures};
}
export function disposeUnretainedModels(discardedRoots,retainedRoots=[],retainedMaterials=[]){
 const discarded=collectModelResources(discardedRoots);
 const retained=collectModelResources(retainedRoots);
 for(const mat of retainedMaterials){
  if(!mat)continue;
  retained.materials.add(mat);
  for(const value of Object.values(mat))if(value?.isTexture&&isDisposable(value))retained.textures.add(value);
 }
 const counts={geometries:0,materials:0,textures:0};
 for(const [key,set] of Object.entries(discarded)){
  for(const resource of set)if(!retained[key].has(resource)){
   resource.dispose();counts[key]++;
  }
 }
 return counts;
}
