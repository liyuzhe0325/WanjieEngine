import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, stepWorld, spawn, deploy, deployStatus, deployZone, distance,
  cell, aliveUnits, snapshot, CAMP, DEPLOY, installRule, selectRule, issueOrder,
  HUNTER_RULES, GUARD_RULES, WOLF_RULES, DEER_RULES, packBonus
} from '../experiments/tribe-opening/tribe-sim.js';

// 受控世界：清空默认单位、给足食物，按需部署/摆放，避免「每日刷新野生动物」干扰
function clean(rule = null) {
  const w = createWorld(1117);
  w.units = [];
  w.nextId = 1;
  w.food = 100;
  w.rule = rule;
  w.offer = false;
  w.encounter = false;
  return w;
}
const of = (w, kind) => aliveUnits(w).filter((u) => u.kind === kind);
// keepIds：只保留这些单位，屏蔽「每日刷新野生动物」对单项对照测试的干扰
function run(w, n, keepIds = null) {
  for (let i = 0; i < n; i++) {
    stepWorld(w);
    if (keepIds) w.units = w.units.filter((u) => keepIds.has(u.id));
  }
  return w;
}
const idsOf = (w) => new Set(w.units.map((u) => u.id));
const firstTickWith = (w, re) => (w.events.find((e) => re.test(e.text)) || {}).tick ?? -1;

// ——————————————————————— 部署机制 ———————————————————————

test('部署：营地 2 格内、非水面、未占用、食物足够时才允许', () => {
  const w = clean();
  w.food = 100;
  assert.equal(deployStatus(w, 'hunter', 0, 0).ok, true, '营地格本身可部署');
  assert.equal(deployStatus(w, 'hunter', 2, 0).ok, true, '半径 2 内可部署');
  assert.equal(deployStatus(w, 'hunter', 3, 0).ok, false, '半径外应拒绝');
  assert.equal(deployStatus(w, 'hunter', -3, 0).ok, false, '水面应拒绝');
  assert.equal(deployStatus(w, 'wolf', 1, 1).ok, false, '野生兵种不可部署');
});

test('部署：占用格与食物不足会被拒绝，且不改变世界状态', () => {
  const w = clean();
  const g = spawn(w, 'human', 'guard', 1, 1);
  w.food = 5;
  const before = JSON.stringify(snapshot(w));
  const occupied = deployStatus(w, 'hunter', 1, 1);
  assert.equal(occupied.ok, false);
  assert.match(occupied.reason, /占用/);

  const poor = deployStatus(w, 'guard', 2, 0);
  assert.equal(poor.ok, false);
  assert.match(poor.reason, /食物/);
  assert.equal(deploy(w, 'guard', 2, 0).ok, false);
  assert.equal(JSON.stringify(snapshot(w)), before, '被拒绝时不得写入任何状态');
  assert.ok(aliveUnits(w).includes(g));
});

test('部署：成功时扣食物、棋子落在落点、并把落点记为驻守点', () => {
  const w = clean();
  w.food = 100;
  const res = deploy(w, 'guard', 2, 0);
  assert.equal(res.ok, true);
  assert.equal(w.food, 100 - DEPLOY.cost.guard);
  assert.equal(w.deploys, 1);
  const g = of(w, 'guard')[0];
  assert.deepEqual([g.q, g.r], [2, 0]);
  assert.deepEqual(g.post, { q: 2, r: 0 });
  assert.equal(g.deployed, true);
  assert.equal(g.order, 'auto', '部署后按自身行为自主运行');
});

test('部署区域：只在营地 radius 内，且不含水面', () => {
  const w = clean();
  const zone = deployZone(w);
  assert.ok(zone.length > 0);
  for (const p of zone) {
    assert.ok(distance(p, CAMP) <= DEPLOY.radius);
    assert.notEqual(cell(w, p.q, p.r).t, 'water');
  }
});

// ——————————————————— 部署位置 → 接敌时间 ———————————————————

test('对照：部署点越靠近狼，接敌越早（确定性）', () => {
  function firstContact(deployAt) {
    const w = clean();
    spawn(w, 'wild', 'wolf', 4, -2);
    deploy(w, 'hunter', deployAt[0], deployAt[1]);
    const keep = idsOf(w);
    run(w, 30, keep);
    return firstTickWith(w, /猎团攻击 狼/);
  }
  const near = firstContact([2, -1]);   // 与狼相邻方向
  const far = firstContact([-1, 1]);    // 营地另一侧
  assert.ok(near > 0 && far > 0, `两边都应在 30 步内接敌，实际 near=${near} far=${far}`);
  assert.ok(near < far, `近点应更早接敌：near=${near} far=${far}`);
});

test('对照：部署位置直接决定是否处在协同范围（+2 加成）', () => {
  function bonusAt(deployAt, deerAt) {
    const w = clean('pack');
    spawn(w, 'human', 'guard', 0, 1);      // 守卫驻守营地，不动
    const h = deploy(w, 'hunter', deployAt[0], deployAt[1]).unit;
    spawn(w, 'wild', 'deer', deerAt[0], deerAt[1]);
    return { bonus: packBonus(w, h), dist: distance(h, { q: 0, r: 1 }) };
  }
  const near = bonusAt([1, 1], [2, 1]);    // 与守卫相距 1
  const far = bonusAt([2, -2], [2, 1]);    // 与守卫相距 3
  assert.equal(near.dist, 1);
  assert.equal(far.dist, 3);
  assert.equal(near.bonus, 2, '近点部署应吃到协同加成');
  assert.equal(far.bonus, 0, '远点部署吃不到协同加成');

  // 端到端：近点部署时第一击就是 4 点
  const w = clean('pack');
  spawn(w, 'human', 'guard', 0, 1);
  spawn(w, 'wild', 'deer', 2, 1);
  deploy(w, 'hunter', 1, 1);
  const keep = idsOf(w);
  run(w, 3, keep);
  const hit = w.events.find((e) => /猎团攻击 猎物/.test(e.text));
  assert.ok(hit, '应在 3 步内开火');
  assert.match(hit.text, /造成 4 点伤害/);
});

test('集群狩猎的归队不会与狩猎互相抖动（滞回锁存）', () => {
  const w = clean('pack');
  spawn(w, 'human', 'guard', 0, 1);
  spawn(w, 'wild', 'deer', 4, 0);
  const h = deploy(w, 'hunter', 2, -3).unit;   // 距守卫 4 格以上
  const keep = idsOf(w);
  const seq = [];
  for (let i = 0; i < 30; i++) {
    stepWorld(w);
    w.units = w.units.filter((u) => keep.has(u.id));
    const u = of(w, 'hunter')[0];
    if (u) seq.push(u.action);
  }
  let flips = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) flips++;
  assert.ok(flips <= 3, `行为不应反复横跳，实际切换 ${flips} 次：${seq.slice(0, 12).join(' > ')}`);
  assert.ok(!(seq.includes('rule.pack.cohesion') && seq.slice(-6).includes('rule.pack.cohesion')), '归队应在 2 格内结束，不该长期反复归队');
});

// ——————————————————— 部署位置 → 防守效果 ———————————————————

test('对照：守卫部署在狼来袭方向能把狼拦在更远处', () => {
  function defend(deployAt) {
    const w = clean();
    spawn(w, 'wild', 'wolf', 4, -1);
    deploy(w, 'guard', deployAt[0], deployAt[1]);
    const keep = idsOf(w);
    let minDist = 99, deathTick = -1;
    for (let i = 0; i < 40; i++) {
      stepWorld(w);
      w.units = w.units.filter((u) => keep.has(u.id));
      const wolf = of(w, 'wolf')[0];
      if (wolf) minDist = Math.min(minDist, distance(wolf, CAMP));
      else if (deathTick < 0) deathTick = i + 1;
    }
    return { minDist, deathTick, guardHp: (of(w, 'guard')[0] || {}).hp };
  }
  const front = defend([2, -1]);   // 朝狼来袭方向
  const back = defend([0, 2]);     // 背向
  assert.equal(front.deathTick, 5, `正面部署应在第 5 步击杀，实际 ${front.deathTick}`);
  assert.equal(back.deathTick, 6, `背面部署应在第 6 步击杀，实际 ${back.deathTick}`);
  assert.equal(front.minDist, 3, '正面部署把狼挡在离营地 3 格');
  assert.equal(back.minDist, 2, '背面部署让狼逼近到 2 格');
  assert.ok(front.minDist > back.minDist, '部署越靠前，拦截半径越外');
});

test('守卫的驻守点决定防守范围：狼距驻守点 3 格内才接敌', () => {
  const w = clean();
  const wolf = spawn(w, 'wild', 'wolf', 4, -1);
  const front = deploy(w, 'guard', 2, -1).unit;
  assert.equal(selectRule(w, front), 'defend.engage', '狼距驻守点 2 格应接敌');

  const w2 = clean();
  spawn(w2, 'wild', 'wolf', 4, -1);
  const back = deploy(w2, 'guard', 0, 2).unit;
  assert.notEqual(selectRule(w2, back), 'defend.engage', '狼距驻守点 4 格时守卫不应出击');
  assert.equal(selectRule(w2, back), 'idle', '已在驻守点上且无威胁 → 待命');
  assert.ok(wolf.hp === 7);
});

// ——————————————————— 行为规则表优先级 ———————————————————

test('行为规则表：优先级顺序对外公开且自上而下生效', () => {
  assert.deepEqual(HUNTER_RULES.map((r) => r.id), [
    'rule.caution.flee', 'survive.disengage', 'rule.pack.cohesion', 'hunt.prey', 'post.return', 'idle'
  ]);
  assert.deepEqual(GUARD_RULES.map((r) => r.id), ['defend.engage', 'post.return', 'idle']);
  assert.deepEqual(WOLF_RULES.map((r) => r.id), ['raid.chase', 'raid.approach', 'idle']);
  assert.deepEqual(DEER_RULES.map((r) => r.id), ['flee.human', 'idle']);
});

test('规则优先级：玩家指令 > 警戒本能 > 合流 > 狩猎 > 回驻守点', () => {
  // 1) 玩家指令优先
  const w1 = clean('caution');
  const wolf1 = spawn(w1, 'wild', 'wolf', 1, 1);
  const h1 = deploy(w1, 'hunter', 0, 1).unit;
  issueOrder(w1, h1.id, 'attack', { id: wolf1.id });
  stepWorld(w1);
  assert.equal(h1.action, 'order.attack', '有攻击指令时不吃警戒本能');

  // 2) 警戒本能在狩猎之前
  const w2 = clean('caution');
  spawn(w2, 'wild', 'wolf', 2, 0);
  spawn(w2, 'wild', 'deer', 1, 1);
  const h2 = deploy(w2, 'hunter', 1, 0).unit;
  assert.equal(selectRule(w2, h2), 'rule.caution.flee');

  // 3) 集群合流在狩猎之前（超出 4 格才归队，见滞回锁存）
  const w3 = clean('pack');
  spawn(w3, 'human', 'guard', 0, 1);
  spawn(w3, 'wild', 'deer', 3, -1);
  const h3 = deploy(w3, 'hunter', 2, -2).unit;
  h3.q = 5; h3.r = -1;                            // 距守卫 5 格
  assert.equal(distance(h3, { q: 0, r: 1 }), 5);
  assert.equal(selectRule(w3, h3), 'rule.pack.cohesion');

  // 4) 无猎物时回驻守点
  const w4 = clean();
  const h4 = deploy(w4, 'hunter', 2, -1).unit;
  h4.q = -1; h4.r = 2;
  assert.equal(selectRule(w4, h4), 'post.return');
});

test('部署后的棋子按其驻守点收束，而不是回营地', () => {
  const w = clean();
  const g = deploy(w, 'guard', 2, 0).unit;
  g.q = -1; g.r = 1;                       // 被推离落点
  run(w, 10, idsOf(w));
  const after = of(w, 'guard')[0];
  assert.deepEqual([after.q, after.r], [2, 0], `应回到部署点，实际 ${after.q},${after.r}`);
  assert.equal(distance(after, CAMP), 2, '不回营地');
});

test('确定性：相同部署 + 相同种子 → 完全一致的局面', () => {
  function play() {
    const w = clean('pack');
    deploy(w, 'hunter', 2, -1);
    spawn(w, 'wild', 'wolf', 4, -2);
    spawn(w, 'wild', 'deer', 3, 0);
    run(w, 40);
    return JSON.stringify(snapshot(w));
  }
  assert.equal(play(), play());
});
