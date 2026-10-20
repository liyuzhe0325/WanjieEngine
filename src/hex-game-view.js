import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {projectHexTiles} from './hex-view-projection.js';

// Game viewport: shares axial world projection with the GLB/LOD viewer.
// Placeholder meshes only. The full GLB/LOD pipeline remains in the experiment until validated.
export function createHexGameView(host,{onPick}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#25313a');
 const camera=new THREE.PerspectiveCamera(45,1,0.1,200);camera.position.set(6,8,12);
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const orbit=new OrbitControls(camera,renderer.domElement);
 orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI/2-0.12;orbit.minDistance=3;orbit.maxDistance=35;
 scene.add(new THREE.HemisphereLight(0xe9efff,0x3e3324,2));
 const sun=new THREE.DirectionalLight(0xffebc9,2);sun.position.set(6,10,8);scene.add(sun);
 const group=new THREE.Group();scene.add(group);
 const geometry=new THREE.CylinderGeometry(.94,.94,.28,6,1).rotateY(Math.PI/6);
 const materials={wasteland:new THREE.MeshStandardMaterial({color:'#94765b',roughness:1}),meadow:new THREE.MeshStandardMaterial({color:'#63845a',roughness:1})};
 const selectedMaterial=new THREE.MeshBasicMaterial({color:'#f4cf83',wireframe:true});
 const selection=new THREE.Mesh(new THREE.CylinderGeometry(.99,.99,.32,6,1).rotateY(Math.PI/6),selectedMaterial);scene.add(selection);selection.visible=false;
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),matrix=new THREE.Matrix4();
 let batches=[],selected=null,down=null;
 host.appendChild(renderer.domElement);
 function draw(world,{selection:current=null,attachments=[]}={}){
  for(const b of batches){group.remove(b.mesh);b.mesh.dispose();}
  batches=[];selected=current;
  const tiles=projectHexTiles(world),attached=new Set(attachments.map(p=>p.q+','+p.r));
  for(const terrain of ['wasteland','meadow']){
   const members=tiles.filter(t=>t.terrain===terrain);
   if(!members.length)continue;
   const mesh=new THREE.InstancedMesh(geometry,materials[terrain],members.length);
   for(let i=0;i<members.length;i++){
    const t=members[i];matrix.makeTranslation(t.x,attached.has(t.q+','+t.r)?0.14:0,t.z);
    mesh.setMatrixAt(i,matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;group.add(mesh);batches.push({mesh,members});
  }
  const t=current&&tiles.find(p=>p.q===current.q&&p.r===current.r);
  selection.visible=!!t;
  if(t)selection.position.set(t.x,0,t.z);
 }
 function resize(){
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{
  if(e.button!==0||!down)return;
  const distance=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;
  if(distance>5)return;
  const rect=canvas.getBoundingClientRect();
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  ray.setFromCamera(pointer,camera);
  const hits=ray.intersectObjects(batches.map(b=>b.mesh));
  for(const hit of hits){
   const batch=batches.find(b=>b.mesh===hit.object);
   const tile=batch?.members[hit.instanceId];
   if(tile){onPick(tile.q,tile.r);break;}
  }
 });
 let stopped=false;
 function frame(){if(stopped)return;requestAnimationFrame(frame);orbit.update();renderer.render(scene,camera);}
 frame();
 return Object.freeze({draw,dispose(){stopped=true;observer.disconnect();orbit.dispose();renderer.dispose();canvas.remove();}});
}
