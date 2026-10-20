import test from 'node:test';
import assert from 'node:assert/strict';
import {createHexGame} from '../src/hex-game.js';
import {createHexWorld} from '../src/hex-world.js';

test('game shares hex authoritative world with rendering snapshot',()=>{
 const game=createHexGame(createHexWorld(2,'wasteland'));
 assert.equal(game.world.snapshot().cells.length,19);
 assert.equal(game.preview('cultivate-1',0,0).ok,true);
 assert.equal(game.world.readCell(0,0).terrain,'wasteland');
 assert.equal(game.play('cultivate-1',0,0).ok,true);
 assert.equal(game.world.readCell(0,0).terrain,'meadow');
 assert.equal(game.preview('cultivate-1',1,0).ok,false);
 assert.equal(game.events().length,1);
});
test('illegal target leaves world unchanged',()=>{
 const game=createHexGame();
 const before=game.world.snapshot();
 assert.equal(game.play('cultivate-1',99,99).ok,false);
 assert.deepEqual(game.world.snapshot(),before);
 assert.equal(game.events().length,0);
});
test('attachment targets axial hex coordinate without inventing buffs',()=>{
 const game=createHexGame();
 assert.equal(game.play('ward-1',0,0).ok,true);
 assert.equal(game.attachmentsAt(0,0).length,1);
 assert.equal(game.attachmentsAt(0,0)[0].target.q,0);
 assert.equal(game.preview('ward-1',1,0).ok,false);
});
test('duplicates and incompatible card definitions are rejected',()=>{
 assert.throws(()=>createHexGame(createHexWorld(),[{id:'same',kind:'action',effect:'cultivate'},{id:'same',kind:'action',effect:'cultivate'}]));
 assert.throws(()=>createHexGame(createHexWorld(),[{id:'bad',kind:'action',effect:'ward'}]));
});
