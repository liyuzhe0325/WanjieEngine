// Presentation data only: explain observable differences, not invented causality.
// The caller chooses whether the result is a conditional preview or a committed barrier.
const tileId=t=>t.q+','+t.r;
const stateLabel=t=>t.burning?'burning':t.fuel===0?'depleted':t.moisture>=60?'wet':'stable';
export function describeBarrier(result){
 if(!result || result.ok===false){
   return {ok:false,reason:result?.reason??'invalid-result',messages:[]};
 }
 if(!result.before||!result.after||!Array.isArray(result.before.tiles)||
    !Array.isArray(result.after.tiles)||!Array.isArray(result.commands))
   return {ok:false,reason:'invalid-result',messages:[]};
 const old=new Map(result.before.tiles.map(t=>[tileId(t),t]));
 const changes=[];
 for(const after of result.after.tiles){
   const before=old.get(tileId(after));
   if(!before)continue;
   const deltas={};
   for(const field of ['fuel','moisture','heat']){
     const amount=after[field]-before[field];
     if(amount!==0)deltas[field]=amount;
   }
   const burningChanged=before.burning!==after.burning;
   if(!burningChanged && Object.keys(deltas).length===0)continue;
   const note=burningChanged?(after.burning?'ignited':'extinguished'):
     Object.keys(deltas).length?'environment-changed':'unchanged';
   changes.push({q:after.q,r:after.r,state:stateLabel(after),note,
     burningBefore:before.burning,burningAfter:after.burning,deltas});
 }
 changes.sort((a,b)=>a.q-b.q||a.r-b.r);
 const preview=result.preview===true;
 return {ok:true,kind:preview?'preview':'settlement',
   conditional:preview, tick:result.tick,
   commandCount:result.commands.length,changedTiles:changes.length,
   changes,
   messages:changes.length===0?['no-observable-change']:
     [...new Set(changes.map(x=>x.note))]};
}
