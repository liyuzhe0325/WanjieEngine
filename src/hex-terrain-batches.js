// Deterministic grouping; safe for use by WebGL renderer without mutating world snapshots.
export const TERRAIN_FAMILIES=Object.freeze(['wasteland','meadow']);
export function groupTerrainTiles(tiles){
 const groups={wasteland:[],meadow:[]};
 for(const tile of tiles){
  if(!tile||!Object.hasOwn(groups,tile.terrain))throw Error('Unknown terrain family');
  groups[tile.terrain].push(tile);
 }
 return groups;
}
export function tileTerrainCounts(tiles){
 const groups=groupTerrainTiles(tiles);
 return {wasteland:groups.wasteland.length,meadow:groups.meadow.length};
}
