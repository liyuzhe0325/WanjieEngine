// V0.1 independent population simulation for the authoritative axial hex world.
// Citizens have stable IDs; labour is resolved per organization, not per-agent AI.
import {hexCell,validateHexWorld} from './hex-world.js';
const terrains={meadow:{yield:0.28,risk:0.00002},wasteland:{yield:0.07,risk:0.00012}};
const check=(condition,message)=>{if(!condition)throw Error(message);};
const roll=s=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
export function createPopulationState(world,{seed=1}={}){
 validateHexWorld(world);check(Number.isSafeInteger(seed),'Invalid seed');
 return {version:1,day:0,rng:seed>>>0,nextCitizenId:1,nextOrganizationId:1,citizens:[],organizations:[]};
}
export function createOrganization(s,{q=0,r=0,form='mobile',food=0}={},world){
 check(world&&hexCell(world,q,r),'Invalid position');
 check(['mobile','camp','settlement'].includes(form)&&Number.isFinite(food)&&food>=0,'Invalid organization');
 const id=s.nextOrganizationId++;
 s.organizations.push({id,q,r,form,food,foodFraction:0});return id;
}
export function addCitizen(s,organizationId,{species='human',ageDays=7200,health=100,aptitude=1,occupation='unassigned'}={}){
 check(s.organizations.some(o=>o.id===organizationId),'Unknown organization');
 check(species==='human'&&Number.isSafeInteger(ageDays)&&ageDays>=0,'Invalid species or age');
 check(Number.isInteger(health)&&health>=1&&health<=100&&Number.isInteger(aptitude)&&aptitude>=1&&aptitude<=5,'Invalid attributes');
 check(['unassigned','forager','support'].includes(occupation),'Invalid occupation');
 const id=s.nextCitizenId++;s.citizens.push({id,species,ageDays,health,aptitude,occupation,organizationId});return id;
}
export function transferCitizen(s,id,destinationId){
 const c=s.citizens.find(x=>x.id===id);
 check(c&&s.organizations.some(x=>x.id===destinationId),'Invalid transfer');
 c.organizationId=destinationId;
}
export function moveOrganization(s,id,q,r,world){
 const o=s.organizations.find(x=>x.id===id);
 check(o&&hexCell(world,q,r),'Invalid relocation');o.q=q;o.r=r;
 // A low-level location mutation; not a free travel command. Path/time/card costs belong to the command layer.
}
export function setOrganizationForm(s,id,form){
 const o=s.organizations.find(x=>x.id===id);
 check(o&&['mobile','camp','settlement'].includes(form),'Invalid form');o.form=form;
}
export function validatePopulation(s,world){
 validateHexWorld(world);
 check(s?.version===1&&Number.isSafeInteger(s.day)&&s.day>=0,'Invalid population version/day');
 check(Number.isInteger(s.rng)&&s.rng>=0&&s.rng<=0xffffffff,'Invalid random seed state');
 check(Number.isSafeInteger(s.nextCitizenId)&&s.nextCitizenId>=1&&Number.isSafeInteger(s.nextOrganizationId)&&s.nextOrganizationId>=1,'Invalid counters');
 check(Array.isArray(s.citizens)&&Array.isArray(s.organizations),'Invalid collections');
 const orgIds=new Set(),citizenIds=new Set();
 for(const o of s.organizations){
  check(Number.isSafeInteger(o.id)&&o.id>0&&o.id<s.nextOrganizationId&&!orgIds.has(o.id),'Duplicate organization');
  orgIds.add(o.id);
  check(hexCell(world,o.q,o.r)&&['mobile','camp','settlement'].includes(o.form),'Invalid location/form');
  check(Number.isFinite(o.food)&&o.food>=0&&Number.isFinite(o.foodFraction)&&o.foodFraction>=0&&o.foodFraction<1,'Invalid food');
 }
 for(const c of s.citizens){
  check(Number.isSafeInteger(c.id)&&c.id>0&&c.id<s.nextCitizenId&&!citizenIds.has(c.id),'Duplicate citizen');
  citizenIds.add(c.id);
  check(orgIds.has(c.organizationId)&&c.species==='human'&&Number.isSafeInteger(c.ageDays)&&c.ageDays>=0,'Invalid citizen identity');
  check(Number.isInteger(c.health)&&c.health>=1&&c.health<=100&&Number.isInteger(c.aptitude)&&c.aptitude>=1&&c.aptitude<=5,'Invalid citizen attributes');
  check(['unassigned','forager','support'].includes(c.occupation),'Invalid citizen occupation');
 }
 return true;
}
export function advancePopulationDay(s,world){
 validatePopulation(s,world);
 const next=structuredClone(s),events=[],removed=new Set(),byOrg=new Map(next.organizations.map(o=>[o.id,[]]));
 for(const c of next.citizens)byOrg.get(c.organizationId).push(c);
 for(const o of next.organizations){
  const people=byOrg.get(o.id),cell=hexCell(world,o.q,o.r),environment=terrains[cell.terrain];
  const adults=people.filter(c=>c.ageDays>=16*360&&c.health>=30);
  const labour=adults.reduce((n,c)=>n+(0.8+0.1*c.aptitude)*c.health/100,0);
  const producedRaw=labour*environment.yield+o.foodFraction;
  const gained=Math.floor(producedRaw*1000)/1000;
  o.foodFraction=Math.round((producedRaw-gained)*1e9)/1e9;
  const required=people.length*0.16,available=o.food+gained,eaten=Math.min(available,required);
  const shortage=Math.max(0,required-eaten),hunger=required?shortage/required:0;
  o.food=Math.round((available-eaten)*1000)/1000;
  let deaths=0,births=0;
  for(const c of people){
   c.ageDays++;
   const years=c.ageDays/360;
   const risk=Math.min(1,(years>85?0.2:years>70?0.0005:0)+environment.risk*(hunger?1.7:1)+hunger*0.015);
   if(roll(next)<risk){removed.add(c.id);deaths++;continue;}
   c.health=hunger?Math.max(1,c.health-Math.ceil(2*hunger)):Math.min(100,c.health+1);
  }
  if(!hunger&&people.length>=2)for(const c of people){
   if(removed.has(c.id)||c.ageDays<18*360||c.ageDays>=45*360||c.health<70)continue;
   if(roll(next)<0.00012){
    next.citizens.push({id:next.nextCitizenId++,species:c.species,ageDays:0,health:100,aptitude:1+Math.floor(roll(next)*5),occupation:'unassigned',organizationId:o.id});
    births++;
   }
  }
  events.push({type:'daily-organization',organizationId:o.id,terrain:cell.terrain,populationBefore:people.length,workingAdults:adults.length,foodGained:gained,foodConsumed:eaten,foodDeficit:shortage,births,deaths,populationAfter:people.length+births-deaths});
 }
 next.citizens=next.citizens.filter(c=>!removed.has(c.id));
 next.day++;validatePopulation(next,world);Object.assign(s,next);return events;
}
export function snapshotPopulation(s,world){validatePopulation(s,world);return structuredClone(s);}
