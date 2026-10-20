import {createHexWorld,createHexWorldStore} from './hex-world.js';

export const HEX_STARTING_CARDS=Object.freeze([
 Object.freeze({id:'cultivate-1',name:'培育',kind:'action',effect:'cultivate'}),
 Object.freeze({id:'cultivate-2',name:'培育',kind:'action',effect:'cultivate'}),
 Object.freeze({id:'ward-1',name:'守护',kind:'attachment',effect:'ward'})
]);
const clone=x=>JSON.parse(JSON.stringify(x));
export function createHexGame(initial=createHexWorld(2),definitions=HEX_STARTING_CARDS){
 const world=createHexWorldStore(initial),used=new Set();
 const cards=definitions.map(c=>{
  if(!c||typeof c.id!=='string'||!c.id||used.has(c.id)||!((c.kind==='action'&&c.effect==='cultivate')||(c.kind==='attachment'&&c.effect==='ward')))throw Error('Invalid card definition');
  used.add(c.id);return {id:c.id,name:String(c.name||c.id),kind:c.kind,effect:c.effect,spent:false,target:null};
 });
 const events=[];
 function preview(id,q,r){
  const c=cards.find(v=>v.id===id);
  if(!c)return {ok:false,reason:'找不到卡牌'};
  if(c.spent||c.target)return {ok:false,reason:'卡牌已使用或安装'};
  const tile=world.readCell(q,r);
  if(!tile)return {ok:false,reason:'地块不存在'};
  if(c.effect==='cultivate'){
   if(tile.terrain==='meadow')return {ok:false,reason:'这里已经是草地'};
   return {ok:true,description:'将此地块转化为草地，行动牌使用后消耗'};
  }
  return {ok:true,description:'把守护牌挂在此地块；现阶段只建立关系，不提供虚假的防御效果'};
 }
 function play(id,q,r){
  const result=preview(id,q,r);
  if(!result.ok)return result;
  const c=cards.find(v=>v.id===id),before=world.readCell(q,r);
  if(c.effect==='cultivate'){world.setTerrain(q,r,'meadow');c.spent=true;}
  else c.target={q,r};
  const event={id:events.length+1,cardId:id,effect:c.effect,target:{q,r},before,after:world.readCell(q,r)};
  events.push(clone(event));return {ok:true,event:clone(event)};
 }
 return Object.freeze({
  world,preview,play,
  cards:()=>clone(cards),
  events:()=>clone(events),
  attachmentsAt:(q,r)=>clone(cards.filter(c=>c.target?.q===q&&c.target?.r===r))
 });
}
