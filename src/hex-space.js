// Axial hex-space contract. No Three.js, GLB, DOM, or simulation dependency.
// These spacings preserve the current hex-assembly-lod viewer layout.
export const HEX_X_STEP = 1.42;
export const HEX_Z_STEP = 1.646;
export const HEX_DIRECTIONS = Object.freeze([
  Object.freeze([1,0]),Object.freeze([1,-1]),Object.freeze([0,-1]),
  Object.freeze([-1,0]),Object.freeze([-1,1]),Object.freeze([0,1])
]);
export const hexKey = (q,r) => `${q},${r}`;
export function hexDistance(a,b) {
  return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs((a.q+a.r)-(b.q+b.r)));
}
export function hexPosition(q,r) {
  if(!Number.isInteger(q)||!Number.isInteger(r)) throw Error('Invalid hex coordinate');
  return {x:HEX_X_STEP*q,z:HEX_Z_STEP*(r+q/2)};
}
export function hexNeighbor(q,r,direction) {
  if(!Number.isInteger(q)||!Number.isInteger(r)||!Number.isInteger(direction)||direction<0||direction>5)
    throw Error('Invalid hex neighbor');
  const [dq,dr]=HEX_DIRECTIONS[direction];
  return {q:q+dq,r:r+dr};
}
export function hexDisk(radius) {
  if(!Number.isInteger(radius)||radius<0||radius>256) throw Error('Invalid hex radius');
  const tiles=[];
  for(let q=-radius;q<=radius;q++)
    for(let r=Math.max(-radius,-q-radius);r<=Math.min(radius,-q+radius);r++)
      tiles.push({q,r,...hexPosition(q,r)});
  return tiles;
}
