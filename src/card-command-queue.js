// Experimental command barrier. This module does not control the official game clock.
// Commands are collected, validated against a frozen tile topology, then applied in
// canonical order before a single synchronous world settlement.
import {getTile,playCard,stepSimulation,snapshot} from './card-world-experiment.js';
const CARDS=new Set(['spark','rain']);
function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);}
export function createCardQueue(world){
 if(!world||!(world.tiles instanceof Map)||!Array.isArray(world.events))throw Error('Invalid simulation');
 let pending=[],ids=new Set(),sequence=0;
 return {
  submit({id,card,q,r}={}){
   if(!validId(id))return {ok:false,reason:'invalid-id'};
   if(ids.has(id))return {ok:false,reason:'duplicate-id'};
   if(!CARDS.has(card))return {ok:false,reason:'unknown-card'};
   if(!Number.isInteger(q)||!Number.isInteger(r)||!getTile(world,q,r))return {ok:false,reason:'invalid-target'};
   const command=Object.freeze({id,card,q,r,sequence:sequence++});
   ids.add(id);pending.push(command);
   return {ok:true,id};
  },
  get pending(){return pending.length;},
  flush(){
   // Freeze the command batch. Any later submissions belong to the next barrier.
   const batch=pending;pending=[];const before=snapshot(world);
   const applied=[];
   // Explicit deterministic policy: submission order. No card is a terrain-specific mode.
   for(const cmd of batch){
    const result=playCard(world,cmd.card,cmd.q,cmd.r);
    if(!result.ok)throw Error('Validated command rejected during settlement');
    applied.push({id:cmd.id,card:cmd.card,q:cmd.q,r:cmd.r});
   }
   const resolution=stepSimulation(world);
   const output={kind:'barrier',tick:world.tick,commands:applied,changes:resolution.changes,
     before,after:snapshot(world)};
   // Return independent snapshots, not mutable references to world state.
   return JSON.parse(JSON.stringify(output));
  }
 };
}
