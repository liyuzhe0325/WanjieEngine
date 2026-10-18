// Pure deterministic world model; no browser or rendering dependencies.
export const SIZE = 24, CHUNK = 8;
export const TYPES = ['meadow','forest','rock','water','blight'];
export const key=(x,z)=>`${x},${z}`;
export function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function createWorld(seed=7319){let rand=rng(seed),cells=[];for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
const ridge=Math.exp(-Math.pow((x-6.1-1.5*Math.sin(z*.31))/3.6,2));const creek=12.8+2.2*Math.sin(z*.29)+.65*Math.sin(z*.77);
const height=Math.max(.04,.1+ridge*(1.05+.4*Math.sin(z*.38+.7)**2)+.15*Math.sin(x*.53)*Math.cos(z*.47)-.27*Math.exp(-Math.pow((x-creek)/1.1,2)));
let type=Math.abs(x-creek)<.65?'water':ridge>.68?'rock':(x>creek+1.5&&Math.sin(x*.38)+Math.cos(z*.31)>-.2)||rand()>.87?'forest':'meadow';
cells.push({x,z,height:+height.toFixed(3),type,road:false,structure:null});}
return {version:1,seed,size:SIZE,cells};}
export const cell=(world,x,z)=>(x>=0&&z>=0&&x<world.size&&z<world.size)?world.cells[z*world.size+x]:null;
export function setCell(world,x,z,patch){const c=cell(world,x,z);if(!c)return null;const before={...c};if(patch.type && !TYPES.includes(patch.type))throw new Error('Invalid terrain');Object.assign(c,patch);return {x,z,before,after:{...c}};}
export function applyTool(world,x,z,tool){const c=cell(world,x,z);if(!c)return null;const patch={};switch(tool){case'forest':patch.type='forest';break;case'meadow':patch.type='meadow';patch.structure=null;break;case'road':patch.road=!c.road;break;case'blight':patch.type='blight';break;case'castle':patch.structure=c.structure?null:'castle';break;default:return null;}return setCell(world,x,z,patch);}
export function validateWorld(w){if(!w||w.version!==1||!Number.isInteger(w.size)||w.size<1||w.size>256||!Array.isArray(w.cells)||w.cells.length!==w.size*w.size)throw Error('Invalid world');const seen=new Set();for(const c of w.cells){if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=w.size||c.z>=w.size||seen.has(key(c.x,c.z))||!Number.isFinite(c.height)||c.height<0||c.height>10||!TYPES.includes(c.type)||typeof c.road!=='boolean'||(c.structure!==null&&c.structure!=='castle'))throw Error('Invalid cell');seen.add(key(c.x,c.z));}return true;}
export function history(world){let undo=[],redo=[];return {apply(x,z,tool){const d=applyTool(world,x,z,tool);if(d){undo.push(d);redo=[];}return d;},undo(){const d=undo.pop();if(!d)return null;setCell(world,d.x,d.z,d.before);redo.push(d);return d;},redo(){const d=redo.pop();if(!d)return null;setCell(world,d.x,d.z,d.after);undo.push(d);return d;},clear(){undo=[];redo=[];},get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;}};}
export function saveWorld(w){validateWorld(w);return JSON.stringify(w);}
export function loadWorld(raw){const w=JSON.parse(raw);validateWorld(w);return w;}