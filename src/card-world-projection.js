// Read-only boundary from the editor's square x/z cells into experimental q/r tiles.
// Coordinate identity is preserved, NOT hex geometry or an authoritative world link.
import {validateWorld} from './world.js';
import {createSimulation} from './card-world-experiment.js';

const integer=(n)=>Number.isInteger(n)&&n>=0&&n<=100;
export function projectWorldTiles(world,resolveEnvironment){
  validateWorld(world);
  if(typeof resolveEnvironment!=='function')throw TypeError('Environment resolver required');
  const tiles=[];
  for(const cell of world.cells){
    // Detached primitive input prevents accidental mutation of editor cells.
    const input=Object.freeze({
      x:cell.x,z:cell.z,height:cell.height,type:cell.type,
      road:cell.road,structure:cell.structure
    });
    const env=resolveEnvironment(input);
    if(!env||!integer(env.fuel)||!integer(env.moisture)||
       (env.heat!==undefined&&!integer(env.heat))||
       (env.burning!==undefined&&typeof env.burning!=='boolean'))
      throw Error(`Invalid environment at ${cell.x},${cell.z}`);
    tiles.push({q:cell.x,r:cell.z,fuel:env.fuel,moisture:env.moisture,
      heat:env.heat??0,burning:env.burning??false});
  }
  return tiles;
}
export function createProjectedSimulation(world,resolveEnvironment){
  return createSimulation(projectWorldTiles(world,resolveEnvironment));
}
