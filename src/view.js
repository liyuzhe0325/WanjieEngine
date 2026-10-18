import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SIZE,CHUNK,cell,key} from './world.js';
const C={meadow:0x8c9275,forest:0x566f5d,rock:0xaaa394,water:0x477b83,blight:0x725d76};
const std=(color,roughness=.96,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const MAT={...Object.fromEntries(Object.entries(C).map(([k,v])=>[k,std(v)])),wood:std(0x3d302a,.76),edge:std(0x816e56,.8),gold:std(0xb8a06e,.35,.65),stone:std(0xbab2a0,.88),roof:std(0x65483e),red:std(0x954f3f),ivory:std(0xc6bba1),trunk:std(0x4b4031),leaves:std(0x516f51),leaves2:std(0x758b66)};
const geoBox=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
function mesh(group,geo,mat,x,y,z){let m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function makeCastle(group,x,y,z){let g=new THREE.Group();g.position.set(x,y,z);group.add(g);mesh(g,new THREE.CylinderGeometry(.48,.54,.12,12),MAT.gold,0,.07,0);mesh(g,geoBox(.69,.5,.56),MAT.stone,0,.42,0);let roof=mesh(g,new THREE.ConeGeometry(.52,.5,4),MAT.roof,0,.91,0);roof.rotation.y=Math.PI/4;for(const dx of [-.32,.32])for(const dz of [-.26,.26]){mesh(g,new THREE.CylinderGeometry(.12,.14,.56,8),MAT.stone,dx,.47,dz);mesh(g,new THREE.ConeGeometry(.19,.35,8),MAT.roof,dx,.93,dz);}return g;}
function makePiece(group,x,y,z){let g=new THREE.Group();g.position.set(x,y,z);group.add(g);mesh(g,new THREE.CylinderGeometry(.27,.31,.13,20),MAT.wood,0,.07,0);mesh(g,new THREE.CylinderGeometry(.23,.25,.07,20),MAT.gold,0,.18,0);mesh(g,new THREE.CylinderGeometry(.13,.16,.42,8),MAT.red,0,.44,0);mesh(g,new THREE.IcosahedronGeometry(.17,1),MAT.ivory,0,.76,0);mesh(g,new THREE.ConeGeometry(.2,.28,6),MAT.gold,0,1,0);mesh(g,geoBox(.06,.58,.07),MAT.gold,-.18,.54,0);return g;}
export class BoardView {
 constructor(host,world){this.host=host;this.world=world;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x242b2b);this.scene.fog=new THREE.FogExp2(0x242b2b,.003);this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.append(this.renderer.domElement);this.camera=new THREE.OrthographicCamera(-18,18,12,-12,.1,160);this.focus=new THREE.Vector3(0,0,0);this.angle=55;this.azimuth=23;this.scale=28;
 this.scene.add(new THREE.HemisphereLight(0xe7e5dd,0x50433c,1.75));let sun=new THREE.DirectionalLight(0xffe2b9,2.45);sun.position.set(-14,28,11);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.shadow.normalBias=.025;this.scene.add(sun);this.scene.add(sun.target);this.sun=sun;
 this.quality='standard';this.composer=null;this.gtao=null;
 this.metrics={frames:0,totalMs:0,lastTime:0,frameMs:0,fps:0,sampleCount:0,drawCalls:0,triangles:0};
 this.renderer.info.autoReset=true;
 this.root=new THREE.Group();this.root.position.set(-world.size/2,0,-world.size/2);this.scene.add(this.root);this.chunks=new Map();this.shared={};const platform=new THREE.Group();this.root.add(platform);const mid=world.size/2;
 const stepped=[{extent:1.12,thick:.16,y:-.66,material:MAT.wood},{extent:.91,thick:.15,y:-.51,material:MAT.gold},{extent:.72,thick:.24,y:-.34,material:MAT.wood},{extent:.32,thick:.08,y:-.17,material:MAT.edge}];
 for(const stage of stepped){const m=mesh(platform,geoBox(world.size+stage.extent,stage.thick,world.size+stage.extent),stage.material,mid,stage.y,mid);m.castShadow=false;}
 const trim=std(0xc4ac7b,.42,.55);
 for(const side of [-1,1]){mesh(platform,geoBox(world.size+.55,.035,.045),trim,mid,-.109,mid+side*(world.size+.45)/2).castShadow=false;mesh(platform,geoBox(.045,.035,world.size+.55),trim,mid+side*(world.size+.45)/2,-.109,mid).castShadow=false;}
 for(const x of [.85,world.size-.85])for(const z of [.85,world.size-.85]){mesh(platform,new THREE.CylinderGeometry(.13,.13,.028,16),MAT.gold,x,-.08,z).castShadow=false;}
 this.highlight=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-.5,.01,-.5],[.5,.01,-.5],[.5,.01,.5],[-.5,.01,.5]].map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xffd18d,depthTest:false}));this.highlight.renderOrder=999;this.highlight.visible=false;this.root.add(this.highlight);this.grid=new THREE.Group();this.root.add(this.grid);this.buildGrid();this.rebuildAll();this.resize();this.positionCamera();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.animate=this.animate.bind(this);this.running=true;requestAnimationFrame(this.animate);
 }
 height(x,z){const x0=Math.max(0,Math.min(this.world.size-1,Math.floor(x))),z0=Math.max(0,Math.min(this.world.size-1,Math.floor(z)));return cell(this.world,x0,z0)?.height||0;}
 buildGrid(){for(const child of [...this.grid.children]){this.grid.remove(child);child.geometry?.dispose();child.material?.dispose();}const material=new THREE.LineBasicMaterial({color:0x302a23,transparent:true,opacity:.22});for(let x=0;x<=this.world.size;x++){const arr=[];for(let z=0;z<=this.world.size*3;z++){const zz=z/3;arr.push(new THREE.Vector3(x,.09+this.height(Math.max(0,x-.001),Math.min(zz,this.world.size-.001)),zz));}this.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),material));}for(let z=0;z<=this.world.size;z++){const arr=[];for(let x=0;x<=this.world.size*3;x++){const xx=x/3;arr.push(new THREE.Vector3(xx,.09+this.height(Math.min(xx,this.world.size-.001),Math.max(0,z-.001)),z));}this.grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),material));}}
 gridVisible(v){this.grid.visible=v;}
 setQuality(preset){
 if(preset!=='standard'&&preset!=='high')throw Error('Unknown rendering preset');
 if(preset===this.quality)return;
 if(preset==='high'){
   if(!this.composer){
     this.composer=new EffectComposer(this.renderer);
     this.composer.addPass(new RenderPass(this.scene,this.camera));
     this.gtao=new GTAOPass(this.scene,this.camera,this.host.clientWidth||innerWidth,this.host.clientHeight||innerHeight);
     this.gtao.output=GTAOPass.OUTPUT.Default;
     this.gtao.blendIntensity=0.75;
     this.composer.addPass(this.gtao);
     this.composer.addPass(new OutputPass());
   }
   this.composer.setSize(this.host.clientWidth||innerWidth,this.host.clientHeight||innerHeight);
 }
 this.quality=preset;
 }
 getMetrics(){return {...this.metrics,preset:this.quality,renderer:this.renderer.capabilities.isWebGL2?'WebGL2':'WebGL',pixelRatio:this.renderer.getPixelRatio()};}

 setPreviewModel(model){this.previewModel=model;this.rebuildChunk(1,1);}
 chunkId(x,z){return `${Math.floor(x/CHUNK)},${Math.floor(z/CHUNK)}`;}
 rebuildAll(){for(let z=0;z<this.world.size;z+=CHUNK)for(let x=0;x<this.world.size;x+=CHUNK)this.rebuildChunk(Math.floor(x/CHUNK),Math.floor(z/CHUNK));}
 rebuildAround(x,z){const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,nz=cz+dz;if(nx>=0&&nz>=0&&nx*CHUNK<this.world.size&&nz*CHUNK<this.world.size)this.rebuildChunk(nx,nz);}this.buildGrid();this.select(x,z);}
 rebuildChunk(cx,cz){const id=`${cx},${cz}`,old=this.chunks.get(id);if(old){this.root.remove(old);old.traverse(o=>{if(o.geometry&&!o.userData.externalAsset)o.geometry.dispose()});}const g=new THREE.Group();this.root.add(g);this.chunks.set(id,g);const x0=cx*CHUNK,z0=cz*CHUNK,x1=Math.min(x0+CHUNK,this.world.size),z1=Math.min(z0+CHUNK,this.world.size);const vertices=[],colors=[],indices=[];const color=new THREE.Color();for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const samples=[cell(this.world,Math.min(x,this.world.size-1),Math.min(z,this.world.size-1)),cell(this.world,Math.max(0,x-1),Math.max(0,z-1)),cell(this.world,Math.max(0,x-1),Math.min(z,this.world.size-1)),cell(this.world,Math.min(x,this.world.size-1),Math.max(0,z-1))];let h=samples.reduce((s,c)=>s+c.height,0)/4;vertices.push(x,h,z);const colorsHere=samples.map(c=>new THREE.Color(C[c.type]));color.setRGB(colorsHere.reduce((sum,c)=>sum+c.r,0)/4,colorsHere.reduce((sum,c)=>sum+c.g,0)/4,colorsHere.reduce((sum,c)=>sum+c.b,0)/4);const tint=.88+.12*Math.sin(x*1.71+z*.93)*Math.cos(z*1.37-x*.61);colors.push(color.r*tint,color.g*tint,color.b*tint);}let w=x1-x0+1;for(let z=0;z<z1-z0;z++)for(let x=0;x<x1-x0;x++){let i=z*w+x;indices.push(i,i+w,i+1,i+1,i+w,i+w+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const terrain=mesh(g,geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,side:THREE.DoubleSide}),0,0,0);terrain.castShadow=false;terrain.userData.terrain=true;
 const trees=[],rocks=[],dummy=new THREE.Object3D();for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const c=cell(this.world,x,z),r=((x*73856093^z*19349663^this.world.seed)>>>0)/4294967295;if(c.type==='forest'){for(let j=0;j<3;j++){const v=((r*997+j*.3811)%1),ox=((v*17.7)%1-.5)*.7,oz=((v*41.3)%1-.5)*.7;trees.push([x+.5+ox,c.height,z+.5+oz,.64+v*.55]);}}if(c.type==='rock')for(let j=0;j<2;j++){let a=(r+j*.51)%1;rocks.push([x+.2+a*.6,c.height,z+.2+((a*7)%1)*.6,.23+a*.28]);}if(c.road){mesh(g,geoBox(.72,.026,.25),MAT.edge,x+.5,c.height+.08,z+.5).castShadow=false;}if(c.structure)makeCastle(g,x+.5,c.height,z+.5);}
 const inst=(items,geometry,material,offset=0)=>{if(!items.length)return;let m=new THREE.InstancedMesh(geometry,material,items.length);items.forEach(([x,y,z,s],i)=>{dummy.position.set(x,y+offset*s,z);dummy.scale.set(s,s,s);dummy.rotation.set(0,(i*1.7)%6.28,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;g.add(m);};// Layered faceted foliage makes separate canopy volumes rather than a repeated cone forest.
 const foliageGeometry=new THREE.IcosahedronGeometry(.37,1);
 const lowerCanopies=trees.map(([x,y,z,s],i)=>[x-.07*s,y+.31*s,z+.03*s,s*1.0]);
 const upperCanopies=trees.map(([x,y,z,s],i)=>[x+.045*s,y+.51*s,z-.035*s,s*.77]);
 inst(trees,new THREE.CylinderGeometry(.048,.082,.55,6),MAT.trunk,.31);
 inst(lowerCanopies,foliageGeometry,MAT.leaves,0);
 inst(upperCanopies,new THREE.IcosahedronGeometry(.31,1),MAT.leaves2,0);
 // Stone outcrops are wider, low and angular, not repeated round pebbles.
 inst(rocks,new THREE.DodecahedronGeometry(.84,0),MAT.stone,.10);
 inst(rocks.map(([x,y,z,s])=>[x+.09*s,y+.20*s,z-.04*s,s*.72]),new THREE.ConeGeometry(.68,.9,5),MAT.stone,0);
 if(cx===1&&cz===1){const y=cell(this.world,12,12).height;if(this.previewModel){const copy=this.previewModel.clone(true);copy.position.set(12.5,y,12.5);copy.traverse(o=>{if(o.isMesh){o.userData.externalAsset=true;o.castShadow=true;o.receiveShadow=true;}});g.add(copy);}else makePiece(g,12.5,y,12.5);}
 }
 select(x,z){const c=cell(this.world,x,z);if(!c)return;this.selected=[x,z];this.highlight.visible=true;this.highlight.position.set(x+.5,c.height+.13,z+.5);}
 resize(){const w=this.host.clientWidth||innerWidth,h=this.host.clientHeight||innerHeight;const aspect=w/h;this.camera.left=-this.scale*aspect/2;this.camera.right=this.scale*aspect/2;this.camera.top=this.scale/2;this.camera.bottom=-this.scale/2;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);if(this.composer)this.composer.setSize(w,h);}
 positionCamera(){const elev=THREE.MathUtils.degToRad(this.angle),az=THREE.MathUtils.degToRad(this.azimuth),dist=60;this.camera.position.copy(this.focus).add(new THREE.Vector3(Math.sin(az)*Math.cos(elev)*dist,Math.sin(elev)*dist,Math.cos(az)*Math.cos(elev)*dist));this.camera.up.set(0,1,0);this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();}
 setAngle(n){this.angle=n;this.positionCamera();} zoomBy(delta){this.scale=THREE.MathUtils.clamp(this.scale*Math.exp(delta*.001),6,50);this.resize();}
 panFrom(dx,dy){const worldWidth=this.camera.right-this.camera.left,worldHeight=this.camera.top-this.camera.bottom;const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrix,0);const up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrix,1);right.y=0;up.y=0;up.normalize();this.focus.addScaledVector(right,-dx/this.host.clientWidth*worldWidth);this.focus.addScaledVector(up,dy/this.host.clientHeight*worldHeight/Math.max(.35,Math.sin(THREE.MathUtils.degToRad(this.angle))));this.focus.x=THREE.MathUtils.clamp(this.focus.x,-this.world.size*.45,this.world.size*.45);this.focus.z=THREE.MathUtils.clamp(this.focus.z,-this.world.size*.45,this.world.size*.45);this.positionCamera();}
 pick(clientX,clientY){const rect=this.renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),r=new THREE.Raycaster();r.setFromCamera(mouse,this.camera);const terrain=[];for(const g of this.chunks.values())for(const child of g.children)if(child.userData.terrain)terrain.push(child);const hits=r.intersectObjects(terrain,false);if(!hits.length)return null;let p=hits[0].point;const x=Math.floor(p.x+this.world.size/2),z=Math.floor(p.z+this.world.size/2);return cell(this.world,x,z)?{x,z}:null;}
 animate(t=0){if(!this.running)return;
 const m=this.metrics;
 if(m.lastTime){const dt=t-m.lastTime;if(Number.isFinite(dt)&&dt>0){m.totalMs+=dt;m.frames++;m.sampleCount++;if(m.frames>=6){m.frameMs=m.totalMs/m.frames;m.fps=1000/m.frameMs;m.totalMs=0;m.frames=0;}}}
 m.lastTime=t;
 if(this.quality==='high'&&this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
 m.drawCalls=this.renderer.info.render.calls;m.triangles=this.renderer.info.render.triangles;
 requestAnimationFrame(this.animate);
 }
 resetWorld(w){this.world=w;for(let g of this.chunks.values()){this.root.remove(g);g.traverse(o=>{if(o.geometry&&!o.userData.externalAsset)o.geometry.dispose()});}this.chunks.clear();this.rebuildAll();this.highlight.visible=false;this.selected=null;}
 }