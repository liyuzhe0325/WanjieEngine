// Pure preview for experimental card/world commands.
// Predictions are conditional on the supplied world snapshot and command order.
// The authoritative world and its event journal are never modified.
import {createSimulation,snapshot} from './card-world-experiment.js';
import {createCardQueue} from './card-command-queue.js';

function cloneSimulation(world){
  if(!world || !(world.tiles instanceof Map) || !Array.isArray(world.events) ||
     !Number.isInteger(world.tick) || world.tick<0)
    throw Error('Invalid simulation');
  const clone=createSimulation(snapshot(world).tiles);
  clone.tick=world.tick;
  return clone;
}

export function previewBarrier(world,commands=[]){
  if(!Array.isArray(commands))return {ok:false,reason:'invalid-commands'};
  const simulated=cloneSimulation(world);
  const queue=createCardQueue(simulated);
  for(let index=0;index<commands.length;index++){
    const result=queue.submit(commands[index]);
    if(!result.ok)return {ok:false,index,reason:result.reason};
  }
  const result=queue.flush();
  return {ok:true,preview:true,conditional:true,
    tick:result.tick,commands:result.commands,changes:result.changes,
    before:result.before,after:result.after};
}
