import {createHexGame} from './hex-game.js';
import {createHexGameView} from './hex-game-view.js';
const game=createHexGame();
let selected=null,selectedCard=null;
const $=id=>document.getElementById(id);
const view=createHexGameView($('board'),{onPick(q,r){selected={q,r};render();}});
function render(){
 const snapshot=game.world.snapshot();
 const attachments=game.cards().filter(c=>c.target).map(c=>c.target);
 view.draw(snapshot,{selection:selected,attachments});
 const tile=selected&&game.world.readCell(selected.q,selected.r);
 $('info').textContent=tile?'坐标：'+tile.q+', '+tile.r+'\n地貌：'+(tile.terrain==='meadow'?'草地':'荒地')+'\n挂靠卡牌：'+game.attachmentsAt(tile.q,tile.r).map(c=>c.name).join('、'):'尚未选择地块';
 $('cards').replaceChildren();
 for(const card of game.cards()){
  const button=document.createElement('button');button.className='card'+(selectedCard===card.id?' active':'');button.disabled=card.spent||!!card.target;
  button.textContent=card.name+' · '+(card.spent?'已消耗':card.target?'已安装':card.kind==='action'?'行动':'挂靠');
  button.addEventListener('click',()=>{selectedCard=card.id;render()});$('cards').append(button);
 }
 const preview=selectedCard&&selected?game.preview(selectedCard,selected.q,selected.r):null;
 $('message').textContent=preview?(preview.ok?'可以执行：'+preview.description:'无法执行：'+preview.reason):'先选一张牌，再选目标地块。';
 $('confirm').disabled=!preview?.ok;
 const events=game.events();
 $('events').textContent=events.length?events.map(e=>'#'+e.id+' '+(e.effect==='cultivate'?'培育':'守护挂靠')+' → ('+e.target.q+','+e.target.r+')').join('\n'):'尚无事件';
}
$('confirm').addEventListener('click',()=>{
 if(!selected||!selectedCard)return;
 const result=game.play(selectedCard,selected.q,selected.r);
 if(result.ok)selectedCard=null;
 render();
 if(!result.ok)$('message').textContent='执行失败：'+result.reason;
});
render();
