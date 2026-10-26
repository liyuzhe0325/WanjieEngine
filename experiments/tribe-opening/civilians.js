// 河谷流民：轻量居民层。逻辑 tick 离散推进，不与军事单位抢占战术格。
// 这是可观察的生活行为，不是完整经济/社会 AI。
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const key=(q,r)=>q+","+r;
const dist=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
const homes=[{q:0,r:0},{q:1,r:0},{q:0,r:1},{q:-1,r:0},{q:1,r:-1},{q:0,r:-1}];
export function initCivilians(world,count=20){
  world.civilians=[];
  world.settlement={stage:0,buildingCount:0,work:0,stores:0,homes:1};
  for(let i=0;i<count;i++){
    const p=homes[i%homes.length];
    world.civilians.push({id:"p"+(i+1),q:p.q,r:p.r,home:{q:p.q,r:p.r},state:"idle",job:i%4===0?"builder":"forager",carried:0,work:0});
  }
  world.pop=world.civilians.length;
}
function target(world,c){
  const cells=[...world.map.values()].filter(x=>x.t==="wood"||x.t==="plain");
  cells.sort((a,b)=>{
    const wa=a.t==="wood"?-2:0,wb=b.t==="wood"?-2:0;
    return (dist(c,a)+wa)-(dist(c,b)+wb)||a.q-b.q||a.r-b.r;
  });
  return cells.find(x=>dist(x,{q:0,r:0})>=2&&dist(x,{q:0,r:0})<=4) || c.home;
}
function walk(world,c,dest){
  const open=[{q:c.q,r:c.r}],seen=new Set([key(c.q,c.r)]),prev=new Map(),origin=key(c.q,c.r),goal=key(dest.q,dest.r);
  while(open.length){
    const a=open.shift();if(key(a.q,a.r)===goal)break;
    for(const [dq,dr] of dirs){
      const p={q:a.q+dq,r:a.r+dr},k=key(p.q,p.r),tile=world.map.get(k);
      if(!tile||tile.t==="water"||seen.has(k))continue;
      seen.add(k);prev.set(k,key(a.q,a.r));open.push(p);
    }
  }
  if(!seen.has(goal))return false;
  let at=goal;while(prev.get(at)!==origin&&at!==origin)at=prev.get(at);
  if(at!==origin){const [q,r]=at.split(",").map(Number);c.q=q;c.r=r;}
  return true;
}
export function stepCivilians(world,emit=()=>{}){
  if(!world.civilians)return;
  // 居民非战术单位；每三步行动一次，避免视觉上与战团同速。
  if(world.tick%3!==0)return;
  const place=world.settlement;
  for(const c of world.civilians){
    if(c.carried>0){
      c.state="returning";
      if(dist(c,{q:0,r:0})>1){walk(world,c,{q:0,r:0});continue;}
      world.food+=c.carried;place.stores+=c.carried;c.carried=0;c.state="delivering";
      continue;
    }
    if(c.job==="builder"){
      c.state="building";c.work++;place.work++;
      continue;
    }
    if(!c.destination)c.destination=target(world,c);
    const t=c.destination;
    if(dist(c,t)>0){c.state="foraging";if(!walk(world,c,t))c.destination=null;}
    else{c.carried=1;c.destination=null;c.state="gathering";}
  }
  // 建设节点真实推进，但仅提供可见的聚落成长，不凭空创造军事设施。
  const milestones=[30,90,180,320];
  if(place.buildingCount<milestones.length&&place.work>=milestones[place.buildingCount]){
    place.buildingCount++;place.homes++;
    place.stage=Math.min(3,Math.ceil(place.buildingCount/2));
    emit("流民合力搭起第 "+place.buildingCount+" 座简易居所");
  }
}
export function recruitCivilians(world,count){
  if(!world.civilians)return false;
  // 保留至少两名居民，使生活循环不会因为征兵彻底停摆。
  if(world.civilians.length-count<2)return false;
  world.civilians.splice(-count,count);
  world.pop=world.civilians.length;
  return true;
}
export function returnCivilians(world,count){
  if(!world.civilians)return;
  for(let i=0;i<count;i++){
    const n=world.civilians.length+1,id="p"+(world.tick)+"-"+i;
    world.civilians.push({id,q:0,r:0,home:{q:0,r:0},state:"idle",job:n%4===0?"builder":"forager",carried:0,work:0});
  }
  world.pop=world.civilians.length;
}
