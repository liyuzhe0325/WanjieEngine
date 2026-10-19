import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,cell,saveWorld} from '../src/world.js';
import {createGame,previewCard,playCard,attachmentsAt} from '../src/game.js';

test('game starts with owned cards and does not edit world',()=>{
  const world=createWorld(11),before=saveWorld(world);
  const game=createGame(world);
  assert.equal(game.inventory.length,3);
  assert.equal(saveWorld(world),before);
});
test('action changes authoritative world, consumes only once, records provenance',()=>{
  const world=createWorld(7),game=createGame(world);
  const target=world.cells.find(c=>c.type==='forest');
  assert.ok(target);
  assert.equal(playCard(game,'growth-1',target.x,target.z).ok,true);
  assert.equal(cell(world,target.x,target.z).type,'meadow');
  assert.equal(game.inventory[0].spent,true);
  assert.equal(game.events[0].cardId,'growth-1');
  assert.equal(playCard(game,'growth-1',target.x,target.z).ok,false);
  assert.equal(game.events.length,1);
});
test('invalid placement does not consume or mutate',()=>{
  const world=createWorld(),game=createGame(world),snapshot=saveWorld(world);
  assert.equal(playCard(game,'growth-1',-1,0).ok,false);
  assert.equal(playCard(game,'ward-1',-1,0).ok,false);
  assert.equal(saveWorld(world),snapshot);
  assert.equal(game.inventory[0].spent,false);
  assert.equal(game.revision,0);
});
test('attachment has one target and does not masquerade as a stat bonus',()=>{
  const world=createWorld(),game=createGame(world);
  const target=world.cells.find(c=>c.type==='forest');
  const prior=saveWorld(world);
  assert.equal(playCard(game,'ward-1',target.x,target.z).ok,true);
  assert.equal(attachmentsAt(game,target.x,target.z).length,1);
  assert.equal(playCard(game,'ward-1',target.x+1,target.z).ok,false);
  assert.equal(saveWorld(world),prior);
});
test('refuse illegal card definitions and existing meadow cultivation',()=>{
  const world=createWorld(),meadow=world.cells.find(c=>c.type==='meadow');
  assert.throws(()=>createGame(world,[{id:'bad',kind:'action',effect:'ward'}]));
  const game=createGame(world);
  assert.equal(previewCard(game,'growth-1',meadow.x,meadow.z).ok,false);
});
