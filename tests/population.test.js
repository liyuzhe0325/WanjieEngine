import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexWorld} from '../src/hex-world.js';
import {createPopulationState,createOrganization,addCitizen,advancePopulationDay,moveOrganization,setOrganizationForm,transferCitizen,validatePopulation,snapshotPopulation} from '../src/population.js';
function setup(terrain='meadow',seed=42){
 const w=createHexWorld(2,terrain),s=createPopulationState(w,{seed});
 const id=createOrganization(s,{food:12},w);
 for(let i=0;i<30;i++)addCitizen(s,id,{ageDays:(20+i%25)*360,aptitude:i%5+1});
 return {w,s,id};
}
test('unique stable citizen IDs and membership',()=>{
 const {w,s,id}=setup();assert.equal(new Set(s.citizens.map(c=>c.id)).size,30);
 assert.ok(s.citizens.every(c=>c.organizationId===id));assert.equal(validatePopulation(s,w),true);
});
test('environment changes aggregate food production',()=>{
 const a=setup('meadow'),b=setup('wasteland');
 const x=advancePopulationDay(a.s,a.w)[0],y=advancePopulationDay(b.s,b.w)[0];
 assert.ok(x.foodGained>y.foodGained);assert.equal(x.workingAdults,30);assert.equal(y.workingAdults,30);
});
test('same seed reproduces same population and events',()=>{
 const a=setup(),b=setup();
 for(let d=0;d<60;d++)assert.deepEqual(advancePopulationDay(a.s,a.w),advancePopulationDay(b.s,b.w));
 assert.deepEqual(a.s,b.s);
});
test('migration, camping, settlement preserve people and stores',()=>{
 const {s,w,id}=setup(),ids=s.citizens.map(c=>c.id);
 moveOrganization(s,id,1,0,w);setOrganizationForm(s,id,'camp');setOrganizationForm(s,id,'settlement');
 assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.equal(s.organizations[0].food,12);
 assert.equal(validatePopulation(s,w),true);
});
test('transfer does not duplicate people and rejects unknown destination',()=>{
 const {s,w}=setup(),other=createOrganization(s,{q:1,r:0},w);
 transferCitizen(s,1,other);assert.equal(s.citizens.length,30);
 assert.equal(s.citizens[0].organizationId,other);assert.throws(()=>transferCitizen(s,1,999));
});
test('snapshots are detached; validation blocks duplicate citizens',()=>{
 const {s,w}=setup(),snapshot=snapshotPopulation(s,w);snapshot.citizens[0].health=1;
 assert.equal(s.citizens[0].health,100);
 const bad=snapshotPopulation(s,w);bad.citizens.push({...bad.citizens[0]});
 assert.throws(()=>validatePopulation(bad,w));
});
test('empty organization remains valid after daily settlement',()=>{
 const w=createHexWorld(),s=createPopulationState(w);createOrganization(s,{},w);
 for(let i=0;i<30;i++)advancePopulationDay(s,w);
 assert.equal(s.organizations[0].food,0);assert.equal(validatePopulation(s,w),true);
});
test('100000 individuals process in a single grouped day',()=>{
 const w=createHexWorld(),s=createPopulationState(w),id=createOrganization(s,{food:50000},w);
 for(let i=0;i<100000;i++)addCitizen(s,id);
 advancePopulationDay(s,w);assert.equal(validatePopulation(s,w),true);
});
