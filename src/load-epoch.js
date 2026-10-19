// Epoch gate for asynchronous asset loads. Only the latest started batch may commit.
// Pure JavaScript so stale-resolution behaviour can be tested without WebGL.
export function createLoadEpoch(){
 let current=0;
 return {
  begin(){return ++current;},
  isCurrent(epoch){return epoch===current;},
  invalidate(){current++;},
  get value(){return current;}
 };
}
