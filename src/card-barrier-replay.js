// Experimental deterministic barrier replay. No official map or clock integration.
import {createSimulation, snapshot} from './card-world-experiment.js';
import {createCardQueue} from './card-command-queue.js';

function same(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function assertRecord(record,index){
  if(!record || record.kind!=='barrier' || !Array.isArray(record.commands) || !record.after)
    throw Error(`Invalid barrier record at ${index}`);
}

// Rebuild an isolated simulation from the original tiles. A rejected or altered
// command makes replay fail rather than silently producing a plausible result.
export function replayBarriers(initialTiles,records){
  if(!Array.isArray(records)) throw Error('Barrier records must be an array');
  const world=createSimulation(initialTiles);
  const queue=createCardQueue(world);
  const verified=[];
  for(let i=0;i<records.length;i++){
    const record=records[i];
    assertRecord(record,i);
    const before=snapshot(world);
    if(record.before && !same(record.before,before))
      throw Error(`Barrier ${i}: before snapshot mismatch`);
    for(const command of record.commands){
      const result=queue.submit(command);
      if(!result.ok) throw Error(`Barrier ${i}: rejected command (${result.reason})`);
    }
    const actual=queue.flush();
    if(record.tick!==actual.tick || !same(record.after,actual.after) ||
       !same(record.commands,actual.commands) ||
       (record.changes && !same(record.changes,actual.changes)))
      throw Error(`Barrier ${i}: replay diverged`);
    verified.push({index:i,tick:actual.tick,commands:actual.commands.length,changes:actual.changes.length});
  }
  return {snapshot:snapshot(world),verified};
}
