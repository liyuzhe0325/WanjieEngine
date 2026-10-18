import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {findAsset,validateCatalog} from './asset-catalog.js';
// Loaded originals are never inserted into the scene directly: instances are cloned.
// Use SkeletonUtils if/when introducing skinned animated meshes.
export class AssetLibrary {
 constructor(catalog,loader=new GLTFLoader()){this.catalog=validateCatalog(catalog);this.loader=loader;this.cache=new Map();}
 async preload(id){const a=findAsset(this.catalog,id);if(!a)throw Error('Unknown asset: '+id);
  if(!this.cache.has(id)){const pending=this.loader.loadAsync(a.url).catch(err=>{this.cache.delete(id);throw err;});this.cache.set(id,pending);}
  return this.cache.get(id);
 }
 async instantiate(id){const data=await this.preload(id);const a=findAsset(this.catalog,id);const scene=data.scene.clone(true);scene.scale.setScalar(a.scale??1);return scene;}
 has(id){return !!findAsset(this.catalog,id);}
 clear(){this.cache.clear();}
}
