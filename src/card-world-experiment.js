// Experimental deterministic card/world interaction kernel. No rendering, UI or map writes.
// This is a *small mechanics test*, not the official card economy or time system.
export const hexKey = (q,r) => q + ',' + r;
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
function copyTile(t){return {q:t.q,r:t.r,fuel:t.fuel,moisture:t.moisture,heat:t.heat??0,burning:!!t.burning};}
function check(t){
  if(!Number.isInteger(t.q)||!Number.isInteger(t.r))throw Error('Invalid coordinate');
  for(const k of ['fuel','moisture'])if(!Number.isInteger(t[k])||t[k]<0||t[k]>100)throw Error('Invalid '+k);
  if(t.heat!==undefined&&(!Number.isInteger(t.heat)||t.heat<0||t.heat>100))throw Error('Invalid heat');
}
export function createSimulation(tiles){
  if(!Array.isArray(tiles)||tiles.length===0)throw Error('Tiles required');
  const map=new Map();
  for(const item of tiles){check(item);const k=hexKey(item.q,item.r);if(map.has(k))throw Error('Duplicate tile');map.set(k,copyTile(item));}
  return {tick:0,tiles:map,events:[]};
}
export function getTile(world,q,r){return world.tiles.get(hexKey(q,r))??null;}
export function playCard(world,card,q,r){
  const t=getTile(world,q,r);if(!t)return {ok:false,reason:'outside'};
  // Cards describe a physical intervention, not a terrain-specific outcome menu.
  if(card==='spark')t.heat=clamp(t.heat+55,0,100);
  else if(card==='rain')t.moisture=clamp(t.moisture+45,0,100);
  else return {ok:false,reason:'unknown-card'};
  const event={tick:world.tick,kind:'card',card,q,r};world.events.push(event);
  return {ok:true,event};
}
// All decisions use the previous snapshot. Tile iteration order cannot influence spreading.
export function stepSimulation(world){
  const before=new Map([...world.tiles].map(([k,t])=>[k,{...t}]));
  const changes=[];
  const next=new Map();
  for(const [k,t] of before){
    let moisture=clamp(t.moisture-2,0,100);
    let heat=clamp(t.heat-12,0,100);
    let fuel=t.fuel;
    let burning=t.burning;
    const ignite=t.fuel>0&&t.moisture<=35&&t.heat>=40;
    const neighbors=DIRS.map(([dq,dr])=>before.get(hexKey(t.q+dq,t.r+dr))).filter(Boolean);
    const spread=neighbors.some(n=>n.burning&&n.fuel>0)&&t.fuel>=15&&t.moisture<=20;
    if(ignite||spread)burning=true;
    if(burning){
      if(t.moisture>=60){burning=false;heat=clamp(heat-20,0,100);}
      else {fuel=clamp(fuel-12,0,100);heat=clamp(heat+16,0,100);moisture=clamp(moisture-6,0,100);}
      if(fuel===0)burning=false;
    }
    const result={q:t.q,r:t.r,fuel,moisture,heat,burning};
    next.set(k,result);
    if(JSON.stringify(t)!==JSON.stringify(result))changes.push({q:t.q,r:t.r,before:t,after:result});
  }
  world.tiles=next;world.tick++;
  const event={tick:world.tick,kind:'settlement',changes};world.events.push(event);
  return event;
}
export function snapshot(world){return {tick:world.tick,tiles:[...world.tiles.values()].map(t=>({...t})).sort((a,b)=>a.q-b.q||a.r-b.r)};}
