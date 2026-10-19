// Isolated ownership boundary for the legacy square-grid world model.
// Not the future civilization/hex world schema; no renderer dependencies.
import {createWorld,loadWorld,saveWorld,setCell,cell,validateWorld} from './world.js';
const clone=value=>JSON.parse(JSON.stringify(value));

export function createWorldStore(initialWorld=createWorld()){
  validateWorld(initialWorld);
  let state=loadWorld(saveWorld(initialWorld));
  let revision=0;
  return Object.freeze({
    get revision(){return revision;},
    snapshot(){return clone(state);},
    readCell(x,z){const value=cell(state,x,z);return value?{...value}:null;},
    patchCell(x,z,patch){
      // Validate and commit only on an isolated candidate. Never expose
      // authoritative cell references or partially modify the current world.
      const next=loadWorld(saveWorld(state));
      const change=setCell(next,x,z,patch);
      if(!change)return null;
      validateWorld(next);
      state=next;revision++;
      return clone({...change,revision});
    },
    replaceWorld(raw){
      const next=typeof raw==='string'?loadWorld(raw):loadWorld(saveWorld(raw));
      state=next;revision++;
      return revision;
    }
  });
}
