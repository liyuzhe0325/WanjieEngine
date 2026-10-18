import {createWorld,cell} from './world.js';
import {BoardView} from './view.js';
import {createProjectedSimulation} from './card-world-projection.js';
import {getTile,snapshot} from './card-world-experiment.js';
import {createCardQueue} from './card-command-queue.js';
import {previewBarrier} from './card-action-preview.js';
import {describeBarrier} from './card-feedback.js';

// Demonstration-only environmental profile; not authoritative terrain simulation.
// Editor x/z coordinates map to experimental q/r indices without claiming hex adjacency.
const profiles={meadow:{fuel:45,moisture:25},forest:{fuel:85,moisture:12},rock:{fuel:0,moisture:5},water:{fuel:0,moisture:95},blight:{fuel:18,moisture:5}};
const $=id=>document.getElementById(id);
const terrain=createWorld();
const simulation=createProjectedSimulation(terrain,c=>profiles[c.type]);
const queue=createCardQueue(simulation);
const view=new BoardView($('viewport'),terrain);
let chosenCard=null, chosenTarget=null,serial=0;
const labels={meadow:'原野',forest:'森林',rock:'山地',water:'水域',blight:'腐化'};
function info(){
 if(!chosenTarget){$('selected').textContent='点击地图查看地块';return;}
 const {x,z}=chosenTarget,t=getTile(simulation,x,z),c=cell(terrain,x,z);
 $('selected').textContent=`(${x+1}, ${z+1}) · ${labels[c.type]} · 燃料 ${t.fuel} · 湿度 ${t.moisture} · 热量 ${t.heat}${t.burning?' · 燃烧中':''}`;
}
function candidate(){return chosenCard&&chosenTarget?{id:'ui-'+serial,card:chosenCard,q:chosenTarget.x,r:chosenTarget.z}:null;}
function resetPreview(){
 const cmd=candidate();
 $('confirm').disabled=true;
 if(!cmd){$('preview').textContent=chosenCard?'请在棋盘上点击目标地块。':'请先选择一张卡牌。';return;}
 const preview=previewBarrier(simulation,[cmd]);
 if(!preview.ok){$('preview').textContent='操作不可用：'+preview.reason;return;}
 const changes=describeBarrier(preview),at=changes.changes.find(c=>c.q===cmd.q&&c.r===cmd.r);
 const target=preview.after.tiles.find(t=>t.q===cmd.q&&t.r===cmd.r);
 const status=target.burning?'燃烧中':target.moisture>=60?'潮湿':'未燃烧';
 $('preview').textContent=`目标 (${cmd.q+1}, ${cmd.r+1}) · 预测：${status}\n热量 ${target.heat} · 湿度 ${target.moisture} · 燃料 ${target.fuel}\n${at?.note==='ignited'?'预计发生点燃':at?.note==='extinguished'?'预计火焰熄灭':'本目标未出现燃烧状态变化'}\n本轮预计有 ${changes.changedTiles} 个地块发生数值或状态变化（包含自然结算）。`;
 $('confirm').disabled=false;
}
document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{
 chosenCard=b.dataset.card;
 document.querySelectorAll('[data-card]').forEach(other=>other.classList.toggle('on',other===b));
 resetPreview();
});
function chooseTile(x,z){chosenTarget={x,z};view.select(x,z);info();resetPreview();}
$('confirm').onclick=()=>{
 const cmd=candidate();if(!cmd)return;
 const accepted=queue.submit(cmd);
 if(!accepted.ok){$('notice').textContent='出牌失败：'+accepted.reason;resetPreview();return;}
 const result=queue.flush();serial++;
 const feedback=describeBarrier(result),target=getTile(simulation,cmd.q,cmd.r);
 $('turn').textContent='第 '+simulation.tick+' 次结算';
 $('notice').textContent=`已使用「${cmd.card==='spark'?'火种':'降雨'}」，影响 ${feedback.changedTiles} 格；目标${target.burning?'正在燃烧':'未燃烧'}。\n本次世界变化保存在实验规则状态中，不会改写编辑器地貌。`;
 info();resetPreview();
};
function cancel() {chosenCard=null;chosenTarget=null;view.highlight.visible=false;document.querySelectorAll('[data-card]').forEach(b=>b.classList.remove('on'));info();resetPreview();}
$('cancel').onclick=cancel;
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{view.setAngle(Number(b.dataset.angle));document.querySelectorAll('[data-angle]').forEach(other=>other.classList.toggle('on',b===other));});
const canvas=view.renderer.domElement;
let pointer=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,button:e.button,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)pointer.moved=true;if(pointer.button===2||pointer.button===1)view.panFrom(dx,dy);pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(pointer?.button===0&&!pointer.moved){const hit=view.pick(e.clientX,e.clientY);if(hit)chooseTile(hit.x,hit.z);}pointer=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoomBy(e.deltaY);},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();});
window.wanjieGameDebug=()=>({tick:simulation.tick,snapshot:snapshot(simulation),selected:chosenTarget,card:chosenCard});
resetPreview();
