// Authoritative axial-hex world data; deliberately independent of legacy square-grid world.js.
import {hexDisk, hexKey, hexNeighbor} from './hex-space.js';
export const HEX_WORLD_VERSION = 1;
export const TERRAIN_KINDS = Object.freeze(['wasteland','meadow']);
export const EDGE_KINDS = Object.freeze(['road','river','ridge']);
const isCoord = v => Number.isInteger(v) && Number.isSafeInteger(v);
const clone = value => JSON.parse(JSON.stringify(value));
const canonicalEdge = (q,r,d) => {
  const b=hexNeighbor(q,r,d), aKey=hexKey(q,r), bKey=hexKey(b.q,b.r);
  return aKey<bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
};
export function createHexWorld(radius=2,terrain='wasteland') {
  if(!TERRAIN_KINDS.includes(terrain))throw Error('Invalid terrain');
  const cells=hexDisk(radius).map(({q,r})=>({q,r,terrain,building:null}));
  return {version:HEX_WORLD_VERSION,radius,cells,edges:{}};
}
export function hexCell(world,q,r) {
  if(!world||!isCoord(q)||!isCoord(r))return null;
  return world.cells.find(t=>t.q===q&&t.r===r)??null;
}
export function getHexEdge(world,q,r,direction){
  if(!hexCell(world,q,r))return null;
  const neighbor=hexNeighbor(q,r,direction);
  if(!hexCell(world,neighbor.q,neighbor.r))return null;
  return world.edges[canonicalEdge(q,r,direction)]??null;
}
export function validateHexWorld(world){
  if(!world||world.version!==HEX_WORLD_VERSION||!isCoord(world.radius)||world.radius<0||world.radius>256||!Array.isArray(world.cells)||!world.edges||typeof world.edges!=='object'||Array.isArray(world.edges))throw Error('Invalid hex world');
  const expected=hexDisk(world.radius), ids=new Set(expected.map(p=>hexKey(p.q,p.r)));
  if(world.cells.length!==ids.size)throw Error('Wrong hex cell count');
  const seen=new Set();
  for(const c of world.cells){
    if(!c||!isCoord(c.q)||!isCoord(c.r)||!ids.has(hexKey(c.q,c.r))||seen.has(hexKey(c.q,c.r))||!TERRAIN_KINDS.includes(c.terrain)||!(c.building===null||typeof c.building==='string'&&c.building.length>0))throw Error('Invalid hex cell');
    seen.add(hexKey(c.q,c.r));
  }
  const validEdges=new Set();
  for(const c of world.cells)for(let d=0;d<6;d++){
    const n=hexNeighbor(c.q,c.r,d);
    if(ids.has(hexKey(n.q,n.r)))validEdges.add(canonicalEdge(c.q,c.r,d));
  }
  for(const [key,type] of Object.entries(world.edges))if(!validEdges.has(key)||!EDGE_KINDS.includes(type))throw Error('Invalid hex edge');
  return true;
}
export function createHexWorldStore(initial=createHexWorld()){
  validateHexWorld(initial);
  let data=clone(initial), revision=0;
  return Object.freeze({
    get revision(){return revision;},
    snapshot(){return clone(data);},
    readCell(q,r){const c=hexCell(data,q,r);return c?clone(c):null;},
    readEdge(q,r,d){return getHexEdge(data,q,r,d);},
    setTerrain(q,r,terrain){
      if(!TERRAIN_KINDS.includes(terrain))throw Error('Invalid terrain');
      const c=hexCell(data,q,r);if(!c)return false;
      if(c.terrain===terrain)return false;
      c.terrain=terrain;revision++;return true;
    },
    setBuilding(q,r,building){
      if(!(building===null||typeof building==='string'&&building.length>0))throw Error('Invalid building');
      const c=hexCell(data,q,r);if(!c)return false;
      if(c.building===building)return false;
      c.building=building;revision++;return true;
    },
    setEdge(q,r,d,type){
      if(!(type===null||EDGE_KINDS.includes(type)))throw Error('Invalid edge type');
      const a=hexCell(data,q,r);if(!a)return false;
      const n=hexNeighbor(q,r,d);if(!hexCell(data,n.q,n.r))return false;
      const key=canonicalEdge(q,r,d), old=data.edges[key]??null;
      if(old===type)return false;
      if(type===null)delete data.edges[key];else data.edges[key]=type;
      revision++;return true;
    },
    replace(next){
      const candidate=typeof next==='string'?JSON.parse(next):clone(next);
      validateHexWorld(candidate);data=clone(candidate);revision++;return revision;
    }
  });
}
