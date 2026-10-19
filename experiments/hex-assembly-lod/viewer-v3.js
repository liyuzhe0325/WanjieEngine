import * as THREE from 'three';
import {hexDisk} from '../../src/hex-space.js';
import {createLoadEpoch} from '../../src/load-epoch.js';
import {disposeUnretainedModels} from '../../src/model-resource-lifetime.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#28323b');
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,650);
camera.position.set(5,7,10);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=false;
document.body.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;
orbit.dampingFactor=0.075;orbit.rotateSpeed=0.55;orbit.zoomSpeed=0.7;orbit.panSpeed=0.7;orbit.minPolarAngle=0.1;orbit.maxPolarAngle=Math.PI/2-0.10;orbit.minDistance=1.7;orbit.maxDistance=160;
scene.add(new THREE.HemisphereLight(0xe9eefc,0x37332a,2));
const sun=new THREE.DirectionalLight(0xffe9cf,2.4);sun.position.set(7,12,9);scene.add(sun);
const stage=new THREE.Group();scene.add(stage);
const loader=new GLTFLoader();
const loadEpoch=createLoadEpoch();
const cameraPoint=new THREE.Vector3(),origin=new THREE.Vector3(),matrix=new THREE.Matrix4(),tempMatrix=new THREE.Matrix4();
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),ball=new THREE.Sphere(new THREE.Vector3(),1.15);
const metrics=document.createElement('div');
metrics.style.cssText='margin-top:8px;white-space:pre-line;color:#d6b47e;font:13px/1.5 monospace';
$('stats').replaceWith(metrics);metrics.id='stats';
let radius=2,tiles=[],assets={},groups=[],dirty=true,currentStats='',lastRefresh=0,loadStatus='默认占位模型';
let globalBand=0;const LOD_HYSTERESIS=0.10;let fpsFrames=0,fpsStart=performance.now(),fpsValue=0;
const safeNum=id=>Number($(id).value);
const geometry=new THREE.CylinderGeometry(.94,.94,.21,6,1).rotateY(Math.PI/6);
const soilGeometry=new THREE.CylinderGeometry(.855,.855,.035,6,1).rotateY(Math.PI/6);
// Provide planar top UV for textured proxy: color preserved, high frequency silhouettes not preserved.
const uv=soilGeometry.attributes.uv,positions=soilGeometry.attributes.position;
for(let i=0;i<uv.count;i++){uv.setXY(i,positions.getX(i)/1.9+.5,positions.getZ(i)/1.7+.5)}
uv.needsUpdate=true;
const stoneMaterial=new THREE.MeshStandardMaterial({color:'#4e4b47',roughness:1});
let soilMaterial=new THREE.MeshStandardMaterial({color:'#a07e5d',roughness:1});
let derivedSoilSource=null;

function turn(t){return $('rotateVar').checked?Math.abs(t.q*13+t.r*29+t.q*t.r*7)%6*Math.PI/3:0}
function collect(obj){
 const meshes=[];if(!obj)return meshes;
 obj.updateMatrixWorld(true);
 const inv=obj.matrixWorld.clone().invert();
 obj.traverse(o=>{if(!o.isMesh||!o.geometry)return;
  if(Array.isArray(o.material))return; // GLB generated assets use one PBR material per mesh.
  meshes.push({geometry:o.geometry,material:o.material,local:inv.clone().multiply(o.matrixWorld),tri:o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3});
 });return meshes;
}
function makeSet(lod,kind,obj,proxyGeom,proxyMat){
 let desc=collect(obj);
 if(!desc.length)desc=[{geometry:proxyGeom,material:proxyMat,local:new THREE.Matrix4(),tri:proxyGeom.index.count/3}];
 return desc.map(p=>{
  const inst=new THREE.InstancedMesh(p.geometry,p.material,tiles.length);
  inst.frustumCulled=false;inst.count=0;inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stage.add(inst);
  return {...p,inst,kind,lod};
 });
}
function rebuild(){
 for(const group of groups){stage.remove(group.inst);group.inst.dispose()}
 groups=[];tiles=hexDisk(radius);
 // The far-field proxy owns its derived material. Reuse it on radius/LOD
 // rebuilds; never dispose the source GLB's shared material or its textures.
 const source=assets.t?collect(assets.t).find(m=>m.material?.map)?.material??null:null;
 if(source!==derivedSoilSource){
  const previous=soilMaterial;
  soilMaterial=source?source.clone():new THREE.MeshStandardMaterial({color:'#a07e5d',roughness:1});
  if(source){
   soilMaterial.normalMap=null;soilMaterial.roughnessMap=null;
   soilMaterial.metalnessMap=null;soilMaterial.aoMap=null;
   soilMaterial.color.set('white');soilMaterial.needsUpdate=true;
  }
  derivedSoilSource=source;
  previous.dispose();
 }
 for(let level=0;level<3;level++){
  groups.push(...makeSet(level,'base',level===0?assets.b1:level===1?assets.b2:null,geometry,stoneMaterial));
  groups.push(...makeSet(level,'top',level===0?assets.t:level===1?(assets.t1||assets.t):assets.t2,soilGeometry,soilMaterial));
 }
 dirty=true;
}
function refresh(){
 camera.updateMatrixWorld();
 projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 frustum.setFromProjectionMatrix(projection);
 const visible=[];
 for(const tile of tiles){
  origin.set(tile.x,0,tile.z);ball.center.copy(origin);
  if(!frustum.intersectsSphere(ball))continue;
  const dist=camera.position.distanceTo(origin);
  const pixels=1.9*innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*Math.max(.05,dist));
  visible.push({...tile,dist,pixels});
 }
 visible.sort((a,b)=>a.dist-b.dist);
 // A tabletop-wide quality choice based on camera height avoids near/far strips.
 // Five zoom bands, backed by three currently available geometry assets.
 const heights=[4.0,7.0,12.0,20.0];
 const height=Math.max(.1,Math.abs(camera.position.y-orbit.target.y));
 const requested=$('mode').value==='auto'?null:Number($('mode').value);
 if(requested===null){
  while(globalBand<4&&height>heights[globalBand]*(1+LOD_HYSTERESIS))globalBand++;
  while(globalBand>0&&height<heights[globalBand-1]*(1-LOD_HYSTERESIS))globalBand--;
 }else globalBand=[0,2,4][requested]??2;
 const mapping=[0,0,1,1,2];
 let uniformLOD=mapping[globalBand];
 const budget=Number($('triangleBudget')?.value||2000000);
 const levelCost=[0,1,2].map(l=>groups.filter(g=>g.lod===l).reduce((sum,g)=>sum+g.tri,0));
 // Downgrade ALL visible tiles together under budget, preventing a quality strip.
 while(uniformLOD<2&&levelCost[uniformLOD]*visible.length>budget)uniformLOD++;
 const desired=visible.map(t=>({...t,lod:uniformLOD}));
 const counts=[0,0,0];const baseOnly=$('baseOnly').checked,terrainOnly=$('terrainOnly').checked;
 for(let l=0;l<3;l++){
  const batch=desired.filter(t=>t.lod===l);counts[l]=batch.length;
  for(const g of groups.filter(g=>g.lod===l)){
   g.inst.count=(g.kind==='base'&&terrainOnly)||(g.kind==='top'&&baseOnly)?0:batch.length;
   if(!g.inst.count)continue;
   for(let i=0;i<batch.length;i++){
    const t=batch[i];
    matrix.makeTranslation(t.x,0,t.z);
    if(g.kind==='top'){
     tempMatrix.makeRotationY(turn(t));matrix.multiply(tempMatrix);
     if((l===0&&assets.t)||(l===1&&(assets.t1||assets.t))||(l===2&&assets.t2)){
      tempMatrix.makeTranslation(0,safeNum('lift'),0);matrix.multiply(tempMatrix);
      tempMatrix.makeScale(safeNum('scale'),safeNum('scale'),safeNum('scale'));matrix.multiply(tempMatrix);
     }else{tempMatrix.makeTranslation(0,.12,0);matrix.multiply(tempMatrix)}
    }
    matrix.multiply(g.local);
    g.inst.setMatrixAt(i,matrix);
   }
   g.inst.instanceMatrix.needsUpdate=true;
  }
 }
 currentStats='地图总格：'+tiles.length+' / 视野内：'+visible.length+
 '\n实际 LOD0 / LOD1 / 纹理代理：'+counts.join(' / ')+
 '\n三角面预算：'+(budget/1000000).toFixed(1)+'M'+
 '\nDraw Calls：'+renderer.info.render.calls+
 '\n当前三角面：'+renderer.info.render.triangles+
 '\n相机离地高度：'+height.toFixed(2)+' / 全局缩放档：'+(globalBand+1)+'/5'+
 '\nFPS（约）：'+fpsValue+'\nLOD 切换滞回：±10%'+
 '\n模型：'+loadStatus;
 dirty=false;
}
function load(name,buf){return new Promise((yes,no)=>loader.parse(buf,'',g=>yes(g.scene),no))}
const MODEL_SLOTS={
 'base_lod1.glb':'b1','base_lod2.glb':'b2','terrain.glb':'t',
 'terrain_lod1.glb':'t1','terrain_lod2.glb':'t2'
};
async function apply(entries,epoch){
 const staged={};
 let n=0;
 for(const [filename,data] of entries){
  if(!loadEpoch.isCurrent(epoch))return;
  const slot=MODEL_SLOTS[filename];
  if(!slot)continue;
  try{staged[slot]=await load(filename,data);n++}
  catch(e){console.error(filename,e)}
 }
 // A late auto-load or import is not permitted to overwrite a newer batch.
 if(!loadEpoch.isCurrent(epoch)){
  disposeUnretainedModels(Object.values(staged),Object.values(assets));
  return;
 }
 const previous=assets;
 assets={...assets,...staged};
 loadStatus='已读取 '+n+' 份 GLB（基础 3 份，可选地表 LOD 2 份）';
 $('status').textContent=loadStatus+'；远景复用地表纹理（如果纹理存在）';
 rebuild();
 // Instances are removed in rebuild() before their former model resources are freed.
 disposeUnretainedModels(Object.values(previous),Object.values(assets),[soilMaterial]);
}
$('files').onchange=async event=>{
 const epoch=loadEpoch.begin();
 const files=[...event.target.files];
 const entries=await Promise.all(files.map(async f=>[f.name,await f.arrayBuffer()]));
 if(loadEpoch.isCurrent(epoch))await apply(entries,epoch);
 event.target.value='';
};
async function autoLoad(){
 const epoch=loadEpoch.begin();
 const entries=[];
 for(const f of Object.keys(MODEL_SLOTS)){
  if(!loadEpoch.isCurrent(epoch))return;
  try{const r=await fetch('./models/'+f);if(r.ok)entries.push([f,await r.arrayBuffer()])}catch{}
 }
 if(entries.length&&loadEpoch.isCurrent(epoch))await apply(entries,epoch);
}
for(const b of document.querySelectorAll('[data-radius]'))b.addEventListener('click',()=>{radius=Number(b.dataset.radius);rebuild()});
for(const id of ['scale','lift','near','mid','mode','rotateVar','baseOnly','terrainOnly','triangleBudget']){
 const elem=$(id);if(elem)elem.addEventListener('input',()=>dirty=true);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);dirty=true});
const statClock={t:0};
function tick(time){
 requestAnimationFrame(tick);
 orbit.update();
 if(dirty||time-lastRefresh>90){refresh();lastRefresh=time}
 renderer.render(scene,camera);
 fpsFrames++;if(time-fpsStart>=1000){fpsValue=Math.round(fpsFrames*1000/(time-fpsStart));fpsFrames=0;fpsStart=time}
 if(time-statClock.t>300){metrics.textContent=currentStats;statClock.t=time}
}
rebuild();autoLoad();requestAnimationFrame(tick);
