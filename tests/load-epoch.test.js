import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadEpoch} from '../src/load-epoch.js';
test('new load supersedes an older unfinished load',()=>{
 const gate=createLoadEpoch();
 const auto=gate.begin();
 const manual=gate.begin();
 assert.equal(gate.isCurrent(auto),false);
 assert.equal(gate.isCurrent(manual),true);
});
test('epoch invalidation prevents late commit',()=>{
 const gate=createLoadEpoch(),attempt=gate.begin();
 gate.invalidate();
 assert.equal(gate.isCurrent(attempt),false);
});
