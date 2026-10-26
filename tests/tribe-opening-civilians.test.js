import test from "node:test";
import assert from "node:assert/strict";
import {createWorld,createBarracks,orderTraining,stepWorld} from "../experiments/tribe-opening/tribe-sim.js";
test("civilian opening has twenty visible people and no premade military units",()=>{
 const w=createWorld(1117,{civililians:true,military:true});
 assert.equal(w.civilians.length,20);assert.equal(w.pop,20);
 assert.equal(w.units.filter(u=>u.team==="human").length,0);
});
test("civilian activities produce food and new shelters over time",()=>{
 const w=createWorld(1117,{civilians:true});
 const originalHomes=w.settlement.homes;
 for(let i=0;i<110;i++) stepWorld(w);
 assert.ok(w.settlement.homes>originalHomes);
 assert.ok(w.civilians.some(c=>c.state!=="idle"));
});
test("barracks training recruits actual civilian population",()=>{
 const w=createWorld(1117,{civilians:true,military:true});
 const b=createBarracks(w,0,-1,"reserve");
 assert.ok(b); assert.equal(orderTraining(w,b.id,"hunter").ok,true);
 stepWorld(w);
 assert.equal(w.pop,16); assert.equal(w.civilians.length,16);
 for(let i=0;i<8;i++)stepWorld(w);
 assert.equal(b.garrison.hunter,1);
});
