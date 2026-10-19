import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fetchTerrainManifest} from '../../src/terrain-assets.js';
import {createHexWorld,createHexWorldStore,validateHexWorld} from '../../src/hex-world.js';
import {projectHexTiles} from '../../src/hex-view-projection.js';
import {groupTerrainTiles,tileTerrainCounts} from '../../src/hex-terrain-batches.js';

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
const cameraPoint=new THREE.Vector3(),origin=new THREE.Vector3(),matrix=new THREE.Matrix4(),tempMatrix=new THREE.Matrix4();
const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),ball=new THREE.Sphere(new THREE.Vector3(),1.15);
const metrics=document.createElement('div');
metrics.style.cssText='margin-top:8px;white-space:pre-line;color:#d6b47e;font:13px/1.5 monospace';
$('stats').replaceWith(metrics);metrics.id='stats';
let radius=2,tiles=[],assets={},groups=[],dirty=true,currentStats='',lastRefresh=0,loadStatus='默认占位模型';
// The viewer consumes the authoritative axial hex-world snapshot.
let hexWorld=createHexWorldStore(createHexWorld(radius,'wasteland'));
const visualTiles=()=>projectHexTiles(hexWorld.snapshot());
function resizeWorld(nextRadius){radius=nextRadius;hexWorld=createHexWorldStore(createHexWorld(radius,activeTop()?'meadow':'wasteland'));}
const saveNotice=message=>$('saveStatus').textContent=message;
function downloadWorld(){
 try{
  const snapshot=hexWorld.snapshot();validateHexWorld(snapshot);
  const json=JSON.stringify(snapshot,null,2),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='wanjie-hex-world.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  saveNotice('已导出 '+snapshot.cells.length+' 格，修订 '+hexWorld.revision+'；导出后请妥善保存文件。');
 }catch(error){saveNotice('导出失败：'+error.message);}
}
async function importWorld(file){
 try {
  if(!file)return;
  const raw=await file.text(),next=JSON.parse(raw);
  validateHexWorld(next); // Never replace the live world on malformed input.
  const before=hexWorld.snapshot();
  const previous=new Map(before.cells.map(c=>[c.q+','+c.r,c]));
  const changed=next.cells.filter(c=>{
   const old=previous.get(c.q+','+c.r);
   return !old||old.terrain!==c.terrain||old.building!==c.building;
  }).length;
  const resized=next.radius!==radius;
  hexWorld.replace(next);radius=next.radius;
  $('terrainType').value=next.cells[0]?.terrain||'wasteland';
  for(const button of document.querySelectorAll('[data-radius]'))button.disabled=false;
  rebuild();updateTerrainStatus();
  saveNotice('导入成功：'+next.cells.length+' 格；与当前世界相比 '+changed+' 格地块不同'+(resized?'；地图半径已更新':'')+'。');
 }catch(error){saveNotice('导入失败，原世界未修改：'+error.message);}
 finally{$('worldFile').value='';}
}
$('exportWorld').addEventListener('click',downloadWorld);
$('importWorld').addEventListener('click',()=>$('worldFile').click());
$('worldFile').addEventListener('change',event=>importWorld(event.target.files?.[0]));
const activeTop=()=> $('terrainType').value==='meadow';
let globalBand=0;const LOD_HYSTERESIS=0.10;let fpsFrames=0,fpsStart=performance.now(),fpsValue=0;
const safeNum=id=>Number($(id).value);
const geometry=new THREE.CylinderGeometry(.94,.94,.21,6,1).rotateY(Math.PI/6);
const soilGeometry=new THREE.CylinderGeometry(.855,.855,.035,6,1).rotateY(Math.PI/6);
// Provide planar top UV for textured proxy: color preserved, high frequency silhouettes not preserved.
const uv=soilGeometry.attributes.uv,positions=soilGeometry.attributes.position;
for(let i=0;i<uv.count;i++){uv.setXY(i,positions.getX(i)/1.9+.5,positions.getZ(i)/1.7+.5)}
uv.needsUpdate=true;
const stoneMaterial=new THREE.MeshStandardMaterial({color:'#4e4b47',roughness:1});
const proxyMaterial={wasteland:new THREE.MeshStandardMaterial({color:'#a07e5d',roughness:1}),meadow:new THREE.MeshStandardMaterial({color:'#578450',roughness:1})};
const terrainScale=family=>family==='meadow'?1:safeNum('scale');
const terrainLift=family=>family==='meadow'?.20:safeNum('lift');
const topForFamily=(family,l)=>family==='meadow'?(assets['m'+(l+1)]||assets.m4||assets.m3||assets.m2||assets.m1||null):[assets.t,assets.t1||assets.t,assets.t2,assets.t2][l];
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
function makeSet(lod,kind,obj,proxyGeom,proxyMat,family=null){
 let desc=collect(obj);
 if(!desc.length)desc=[{geometry:proxyGeom,material:proxyMat,local:new THREE.Matrix4(),tri:proxyGeom.index.count/3}];
 return desc.map(p=>{
  const inst=new THREE.InstancedMesh(p.geometry,p.material,tiles.length);
  inst.frustumCulled=false;inst.count=0;inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stage.add(inst);
  return {...p,inst,kind,lod,family,instanceTiles:[]};
 });
}
function rebuild(){
 for(const group of groups){stage.remove(group.inst);group.inst.dispose()}
 groups=[];tiles=visualTiles();
 for(const family of ['wasteland','meadow']){
  const reference=family==='meadow'?assets.m1:assets.t;
  if(reference){const textured=collect(reference).find(m=>m.material?.map);
   if(textured){const old=proxyMaterial[family];const replacement=textured.material.clone();
    replacement.normalMap=null;replacement.roughnessMap=null;replacement.metalnessMap=null;replacement.aoMap=null;
    replacement.color.set('white');replacement.needsUpdate=true;
    proxyMaterial[family]=replacement;if(old!==replacement)old.dispose();
   }
  }
 }
 for(let level=0;level<4;level++){
  groups.push(...makeSet(level,'base',level===0?assets.b1:level===1?assets.b2:null,geometry,stoneMaterial));
  for(const family of ['wasteland','meadow'])groups.push(...makeSet(level,'top',topForFamily(family,level),soilGeometry,proxyMaterial[family],family));
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
 const visibleByFamily=groupTerrainTiles(visible);
 const bandMap={wasteland:[0,0,1,1,2],meadow:[0,1,1,2,3]};
 let uniformLOD=Math.max(...Object.entries(visibleByFamily).filter(([,v])=>v.length).map(([family])=>bandMap[family][globalBand]));
 if(!Number.isFinite(uniformLOD))uniformLOD=0;
 const budget=Number($('triangleBudget')?.value||2000000);
 // Per-instance cost includes one common stone base and exactly one terrain family.
 const budgetCost=l=>groups.filter(g=>g.lod===l).reduce((sum,g)=>sum+g.tri*(g.kind==='base'?visible.length:visibleByFamily[g.family].length),0);
 while(uniformLOD<3&&budgetCost(uniformLOD)>budget)uniformLOD++;
 const counts=[0,0,0,0];counts[uniformLOD]=visible.length;
 const baseOnly=$('baseOnly').checked,terrainOnly=$('terrainOnly').checked;
 for(const g of groups){
  const batch=g.lod!==uniformLOD?[]:g.kind==='base'?visible:visibleByFamily[g.family];
  g.instanceTiles=batch;
  g.inst.count=(g.kind==='base'&&terrainOnly)||(g.kind==='top'&&baseOnly)?0:batch.length;
  for(let i=0;i<g.inst.count;i++){
   const t=batch[i];
   matrix.makeTranslation(t.x,0,t.z);
   if(g.kind==='top'){
    tempMatrix.makeRotationY(turn(t));matrix.multiply(tempMatrix);
    if(topForFamily(g.family,g.lod)){
     tempMatrix.makeTranslation(0,terrainLift(g.family),0);matrix.multiply(tempMatrix);
     const scale=terrainScale(g.family);tempMatrix.makeScale(scale,scale,scale);matrix.multiply(tempMatrix);
    }else{tempMatrix.makeTranslation(0,.12,0);matrix.multiply(tempMatrix)}
   }
   matrix.multiply(g.local);g.inst.setMatrixAt(i,matrix);
  }
  if(g.inst.count)g.inst.instanceMatrix.needsUpdate=true;
 }
 const terrainTotals=tileTerrainCounts(tiles);
 currentStats='世界修订：'+hexWorld.revision+' / 地表：荒地 '+terrainTotals.wasteland+' 草地 '+terrainTotals.meadow+'\n地图总格：'+tiles.length+' / 视野内：'+visible.length+
 '\nLOD 0 / 1 / 2 / 3：'+counts.join(' / ')+
 '\n三角面预算：'+(budget/1000000).toFixed(1)+'M'+
 '\nDraw Calls：'+renderer.info.render.calls+
 '\n当前三角面：'+renderer.info.render.triangles+
 '\n相机离地高度：'+height.toFixed(2)+' / 全局缩放档：'+(globalBand+1)+'/5'+
 '\nFPS（约）：'+fpsValue+'\nLOD 切换滞回：±10%'+
 '\n模型：'+loadStatus;
 dirty=false;
}
function load(name,buf){return new Promise((yes,no)=>loader.parse(buf,'',g=>yes(g.scene),no))}
async function apply(entries){
 let n=0;
 for(const [filename,data] of entries){
  try{const obj=await load(filename,data);
   if(/^meadow_lod([1-4])\.glb$/i.test(filename))assets['m'+filename.match(/([1-4])\.glb$/i)[1]]=obj;
   else if(filename.includes('terrain_lod1'))assets.t1=obj;
   else if(filename.includes('terrain_lod2'))assets.t2=obj;
   else if(filename.includes('base_lod1'))assets.b1=obj;
   else if(filename.includes('base_lod2'))assets.b2=obj;
   else if(filename.includes('terrain'))assets.t=obj;
   else continue;n++;
  }catch(e){console.error(filename,e)}
 }
 loadStatus='已读取 '+n+' 份 GLB';
 updateTerrainStatus();
 rebuild();
}
$('files').onchange=async event=>{
 const files=[...event.target.files];if(!files.length)return;
 const entries=[];const ignored=[];
 for(const file of files){
  try{
   if(!/\.glb$/i.test(file.name)){ignored.push(file.name+'（非 GLB）');continue}
   const data=await file.arrayBuffer();
   if(data.byteLength<12||new DataView(data).getUint32(0,true)!==0x46546c67)throw Error('不是有效 GLB 文件头');
   entries.push([file.name,data]);
  }catch(e){ignored.push(file.name+'：'+e.message)}
 }
 if(!entries.length){$('status').textContent='没有有效 GLB：'+ignored.join('、');return}
 // Named LODs and existing base/terrain files use their expected slots.
 const named=entries.filter(([name])=>/^(meadow_lod[1-4]|terrain(?:_lod[12])?|base_lod[12])\.glb$/i.test(name));
 const unknown=entries.filter(([name])=>!named.some(([n])=>n===name));
 if(named.length)await apply(named);
 let accepted=0;
 for(const [name,data] of unknown){
  try{
   const obj=await load(name,data);
   let triangles=0;obj.traverse(o=>{if(o.isMesh&&o.geometry)triangles+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3});
   if(activeTop()){assets.m1=obj;delete assets.m2;delete assets.m3;delete assets.m4}
   else {assets.t=obj;delete assets.t1;delete assets.t2}
   accepted++;
   if(triangles>200000){
    resizeWorld(0);
    $('mode').value='0';
    $('status').textContent='已导入 '+name+'，'+Math.round(triangles).toLocaleString()+' 三角面。为了避免高模瞬间铺满棋盘，已自动切换单格模式。';
   }else $('status').textContent='已导入 '+name+'，'+Math.round(triangles).toLocaleString()+' 三角面。';
  }catch(e){ignored.push(name+'：'+e.message);console.error(name,e)}
 }
 if(accepted){
  const t=activeTop()?assets.m1:assets.t;
  t.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(t);const size=box.getSize(new THREE.Vector3());
  const scale=Math.min(2.5,Math.max(.5,Math.min(1.899/Math.max(.001,size.x),1.656/Math.max(.001,size.z))));
  $('scale').value=scale.toFixed(2);$('scaleV').textContent=$('scale').value;
  loadStatus='手动加载 '+accepted+' 个自定义 GLB；已按底盘宽度初步缩放（尚未通过接缝验收）';
 }
 rebuild();updateTerrainStatus();
 if(ignored.length)$('status').textContent+='；未读取：'+ignored.join('、');
 // A single file picker does not permanently import into the repository.
 event.target.value='';
};
async function autoLoad(){
 const entries=[];
 try {
  const manifest=await fetchTerrainManifest('./terrain-assets.json');
  for(const asset of manifest.assets)for(const f of asset.lods) {
   try {
    const r=await fetch('./models/'+f);
    if(r.ok)entries.push([f,await r.arrayBuffer()]);
   }catch(e){console.warn('Terrain asset unavailable:',f,e)}
  }
  if(entries.length)await apply(entries);
  else {loadStatus='未找到本地模型，使用代理显示';updateTerrainStatus()}
 }catch(e){console.error('Terrain manifest unavailable:',e);loadStatus='清单加载失败，使用代理显示';updateTerrainStatus()}
}

function updateTerrainStatus(){
 if(activeTop()&&!assets.m1){$('status').textContent='草地 GLB 尚未就绪：请在 models 中放 meadow_lod1.glb～meadow_lod4.glb，或使用上方文件选择导入。当前草地使用中性色代理，不能用于评估草地真实画质。';}
 else $('status').textContent=loadStatus+(activeTop()?(assets.m2?'；草地多级 LOD 已就绪':'；已加载草地单一模型，尚未生成真正 LOD'):'；荒地资产已就绪');
}
$('terrainType').addEventListener('change',()=>{const meadow=activeTop();
 if(!$('paintMode')?.checked)for(const tile of hexWorld.snapshot().cells)hexWorld.setTerrain(tile.q,tile.r,meadow?'meadow':'wasteland');$('scale').value=meadow?'1.00':'1.86';$('lift').value=meadow?'0.20':'0.145';$('scaleV').textContent=$('scale').value;$('liftV').textContent=$('lift').value;updateTerrainStatus();rebuild()});
// Click on a terrain instance to paint a single authoritative hex cell.
const paintRaycaster=new THREE.Raycaster(),paintPointer=new THREE.Vector2();
let pointerStart=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0)pointerStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
 if(e.button!==0||!pointerStart)return;
 const movement=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;
 if(movement>5||!$('paintMode')?.checked)return;
 const bounds=renderer.domElement.getBoundingClientRect();
 paintPointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
 paintRaycaster.setFromCamera(paintPointer,camera);
 const intersections=paintRaycaster.intersectObjects(groups.filter(g=>g.inst.count>0).map(g=>g.inst),false);
 for(const hit of intersections){
  const group=groups.find(g=>g.inst===hit.object);
  const tile=group?.instanceTiles[hit.instanceId];
  if(!tile)continue;
  if(hexWorld.setTerrain(tile.q,tile.r,$('terrainType').value)){rebuild();updateTerrainStatus();}
  return;
 }
});
for(const b of document.querySelectorAll('[data-radius]'))b.addEventListener('click',()=>{resizeWorld(Number(b.dataset.radius));rebuild()});
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
