import * as THREE from 'three';
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
scene.add(new THREE.HemisphereLight(0xe9eefc,0x37332a,2));
const sun=new THREE.DirectionalLight(0xffe9cf,2.4);sun.position.set(7,12,9);scene.add(sun);
const stage=new THREE.Group();scene.add(stage);
const loader=new GLTFLoader();
const cameraPoint=new THREE.Vector3(),origin=new THREE.Vector3(),matrix=new THREE.Matrix4(),tempMatrix=new THREE.Matrix4();
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),ball=new THREE.Sphere(new THREE.Vector3(),1.15);
const metrics=document.createElement('div');
metrics.style.cssText='margin-top:8px;white-space:pre-line;color:#d6b47e;font:13px/1.5 monospace';
$('stats').replaceWith(metrics);metrics.id='stats';
let radius=2,tiles=[],assets={},groups=[],dirty=true,currentStats='',lastRefresh=0,loadStatus='默认占位模型';
const safeNum=id=>Number($(id).value);
const geometry=new THREE.CylinderGeometry(.94,.94,.21,6,1).rotateY(Math.PI/6);
const soilGeometry=new THREE.CylinderGeometry(.855,.855,.035,6,1).rotateY(Math.PI/6);
// Provide planar top UV for textured proxy: color preserved, high frequency silhouettes not preserved.
const uv=soilGeometry.attributes.uv,positions=soilGeometry.attributes.position;
for(let i=0;i<uv.count;i++){uv.setXY(i,positions.getX(i)/1.9+.5,positions.getZ(i)/1.7+.5)}
uv.needsUpdate=true;
const stoneMaterial=new THREE.MeshStandardMaterial({color:'#4e4b47',roughness:1});
let soilMaterial=new THREE.MeshStandardMaterial({color:'#a07e5d',roughness:1});
function hex(n){const out=[];for(let q=-n;q<=n;q++)for(let r=Math.max(-n,-q-n);r<=Math.min(n,-q+n);r++)out.push({q,r,x:1.42*q,z:1.646*(r+q/2)});return out}
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
 groups=[];tiles=hex(radius);
 if(assets.t){const tm=collect(assets.t).find(m=>m.material?.map);
  if(tm){soilMaterial=tm.material.clone();soilMaterial.normalMap=null;soilMaterial.roughnessMap=null;soilMaterial.metalnessMap=null;soilMaterial.aoMap=null;soilMaterial.color.set('white');soilMaterial.needsUpdate=true}
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
 // Budget is a safeguard, not a number-of-tiles cap. Use actual triangle costs.
 const levelCost=[0,1,2].map(l=>groups.filter(g=>g.lod===l).reduce((s,g)=>s+g.tri,0));
 const desired=visible.map(t=>({
  ...t,
  lod:$('mode').value!=='auto'?Number($('mode').value):
    t.pixels>safeNum('near')?0:t.pixels>safeNum('mid')?1:2
 }));
 const budget=Number($('triangleBudget')?.value||2000000);
 let remaining=budget;
 for(const t of desired){
  while(t.lod<2&&remaining<levelCost[t.lod])t.lod++;
  remaining-=levelCost[t.lod];
 }
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
     if(l<2&&(assets.t||assets.t1)){
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
 '\n模型：'+loadStatus;
 dirty=false;
}
function load(name,buf){return new Promise((yes,no)=>loader.parse(buf,'',g=>yes(g.scene),no))}
async function apply(entries){
 let n=0;
 for(const [filename,data] of entries){
  try{const obj=await load(filename,data);
   if(filename.includes('terrain_lod1'))assets.t1=obj;
   else if(filename.includes('terrain_lod2'))assets.t2=obj;
   else if(filename.includes('base_lod1'))assets.b1=obj;
   else if(filename.includes('base_lod2'))assets.b2=obj;
   else if(filename.includes('terrain'))assets.t=obj;
   else continue;n++;
  }catch(e){console.error(filename,e)}
 }
 loadStatus='已读取 '+n+' 份 GLB（基础 3 份，可选地表 LOD 2 份）';
 $('status').textContent=loadStatus+'；远景复用地表纹理（如果纹理存在）';
 rebuild();
}
$('files').onchange=async event=>apply(await Promise.all([...event.target.files].map(async f=>[f.name,await f.arrayBuffer()])));
async function autoLoad(){
 const entries=[];
 for(const f of ['base_lod1.glb','base_lod2.glb','terrain.glb','terrain_lod1.glb','terrain_lod2.glb']){
  try{const r=await fetch('./models/'+f);if(r.ok)entries.push([f,await r.arrayBuffer()])}catch{}
 }if(entries.length)await apply(entries);
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
 if(dirty||time-lastRefresh>180){refresh();lastRefresh=time}
 renderer.render(scene,camera);
 if(time-statClock.t>300){metrics.textContent=currentStats;statClock.t=time}
}
rebuild();autoLoad();requestAnimationFrame(tick);
