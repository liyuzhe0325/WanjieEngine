import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, stepWorld, spawn, issueOrder, findPath, distance, cell,
  aliveUnits, unitById, snapshot, CAMP, installRule
} from '../experiments/tribe-opening/tribe-sim.js';

// 受控世界：清掉默认单位，按需布置，避免每日刷新干扰
function scenario(units, rule = null) {
  const w = createWorld(1117);
  w.units = [];
  w.nextId = 1;
  w.rule = rule;
  w.offer = false;
  w.encounter = false;
  for (const [team, kind, q, r] of units) spawn(w, team, kind, q, r);
  return w;
}
const run = (w, n) => { for (let i = 0; i < n; i++) stepWorld(w); return w; };
// 只保留布置时的单位，屏蔽「每日刷新野生动物」对单项测试的干扰
function runIsolated(w, n) {
  const keep = new Set(w.units.map((u) => u.id));
  for (let i = 0; i < n; i++) { stepWorld(w); w.units = w.units.filter((u) => keep.has(u.id)); }
  return w;
}
const of = (w, kind) => aliveUnits(w).filter((u) => u.kind === kind);

test('确定性：同种子同输入 60 步结果完全一致', () => {
  const a = run(createWorld(1117), 60);
  const b = run(createWorld(1117), 60);
  assert.deepEqual(snapshot(a), snapshot(b));
});

test('寻路：BFS 绕开水面，不会停在河岸（原贪心实现会永久卡住）', () => {
  const w = scenario([['human', 'hunter', 3, 0]]);
  const h = of(w, 'hunter')[0];
  assert.ok(cell(w, -2, 0).t === 'water', '前提：-2,0 应为水面');
  assert.equal(issueOrder(w, h.id, 'move', { q: -4, r: 0 }), true);
  let minDist = Infinity;
  const keep = new Set([h.id]);
  for (let i = 0; i < 40; i++) {
    stepWorld(w);
    w.units = w.units.filter((u) => keep.has(u.id));
    const u = of(w, 'hunter')[0];
    minDist = Math.min(minDist, distance(u, { q: -4, r: 0 }));
  }
  const after = of(w, 'hunter')[0];
  assert.ok(after, '猎团应存活');
  assert.equal(minDist, 0, `应绕过河抵达目标格，最近距离 ${minDist}`);
  assert.ok(w.logs.some((l) => l.includes('抵达指定位置')), '应记录抵达并收尾');
  assert.equal(after.order, 'auto', '抵达后应恢复自主');
});

test('寻路：目标格被占用时走到相邻格并结束指令（不再永久 move）', () => {
  const w = scenario([['human', 'hunter', 3, 0], ['human', 'guard', 0, 0]]);
  const h = of(w, 'hunter')[0];
  issueOrder(w, h.id, 'move', { q: 0, r: 0 });
  run(w, 12);
  const after = of(w, 'hunter')[0];
  assert.equal(after.order, 'auto', '指令必须收尾');
  assert.equal(distance(after, CAMP), 1, '应停在营地相邻格');
});

test('指令生命周期：攻击目标消失后恢复自主', () => {
  const w = scenario([['human', 'hunter', 3, 0], ['wild', 'wolf', -4, 0]]);
  const h = of(w, 'hunter')[0];
  const wolf = of(w, 'wolf')[0];
  issueOrder(w, h.id, 'attack', { id: wolf.id });
  wolf.hp = 0;
  stepWorld(w);
  assert.equal(unitById(w, h.id).order, 'auto');
});

test('警戒本能：猎团撤离而非硬拼，且不再攻击捕食者', () => {
  // 距离 2：基线猎团会主动开火并挨打，警戒本能的猎团应保持距离、双方都不掉血
  const base = scenario([['human', 'hunter', 4, 0], ['wild', 'wolf', 4, -2]]);
  runIsolated(base, 10);
  const baseHunter = aliveUnits(base).find((u) => u.kind === 'hunter');
  const baseWolf = aliveUnits(base).find((u) => u.kind === 'wolf');

  const cau = scenario([['human', 'hunter', 4, 0], ['wild', 'wolf', 4, -2]], 'caution');
  runIsolated(cau, 10);
  const cHunter = aliveUnits(cau).find((u) => u.kind === 'hunter');
  const cWolf = aliveUnits(cau).find((u) => u.kind === 'wolf');

  assert.ok(cHunter, '警戒本能下猎团应存活');
  assert.ok(baseWolf.hp < 7, `基线应主动攻击狼，实际狼血 ${baseWolf.hp}`);
  assert.ok(baseHunter.hp < 6, `基线应被狼咬，实际猎团血 ${baseHunter.hp}`);
  assert.equal(cWolf.hp, 7, '警戒本能下不应主动攻击狼');
  assert.equal(cHunter.hp, 6, '撤离成功则不应受伤');
  assert.ok(cau.logs.some((l) => l.includes('本能撤离')), '应记录撤离日志');
});

test('集群狩猎：相邻友方时伤害 +2，并能真的打死猎物', () => {
  const base = scenario([['human', 'hunter', 0, 0], ['human', 'guard', 1, 0], ['wild', 'deer', 1, 1]]);
  run(base, 1);
  const baseDeer = aliveUnits(base).find((u) => u.kind === 'deer');
  assert.equal(baseDeer.hp, 1, '基线：3 血 - 2 伤 = 1');

  const pack = scenario([['human', 'hunter', 0, 0], ['human', 'guard', 1, 0], ['wild', 'deer', 1, 1]], 'pack');
  run(pack, 1);
  assert.equal(aliveUnits(pack).filter((u) => u.kind === 'deer').length, 0, '集群狩猎应一次打死鹿');
  assert.ok(pack.logs.some((l) => l.includes('集群狩猎')), '应记录协同 +2 日志');
});

test('集群狩猎：猎团会主动向友方靠拢（规则改变位移，不只是加伤）', () => {
  const w = scenario([['human', 'hunter', 4, 0], ['human', 'guard', 0, 0], ['wild', 'deer', 4, -2]], 'pack');
  const h0 = of(w, 'hunter')[0];
  const d0 = distance(h0, CAMP);
  run(w, 3);
  const h1 = of(w, 'hunter')[0];
  assert.ok(distance(h1, CAMP) < d0, `应向友方/营地靠拢：${d0} → ${distance(h1, CAMP)}`);
});

test('长时间运行不抛错、不产生永久卡住的指令', () => {
  for (const rule of [null, 'caution', 'pack']) {
    const w = createWorld(1117);
    if (rule) installRule(w, rule);
    const h = of(w, 'hunter')[0];
    issueOrder(w, h.id, 'move', { q: -4, r: 0 });
    assert.doesNotThrow(() => run(w, 200));
    for (const u of aliveUnits(w)) {
      if (u.order !== 'auto' && u.order !== 'hold') assert.ok(u.stall < 10, '不得长期卡在未完成指令');
    }
  }
});
