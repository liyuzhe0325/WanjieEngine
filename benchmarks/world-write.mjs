// Diagnostic benchmark, not a correctness test or a pass/fail performance gate.
// Run: node benchmarks/world-write.mjs [iterations]
import {performance} from 'node:perf_hooks';
import {createWorld,setCell} from '../src/world.js';
import {createWorldStore} from '../src/world-store.js';
const iterations=Number(process.argv[2]??1000);
if(!Number.isSafeInteger(iterations)||iterations<10||iterations>100000)throw Error('iterations must be 10..100000');
const n=iterations;
function measure(name,setup,write){
  const samples=[];
  for(let round=0;round<6;round++){
    const state=setup();
    const start=performance.now();
    for(let i=0;i<n;i++)write(state,i);
    const elapsed=performance.now()-start;
    if(round>0)samples.push(elapsed);
  }
  samples.sort((a,b)=>a-b);
  return {name,medianMs:+samples[2].toFixed(3),microsecondsPerWrite:+(samples[2]*1000/n).toFixed(2)};
}
const position=i=>[i%24,Math.floor(i/24)%24];
const direct=measure('direct legacy setCell (unsafe reference model)',()=>createWorld(),(w,i)=>{
 const [x,z]=position(i);setCell(w,x,z,{road:!!(i%2)});
});
const guarded=measure('isolated store patchCell (full-copy baseline)',()=>createWorldStore(createWorld()),(store,i)=>{
 const [x,z]=position(i);store.patchCell(x,z,{road:!!(i%2)});
});
console.log(JSON.stringify({node:process.version,iterations,worldCells:576,
 notes:'Warm-up round discarded. Median of five rounds. Machine-dependent; not a GPU or large-world benchmark.',
 results:[direct,guarded],relativeCost:+(guarded.medianMs/direct.medianMs).toFixed(2)},null,2));
