import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, stepWorld, spawn, createBarracks, orderTraining, setStance,
  deployFromGarrison, stepBarracks, issueOrder, distance, cell, aliveUnits,
  snapshot, CAMP, MILITARY, DEPLOY, passable, unitAt
} from '../experiments/tribe-opening/tribe-sim.js';

function mil(opts = {}) {
  const w = createWorld(1117, { military: true, orderDelay: 0, ...opts });
  w.units = [];
  w.nextId = 1;
  w.food = 200;
  w.rule = null;
  w.offer = false;
  w.encounter = false;
  return w;
}
const of = (w, kind) => aliveUnits(w).filter((u) => u.kind === kind);
const run = (w, n, keepIds = null) => {
  for (let i = 0; i < n; i++) {
    stepWorld(w);
    if (keepIds) w.units = w.units.filter((u) => keepIds.has(u.id));
  }
  return w;
};
const idsOf = (w) => new Set(w.units.map((u) => u.id));

// ——————————————————— 兵营：实体、生产、出营 ———————————————————

test('兵营是实体建筑：占格、阻挡通行、不能叠放', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'hold');
  assert.ok(b, '应能设立兵营');
  assert.equal(passable(w, 0, -1), false, '兵营所在格不可通行');
  assert.equal(createBarracks(w, 0, -1), null, '同格不可叠放');
  assert.equal(createBarracks(w, -2, 0), null, '水面不可设立');
  assert.equal(w.barracks.length, 1);
});

test('训练：排队 → 扣食物 → 固定 tick 后进入驻军池（不直接上地图）', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'reserve');
  const food0 = w.food;
  orderTraining(w, b.id, 'hunter');
  stepWorld(w);
  assert.equal(w.food, food0 - MILITARY.trainCost.hunter, '开始训练即扣食物');
  assert.ok(b.training, '应进入训练中');
  assert.equal(aliveUnits(w).length, 0, '训练期间不得凭空出现棋子');
  run(w, MILITARY.trainTicks.hunter - 1);
  assert.equal(b.garrison.hunter, 1, `${MILITARY.trainTicks.hunter} 步后进入驻军池`);
  assert.equal(aliveUnits(w).length, 0, '驻军池中的部队不在地图上');
});

test('出营：落在相邻格，并把兵营记为驻守点', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'reserve');
  b.garrison.hunter = 1;
  const res = deployFromGarrison(w, b, 'hunter');
  assert.equal(res.ok, true);
  const u = aliveUnits(w)[0];
  assert.equal(distance(u, b), 1, '应落在兵营相邻格');
  assert.deepEqual(u.post, { q: 0, r: -1 }, '驻守点 = 兵营');
  assert.equal(b.garrison.hunter, 0);
  assert.equal(b.produced, 1);
});

// ——————————————————— 方针：四条，全部只看距离与计数 ———————————————————

test('方针 reserve：驻军再多也不出营', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'reserve');
  b.garrison.hunter = 3;
  spawn(w, 'wild', 'wolf', 2, -1);           // 就在兵营 2 格内
  run(w, 5, new Set(w.units.map((u) => u.id)));
  assert.equal(aliveUnits(w).filter((u) => u.team === 'human').length, 0, '保留预备不得自动出营');
  assert.equal(b.garrison.hunter, 3);
});

test('方针 hold：敌人进入 3 格才出营', () => {
  const far = mil();
  const bf = createBarracks(far, 0, -1, 'hold');
  bf.garrison.guard = 1;
  spawn(far, 'wild', 'wolf', 4, -2);         // 离兵营 >3
  const keepF = idsOf(far);
  run(far, 6, keepF);
  assert.equal(of(far, 'guard').length, 0, '威胁在 3 格外不应出营');

  const near = mil();
  const bn = createBarracks(near, 0, -1, 'hold');
  bn.garrison.guard = 1;
  spawn(near, 'wild', 'wolf', 2, -1);         // 离兵营 2 格
  run(near, 3);
  assert.ok(of(near, 'guard').length >= 1, '威胁进入 3 格应出营迎战');
});

test('方针 patrol：附近没有我方部队时出一支，有了就停', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'patrol');
  b.garrison.hunter = 3;
  run(w, 1);
  assert.equal(of(w, 'hunter').length, 1, '空场应出一支');
  run(w, 4);
  assert.equal(of(w, 'hunter').length, 1, '已有我方在附近则不再出');
});

test('方针 reinforce：在野战团少于 2 支时补员', () => {
  const w = mil();
  const b = createBarracks(w, 0, -1, 'reinforce');
  b.garrison.hunter = 3;
  run(w, 3);
  assert.equal(of(w, 'hunter').length, 2, '补到 2 支即停');
  run(w, 5);
  assert.equal(of(w, 'hunter').length, 2, '不应超过阈值');
});

test('同屏预算：达到 fieldCap 后不再出营', () => {
  const w = mil({ fieldCap: 2 });
  const b = createBarracks(w, 0, -1, 'reserve');
  b.garrison.hunter = 3;
  assert.equal(deployFromGarrison(w, b, 'hunter').ok, true);
  assert.equal(deployFromGarrison(w, b, 'hunter').ok, true);
  const third = deployFromGarrison(w, b, 'hunter');
  assert.equal(third.ok, false);
  assert.equal(third.reason, 'field-cap');
  assert.equal(aliveUnits(w).filter((u) => u.team === 'human').length, 2);
  assert.equal(b.garrison.hunter, 1, '被拒的部队留在驻军池');
});

// ——————————————————— 命令延迟（P4 的实验基础） ———————————————————

test('命令延迟：下令后不立即生效，到点才切换', () => {
  const w = mil({ orderDelay: 2 });
  const u = spawn(w, 'human', 'hunter', 3, 0);
  issueOrder(w, u.id, 'move', { q: 0, r: 1 });
  assert.equal(u.order, 'auto', '在途期间仍按自主规则行动');
  assert.equal(u.pending.at, w.tick + 2);
  stepWorld(w);
  assert.equal(u.order, 'auto', '1 步后仍未生效');
  stepWorld(w);
  assert.equal(u.order, 'move', '2 步后生效');
  assert.equal(u.pending, null);
});

test('命令延迟：离营超过 4 格额外 +1 步', () => {
  const w = mil({ orderDelay: 2 });
  const near = spawn(w, 'human', 'hunter', 1, 0);
  const far = spawn(w, 'human', 'hunter', 5, -1);
  issueOrder(w, near.id, 'hold', { q: 1, r: -1 });
  issueOrder(w, far.id, 'hold', { q: 4, r: -1 });
  assert.equal(near.pending.at - w.tick, 2);
  assert.equal(far.pending.at - w.tick, 3, '远离营地应更慢');
});

test('P4 对照：同一次救场，有延迟就救不下来', () => {
  function rescue(delay) {
    const w = mil({ orderDelay: delay });
    const h = spawn(w, 'human', 'hunter', 4, 0);
    spawn(w, 'wild', 'wolf', 4, -1);       // 与猎团相邻，每 3 步咬 2 点
    const keep = idsOf(w);
    issueOrder(w, h.id, 'move', { q: 1, r: 0 });   // 立刻撤回营地
    run(w, 8, keep);
    const after = of(w, 'hunter')[0];
    return { hp: after ? after.hp : 0, alive: !!after };
  }
  const instant = rescue(0);
  const delayed = rescue(3);
  assert.equal(instant.alive, true, '即时命令应能撤走');
  assert.equal(delayed.alive, true, '延迟臂的棋子也应存活（不许用死亡作弊）');
  assert.ok(delayed.hp < instant.hp, `延迟臂应多挨咬：即时 ${instant.hp} 血 vs 延迟 ${delayed.hp} 血`);
});

// ——————————————————— 维持成本与现状快照 ———————————————————

test('维持成本：每支在野战团每天额外消耗食物', () => {
  const w = mil();
  spawn(w, 'human', 'hunter', 1, 0);
  spawn(w, 'human', 'guard', 0, 1);
  const keep = idsOf(w);
  const food0 = w.food;
  run(w, 18, keep);                        // 到一个日界
  const popCost = Math.ceil(w.pop / 4);
  const upkeep = 2 * MILITARY.upkeepPerSquad;
  assert.equal(w.food, food0 - popCost - upkeep, `应扣人口 ${popCost} + 军粮 ${upkeep}`);
});

test('确定性：同种子同操作，兵营与部队快照完全一致', () => {
  function play() {
    const w = mil({ orderDelay: 2 });
    const b = createBarracks(w, 0, -1, 'hold');
    orderTraining(w, b.id, 'hunter');
    spawn(w, 'wild', 'wolf', 3, -1);
    run(w, 30);
    return JSON.stringify(snapshot(w));
  }
  assert.equal(play(), play());
});

test('非军事世界不受影响：military 关闭时兵营逻辑不启动', () => {
  const w = createWorld(1117);
  assert.equal(w.military, false);
  w.units = [];
  w.nextId = 1;
  const b = createBarracks(w, 0, -1, 'hold');   // 允许建，但不会自动跑
  b.garrison.hunter = 2;
  spawn(w, 'wild', 'wolf', 2, -1);
  const keep = idsOf(w);
  run(w, 6, keep);
  assert.equal(b.garrison.hunter, 2, 'military=false 时方针不生效');
});
