// Pure projection from authoritative hex-world snapshot to rendering coordinates.
import {hexPosition} from './hex-space.js';
import {validateHexWorld} from './hex-world.js';
export function projectHexTiles(world){
  validateHexWorld(world);
  return world.cells.map(({q,r,terrain})=>({q,r,terrain,...hexPosition(q,r)}));
}
