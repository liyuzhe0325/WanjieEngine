import {cell, setCell, validateWorld} from './world.js';

// First formal gameplay foundation. Deliberately independent of renderer and editor history.
export const STARTING_CARDS = Object.freeze([
  {id:'growth-1',kind:'action',effect:'cultivate',name:'培育'},
  {id:'growth-2',kind:'action',effect:'cultivate',name:'培育'},
  {id:'ward-1',kind:'attachment',effect:'ward',name:'守护'},
]);
const VALID_EFFECTS = new Set(['cultivate','ward']);
export function createGame(world, cards=STARTING_CARDS) {
  validateWorld(world);
  const ids=new Set();
  const inventory=cards.map(card=>{
    if(!card || typeof card.id!=='string'||!card.id||ids.has(card.id)||
      !['action','attachment'].includes(card.kind)||!VALID_EFFECTS.has(card.effect)||
      (card.kind==='action'&&card.effect!=='cultivate')||
      (card.kind==='attachment'&&card.effect!=='ward')) throw Error('Invalid card');
    ids.add(card.id);
    return {id:card.id,kind:card.kind,effect:card.effect,name:String(card.name??card.id),target:null,spent:false};
  });
  return {world,inventory,events:[],revision:0};
}
export function previewCard(game,id,x,z) {
  const card=game.inventory.find(c=>c.id===id),target=cell(game.world,x,z);
  if(!card)return {ok:false,reason:'找不到卡牌'};
  if(card.spent)return {ok:false,reason:'卡牌已使用'};
  if(card.target)return {ok:false,reason:'卡牌已经安装'};
  if(!target)return {ok:false,reason:'目标不在地图内'};
  if(target.type==='water')return {ok:false,reason:'水域暂不支持此操作'};
  if(card.effect==='cultivate'){
    if(target.type==='meadow')return {ok:false,reason:'目标已经是原野'};
    return {ok:true,description:'将目标地块改为原野，并消耗这张行动牌'};
  }
  if(card.effect==='ward')return {ok:true,description:'将守护牌永久安装在这一地块上；当前版本只建立关系，不提供虚假的防护数值'};
  return {ok:false,reason:'尚未实现的卡牌效果'};
}
export function playCard(game,id,x,z){
  const result=previewCard(game,id,x,z);
  if(!result.ok)return result;
  const card=game.inventory.find(c=>c.id===id);
  const event={id:game.events.length+1,cardId:id,effect:card.effect,target:{x,z},before:null,after:null};
  if(card.effect==='cultivate'){
    const before=cell(game.world,x,z);
    event.before={type:before.type,structure:before.structure};
    setCell(game.world,x,z,{type:'meadow',structure:null});
    event.after={type:'meadow',structure:null};
    card.spent=true;
  }else{
    card.target={x,z};
    event.after={attached:true};
  }
  game.revision++;
  game.events.push(event);
  return {ok:true,event};
}
export function attachmentsAt(game,x,z) {
  return game.inventory.filter(c=>c.kind==='attachment'&&c.target?.x===x&&c.target?.z===z);
}
