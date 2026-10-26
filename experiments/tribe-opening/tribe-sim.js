import { initCivilians, stepCivilians, recruitCivilians } from "./civilians.js";
// 《万界文明》河谷流民 · 自主战棋开局实验 —— 纯规则内核（无 DOM、可被 node --test 直接测试）
// 与正式 game.html / 六角世界权威状态无关。这里的数值是实验常量，不是定稿平衡。
//
// 行为约定（本轮新增，供验收）：
//   1. 每支棋子的自主行为 = 一张**有序规则表**，自上而下取第一条命中的规则；命中结果写入 u.action。
//   2. 玩家指令（move / attack / hold）永远优先于所有自主规则。
//   3. 规则表对外导出（HUNTER_RULES / GUARD_RULES / WOLF_RULES / DEER_RULES），可被测试逐条断言。
//   4. 不做战术寻优、不做多步推演：每条规则只看「距离」与「当前状态」两类事实。

export const SQRT3 = Math.sqrt(3);
export const R = 29;
export const CX = 430;
export const CY = 305;
export const CAMP = { q: 0, r: 0 };
export const DAY_TICKS = 18;
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const STATS = { hunter: [6, 2, 2], guard: [10, 3, 1], deer: [3, 0, 2], wolf: [7, 2, 2] };
export const NAMES = { hunter: "猎团", guard: "守卫", deer: "鹿", wolf: "狼" };

// 部署：只在营地附近、可通行、无占用；用食物结算，不改基础数值。
export const DEPLOY = { radius: 2, cost: { hunter: 10, guard: 12 } };

// 军事子系统（V1.0 的实验常量，全部待验证）：兵营产出 → 驻军池 → 方针出营；命令有延迟；军队有维持成本。
export const MILITARY = {
  fieldCap: 24,                      // 同屏棋子预算：在野我方战团上限
  orderDelay: 2,                     // 命令生效延迟（tick）；内核默认 0，正式试玩传 2
  orderDelayFar: 1,                  // 离营超过 4 格时额外延迟
  upkeepPerSquad: 1,
  wolfRespawnDays: 5,
  growthFoodThreshold: 18,                 // 每支在野战团每天额外消耗食物
  trainTicks: { hunter: 6, guard: 9 },  // 训练耗时
  trainCost: { hunter: 6, guard: 8 },   // 训练食物
  barracksDeployRange: 3             // 方针感知范围（敌人进到据点 3 格内就出营）
};

export const STANCES = {
  hold: { key: "hold", title: "驻守本地", desc: "默认不出营；据点 3 格内出现敌人时出兵迎战" },
  patrol: { key: "patrol", title: "边境巡防", desc: "据点附近没有我方战团时，出一支在外巡逻" },
  reinforce: { key: "reinforce", title: "前线增援", desc: "在野战团少于 2 支时补员" },
  reserve: { key: "reserve", title: "保留预备", desc: "只训练不出兵，等玩家手动部署" }
};

export const RULES = {
  caution: { key: "caution", title: "警戒本能", desc: "猎团发现 3 格内捕食者时撤离，威胁离开后恢复自主" },
  pack: { key: "pack", title: "集群狩猎", desc: "猎团与友方保持在 2 格内协同，额外造成 2 点伤害" }
};

// 行为规则的对外标签（UI 反馈与日志共用）
export const BEHAVIOR_LABELS = {
  "order.move": "执行移动指令",
  "order.attack": "执行攻击指令",
  "order.hold": "驻守指定位置",
  "rule.caution.flee": "警戒本能：撤离捕食者",
  "survive.disengage": "避强：脱离战斗",
  "rule.pack.cohesion": "集群狩猎：向友方合流",
  "hunt.prey": "自主狩猎",
  "post.return": "返回驻守点",
  "defend.engage": "防守接敌",
  "raid.chase": "追击",
  "raid.approach": "逼近营地",
  "flee.human": "逃离猎人",
  idle: "待命"
};

export const hexKey = (q, r) => q + "," + r;
export const distance = (a, b) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const toXY = (q, r) => [CX + R * SQRT3 * (q + r / 2), CY + R * 1.5 * r];
export const neighbors = (q, r) => DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));

export function rand(world) {
  world.seed = (1664525 * world.seed + 1013904223) >>> 0;
  return world.seed / 4294967296;
}

export function cell(world, q, r) {
  return world.map.get(hexKey(q, r));
}

export function unitAt(world, q, r, ignoreId) {
  return world.units.find((u) => u.hp > 0 && u.id !== ignoreId && u.q === q && u.r === r) || null;
}

export function aliveUnits(world) {
  return world.units.filter((u) => u.hp > 0);
}

export function unitById(world, id) {
  return world.units.find((u) => u.id === id && u.hp > 0) || null;
}

/** 可否进入：非水面、且没有别的活单位占据（self 自己所在格不算阻挡）。 */
export function passable(world, q, r, selfId) {
  const c = cell(world, q, r);
  if (!c || c.t === "water") return false;
  // 兵营是实体建筑：一格一座，占格、阻挡通行
  if (world.barracks && world.barracks.some((b) => b.q === q && b.r === r)) return false;
  return !unitAt(world, q, r, selfId);
}

/** 六角网格 BFS 寻路。返回从 start 的下一步起、直到 goal 的格序列；不可达返回 null。 */
export function findPath(world, start, goal, { selfId = null, maxNodes = 400 } = {}) {
  if (!cell(world, goal.q, goal.r)) return null;
  if (distance(start, goal) === 0) return [];
  const goalKey = hexKey(goal.q, goal.r);
  const seen = new Set([hexKey(start.q, start.r)]);
  const queue = [{ q: start.q, r: start.r }];
  const parent = new Map();
  let visited = 0;
  while (queue.length && visited < maxNodes) {
    const cur = queue.shift();
    visited++;
    for (const n of neighbors(cur.q, cur.r)) {
      const nk = hexKey(n.q, n.r);
      if (seen.has(nk)) continue;
      // 目标格被占用时视为不可达，由 advanceAlongPath 改走「与目标相邻的落脚点」
      if (!passable(world, n.q, n.r, selfId)) continue;
      seen.add(nk);
      parent.set(nk, hexKey(cur.q, cur.r));
      if (nk === goalKey) {
        const path = [];
        let k = nk;
        while (k !== hexKey(start.q, start.r)) {
          const [q, r] = k.split(",").map(Number);
          path.unshift({ q, r });
          k = parent.get(k);
        }
        return path;
      }
      queue.push(n);
    }
  }
  return null;
}

/** 目标格不可进入时，找一个「能到、且与目标相邻」的落脚点。 */
export function nearestReachableAdjacent(world, start, goal, selfId) {
  const candidates = neighbors(goal.q, goal.r).filter((c) => passable(world, c.q, c.r, selfId));
  candidates.sort((a, b) => distance(start, a) - distance(start, b));
  for (const c of candidates) {
    if (findPath(world, start, c, { selfId })) return c;
  }
  return null;
}

/** 由 BFS 路径推进一步；返回 moved / arrived / adjacent / blocked。 */
function advanceAlongPath(world, unit, goal) {
  if (distance(unit, goal) === 0) return "arrived";
  const path = findPath(world, unit, goal, { selfId: unit.id });
  if (path && path.length) {
    unit.q = path[0].q;
    unit.r = path[0].r;
    return distance(unit, goal) === 0 ? "arrived" : "moved";
  }
  const adjacent = nearestReachableAdjacent(world, unit, goal, unit.id);
  if (adjacent) {
    if (distance(unit, goal) === 1) return "adjacent";
    const p2 = findPath(world, unit, adjacent, { selfId: unit.id });
    if (p2 && p2.length) {
      unit.q = p2[0].q;
      unit.r = p2[0].r;
      return distance(unit, goal) === 1 ? "adjacent" : "moved";
    }
  }
  return "blocked";
}

function stepToward(world, unit, goal) {
  const r = advanceAlongPath(world, unit, goal);
  return r === "moved" || r === "arrived" || r === "adjacent";
}

/** n 步以内可达（含起点）的空格，用于撤离选点。 */
export function reachableWithin(world, start, n, selfId) {
  const out = [];
  const seen = new Set([hexKey(start.q, start.r)]);
  let frontier = [{ q: start.q, r: start.r }];
  for (let d = 0; d < n; d++) {
    const next = [];
    for (const cur of frontier) {
      for (const nb of neighbors(cur.q, cur.r)) {
        const k = hexKey(nb.q, nb.r);
        if (seen.has(k) || !passable(world, nb.q, nb.r, selfId)) continue;
        seen.add(k);
        out.push(nb);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return out;
}

export function closest(world, unit, filter) {
  return aliveUnits(world)
    .filter((x) => x.id !== unit.id && filter(x))
    .sort((a, b) => distance(unit, a) - distance(unit, b) || a.id - b.id)[0];
}

export function allyWithin(world, unit, radius) {
  return aliveUnits(world).some(
    (x) => x.id !== unit.id && x.team === unit.team && distance(x, unit) <= radius
  );
}

export function packBonus(world, unit) {
  return world.rule === "pack" && unit.kind === "hunter" && allyWithin(world, unit, 2) ? 2 : 0;
}

export function spawn(world, team, kind, q, r, post) {
  const s = STATS[kind];
  const unit = {
    id: world.nextId++,
    team,
    kind,
    q,
    r,
    hp: s[0],
    maxHp: s[0],
    atk: s[1],
    range: s[2] === 2 && kind === "hunter" ? 2 : 1,
    move: s[2],
    order: "auto",
    target: null,
    pending: null,
    cool: 0,
    stall: 0,
    // 驻守点：部署机制的核心。玩家部署在哪，这支棋子就以哪里为「家」。
    post: post ? { q: post.q, r: post.r } : team === "human" ? { q: CAMP.q, r: CAMP.r } : null,
    action: "idle",
    cohesion: false,
    deployed: !!post
  };
  world.units.push(unit);
  return unit;
}

// —— 部署机制 ——
export function deployZone(world) {
  const out = [];
  for (let q = -DEPLOY.radius; q <= DEPLOY.radius; q++) {
    for (let r = -DEPLOY.radius; r <= DEPLOY.radius; r++) {
      const c = cell(world, q, r);
      if (c && c.t !== "water" && distance(c, CAMP) <= DEPLOY.radius) out.push({ q, r });
    }
  }
  return out;
}

/** 部署合法性：范围、地形、占用、食物。返回 {ok, reason}，不改状态。 */
export function deployStatus(world, kind, q, r) {
  if (!STATS[kind] || kind === "deer" || kind === "wolf") return { ok: false, reason: "不可部署该兵种" };
  const c = cell(world, q, r);
  if (!c) return { ok: false, reason: "地块不存在" };
  if (distance(c, CAMP) > DEPLOY.radius) return { ok: false, reason: "超出部署半径（营地 " + DEPLOY.radius + " 格内）" };
  if (c.t === "water") return { ok: false, reason: "水面不可部署" };
  if (unitAt(world, q, r)) return { ok: false, reason: "该格已被占用" };
  const cost = DEPLOY.cost[kind];
  if (world.food < cost) return { ok: false, reason: "食物不足（需要 " + cost + "）" };
  return { ok: true, reason: "可部署，消耗食物 " + cost };
}

export function deploy(world, kind, q, r) {
  const status = deployStatus(world, kind, q, r);
  if (!status.ok) return status;
  world.food -= DEPLOY.cost[kind];
  const u = spawn(world, "human", kind, q, r, { q, r });
  world.deploys = (world.deploys || 0) + 1;
  log(world, "部署" + NAMES[kind] + "至 " + q + "," + r + "（消耗食物 " + DEPLOY.cost[kind] + "）");
  return { ok: true, reason: status.reason, unit: u };
}

// —— 兵营：军事生产与组织节点（不占「部队上限」，只产兵、出营、设方针） ——
export function createBarracks(world, q, r, stance = "hold") {
  const c = cell(world, q, r);
  if (!c || c.t === "water") return null;
  if (unitAt(world, q, r)) return null;
  if (world.barracks.some((b) => b.q === q && b.r === r)) return null;
  const b = {
    id: "b" + (world.barracks.length + 1),
    q,
    r,
    stance: STANCES[stance] ? stance : "hold",
    garrison: { hunter: 0, guard: 0 },
    training: null,
    queue: [],
    produced: 0
  };
  world.barracks.push(b);
  log(world, "兵营设立于 " + q + "," + r);
  return b;
}

export function fieldSquads(world) {
  return aliveUnits(world).filter((u) => u.team === "human").length;
}

export function orderTraining(world, barracksId, kind) {
  const b = world.barracks.find((x) => x.id === barracksId);
  if (!b) return { ok: false, reason: "没有该兵营" };
  if (!MILITARY.trainCost[kind]) return { ok: false, reason: "兵种不可训练" };
  b.queue.push(kind);
  log(world, "兵营排队训练：" + NAMES[kind]);
  return { ok: true };
}

export function setStance(world, barracksId, stance) {
  const b = world.barracks.find((x) => x.id === barracksId);
  if (!b || !STANCES[stance]) return false;
  b.stance = stance;
  log(world, "兵营方针改为：" + STANCES[stance].title);
  return true;
}

/** 从驻军池出营：兵营占格，所以落在相邻可达格；落点即驻守点。 */
export function deployFromGarrison(world, b, kind) {
  const kinds = kind ? [kind] : ["guard", "hunter"];
  const chosen = kinds.find((k) => (b.garrison[k] || 0) > 0);
  if (!chosen) return { ok: false, reason: "驻军池为空" };
  if (fieldSquads(world) >= world.fieldCap) {
    log(world, "已达同屏预算，出营排队");
    return { ok: false, reason: "field-cap" };
  }
  const spot = neighbors(b.q, b.r)
    .filter((n) => passable(world, n.q, n.r))
    .sort((a, c) => distance(a, CAMP) - distance(c, CAMP) || a.q - c.q || a.r - c.r)[0];
  if (!spot) return { ok: false, reason: "兵营周围没有空地" };
  b.garrison[chosen]--;
  const u = spawn(world, "human", chosen, spot.q, spot.r, { q: b.q, r: b.r });
  b.produced++;
  log(world, "兵营出营：" + NAMES[chosen] + " 进驻 " + spot.q + "," + spot.r);
  return { ok: true, unit: u };
}

/** 兵营每 tick 结算：训练进度 + 方针出营。全部只看距离与计数，不做战术判断。 */
export function stepBarracks(world) {
  if (!world.military || !world.barracks.length) return;
  for (const b of world.barracks) {
    if (!b.training && b.queue.length) {
      const kind = b.queue[0];
      const cost = MILITARY.trainCost[kind];
      const recruits = kind === "hunter" ? 4 : 5;
      if (world.food >= cost && (!world.civilianMode || world.civilians.length >= recruits + 2)) {
        if (world.civilianMode && !recruitCivilians(world,recruits)) continue;
        world.food -= cost;
        b.queue.shift();
        b.training = { kind, left: MILITARY.trainTicks[kind] };
        log(world, "开始训练：" + NAMES[kind] + "（食物 " + cost + "）");
      }
    }
    if (b.training) {
      b.training.left--;
      if (b.training.left <= 0) {
        b.garrison[b.training.kind]++;
        log(world, "训练完成：" + NAMES[b.training.kind] + " 进入驻军");
        b.training = null;
      }
    }

    const wolves = aliveUnits(world)
      .filter((u) => u.team === "wild" && u.kind === "wolf")
      .sort((x, y) => distance(x, b) - distance(y, b));
    const nearEnemy = wolves[0] && distance(wolves[0], b) <= MILITARY.barracksDeployRange;
    const nearby = aliveUnits(world).filter((u) => u.team === "human" && distance(u, b) <= 3).length;
    const total = b.garrison.hunter + b.garrison.guard;
    if (!total) continue;

    const prefer = nearEnemy && b.garrison.guard > 0 ? "guard" : b.garrison.hunter > 0 ? "hunter" : "guard";
    if (b.stance === "hold" && nearEnemy) deployFromGarrison(world, b, prefer);
    else if (b.stance === "patrol" && nearby === 0) deployFromGarrison(world, b, prefer);
    else if (b.stance === "reinforce" && fieldSquads(world) < 2) deployFromGarrison(world, b, prefer);
  }
}

export function createWorld(seed = 1117, opts = {}) {
  const world = {
    seed,
    military: !!opts.military,
    civilianMode: !!opts.civilians,
    orderDelay: opts.orderDelay ?? 0,
    fieldCap: opts.fieldCap ?? MILITARY.fieldCap,
    barracks: [],
    map: new Map(),
    units: [],
    nextId: 1,
    day: 1,
    tick: 0,
    food: 35,
    pop: 20,
    selected: null,
    mode: "select",
    rule: null,
    offer: false,
    encounter: false,
    logs: [],
    kills: 0,
    deploys: 0,
    events: []
  };
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > 5) continue;
      let t = "plain";
      const z = rand(world);
      if ((q === -3 && r >= -2 && r <= 3) || (q === -2 && r >= -1 && r <= 2)) t = "water";
      else if (z < 0.16) t = "wood";
      else if (z < 0.23) t = "hill";
      world.map.set(hexKey(q, r), { q, r, t });
    }
  }
  for (const [q, r] of [[0, 0], [1, 0], [0, 1], [-1, 0], [1, -1], [0, -1]]) {
    const c = cell(world, q, r);
    if (c) c.t = "plain";
  }
  if (world.civilianMode) initCivilians(world,20);
  if (!world.civilianMode) spawn(world, "human", "hunter", 1, 0);
  if (!world.civilianMode) spawn(world, "human", "guard", 0, 1);
  spawn(world, "wild", "deer", 3, -1);
  spawn(world, "wild", "deer", 4, 0);
  spawn(world, "wild", "wolf", 4, -2);
  return world;
}

export function log(world, text) {
  world.logs.unshift("第 " + world.day + " 日 · " + text);
  world.logs = world.logs.slice(0, 30);
  world.events.push({ tick: world.tick, text });
}

export function installRule(world, key) {
  if (!RULES[key]) return false;
  world.rule = key;
  log(world, "安装文明机制：" + RULES[key].title);
  return true;
}

function applyOrder(world, u, order, target) {
  if (order === "auto") {
    u.order = "auto";
    u.target = null;
    u.pending = null;
    u.stall = 0;
    return;
  }
  if (order === "attack") {
    u.order = "attack";
    u.target = { id: target.id };
    u.stall = 0;
    return;
  }
  u.order = order;
  u.target = { q: target.q, r: target.r };
  u.stall = 0;
}

/**
 * 下达命令。命令有在途时间（world.orderDelay，离营超过 4 格再加 1 步），
 * 在途期间棋子仍按自主规则行动 —— 这就是「自动是默认态，干预是例外」的机制表达。
 */
export function issueOrder(world, unitId, order, target) {
  const u = unitById(world, unitId);
  if (!u) return false;
  if (order === "attack") {
    const t = target && unitById(world, target.id);
    if (!t) return false;
    target = { id: t.id };
  } else if (order !== "auto") {
    if (!target || !cell(world, target.q, target.r)) return false;
    if (cell(world, target.q, target.r).t === "water") return false;
    target = { q: target.q, r: target.r };
  }
  const delay =
    order === "auto"
      ? 0
      : (world.orderDelay || 0) + (distance(u, CAMP) > 4 ? MILITARY.orderDelayFar : 0);
  if (delay > 0) {
    u.pending = { order, target, at: world.tick + delay };
    log(world, "命令在途：约 " + delay + " 步后生效");
    return true;
  }
  applyOrder(world, u, order, target);
  return true;
}

export function hit(world, attacker, defender) {
  if (attacker.cool > 0 || distance(attacker, defender) > attacker.range) return false;
  let dmg = attacker.atk;
  // 基础配合：守卫在附近牵制狼时，猎团攻击该狼有 +1 协同收益。
  // 不做复杂 AI 寻优；只依据当前空间关系。
  if (attacker.kind === "hunter" && defender.kind === "wolf" && aliveUnits(world).some(x=>x.team==="human"&&x.kind==="guard"&&distance(x,defender)<=1)) {
    dmg += 1;
    log(world, "守卫牵制：猎团协同 +1");
  }
  const bonus = packBonus(world, attacker);
  if (bonus) {
    dmg += bonus;
    log(world, "猎团与友方协同（集群狩猎）+2 伤害");
  }
  defender.hp -= dmg;
  attacker.cool = 2;
  log(
    world,
    NAMES[attacker.kind] +
      "攻击 " +
      (defender.team === "human" ? "我方战团" : defender.kind === "wolf" ? "狼" : "猎物") +
      "，造成 " +
      dmg +
      " 点伤害"
  );
  if (defender.hp <= 0) {
    if (defender.kind === "deer") {
      world.food += 8;
      log(world, "猎获食物 +8");
    }
    if (defender.kind === "wolf") {
      world.food += 3;
      log(world, "击退捕食者，食物 +3");
    }
    if (defender.team === "human") {
      if (!world.civilianMode) world.pop = Math.max(0, world.pop - (defender.kind === "hunter" ? 4 : 5));
      log(world, "战团溃散，人口受损");
    }
    world.kills++;
  }
  return true;
}

/** 只在明显打不过（自己快死、狼还很硬）时脱离。基础数值不改，只改「什么时候不接战」。 */
function shouldDisengage(world, u, wolf) {
  const dmg = u.atk + packBonus(world, u);
  return u.hp <= wolf.atk * 2 && wolf.hp > dmg;
}

/** 撤离：在 2 步可达范围内选「离威胁最远、其次离驻守点最近」的落脚点。 */
function flee(world, u, threat, reason) {
  const options = reachableWithin(world, u, 2, u.id);
  if (!options.length) return false;
  const anchor = u.post || CAMP;
  options.sort(
    (a, b) =>
      distance(b, threat) - distance(a, threat) ||
      distance(a, anchor) - distance(b, anchor) ||
      a.q - b.q ||
      a.r - b.r
  );
  const dest = options[0];
  if (distance(dest, threat) <= distance(u, threat)) return false;
  const path = findPath(world, u, dest, { selfId: u.id });
  if (!path || !path.length) return false;
  u.q = path[0].q;
  u.r = path[0].r;
  if (u.retreat !== reason) {
    u.retreat = reason;
    log(world, reason === "警戒本能" ? "猎团本能撤离捕食者" : "猎团避开强敌");
  }
  return true;
}

// ————————————————————————————————————————————————
// 自主行为：有序规则表。自上而下取第一条 when 成立的规则，由 act 执行。
// 规则只看距离与当前状态，不做多步推演、不做目标打分。
// ————————————————————————————————————————————————

function hunterCtx(world, u) {
  const wolf = closest(world, u, (x) => x.kind === "wolf");
  const ally = closest(world, u, (x) => x.team === "human");
  const prey = closest(
    world,
    u,
    (x) => x.kind === "deer" || (x.kind === "wolf" && distance(u, x) <= 2)
  );
  return { wolf, ally, prey, wd: wolf ? distance(u, wolf) : Infinity };
}

export const HUNTER_RULES = [
  {
    id: "rule.caution.flee",
    when: (w, u, c) => w.rule === "caution" && !!c.wolf && c.wd <= 3,
    act: (w, u, c) => {
      flee(w, u, c.wolf, "警戒本能");
    }
  },
  {
    id: "survive.disengage",
    when: (w, u, c) => !!c.wolf && c.wd <= 2 && shouldDisengage(w, u, c.wolf),
    act: (w, u, c) => {
      flee(w, u, c.wolf, "避强");
    }
  },
  {
    // 滞回锁存：>4 格时开始归队，≤2 格结束。避免「追猎物 / 回队」每步来回切换导致原地抖动。
    id: "rule.pack.cohesion",
    when: (w, u, c) => w.rule === "pack" && !!c.ally && (u.cohesion || distance(u, c.ally) > 4),
    act: (w, u, c) => {
      u.cohesion = true;
      if (distance(u, c.ally) <= 2) {
        u.cohesion = false;
        return;
      }
      stepToward(w, u, c.ally);
    }
  },
  {
    id: "hunt.prey",
    when: (w, u, c) => !!c.prey,
    act: (w, u, c) => {
      if (!hit(w, u, c.prey) && distance(u,c.prey)>u.range) stepToward(w, u, c.prey);
    }
  },
  {
    id: "post.return",
    when: (w, u) => distance(u, u.post || CAMP) > 1,
    act: (w, u) => {
      stepToward(w, u, u.post || CAMP);
    }
  },
  { id: "idle", when: () => true, act: () => {} }
];

function guardCtx(world, u) {
  const wolf = closest(world, u, (x) => x.team === "wild" && x.kind === "wolf");
  const anchor = u.post || CAMP;
  return { wolf, anchor, wolfToPost: wolf ? distance(wolf, anchor) : Infinity };
}

export const GUARD_RULES = [
  {
    id: "defend.engage",
    when: (w, u, c) => !!c.wolf && (c.wolfToPost <= 4 || distance(c.wolf, u) <= 3),
    act: (w, u, c) => {
      // 守卫以保护营地为职责：接近威胁，但不会毫无意义地绕远追逐。
      if (!hit(w, u, c.wolf) && distance(u,c.wolf)>u.range) stepToward(w, u, c.wolf);
    }
  },
  {
    id: "post.return",
    when: (w, u, c) => distance(u, c.anchor) > 0,
    act: (w, u, c) => {
      stepToward(w, u, c.anchor);
    }
  },
  { id: "idle", when: () => true, act: () => {} }
];

function wolfCtx(world, u) {
  const enemy = closest(world, u, (x) => x.team === "human");
  return { enemy };
}

export const WOLF_RULES = [
  {
    id: "raid.chase",
    when: (w, u, c) => !!c.enemy && distance(u, c.enemy) <= 3,
    act: (w, u, c) => {
      if (!hit(w, u, c.enemy)) stepToward(w, u, c.enemy);
    }
  },
  {
    id: "raid.approach",
    when: (w, u) => distance(u, CAMP) > 1,
    act: (w, u) => {
      stepToward(w, u, CAMP);
    }
  },
  { id: "idle", when: () => true, act: () => {} }
];

function deerCtx(world, u) {
  const hunter = closest(world, u, (x) => x.team === "human");
  return { hunter, hd: hunter ? distance(u, hunter) : Infinity };
}

export const DEER_RULES = [
  {
    id: "flee.human",
    when: (w, u, c) => c.hd <= 1,
    act: (w, u, c) => {
      const dests = neighbors(u.q, u.r)
        .filter((p) => passable(w, p.q, p.r, u.id))
        .sort(
          (a, b) => distance(b, c.hunter) - distance(a, c.hunter) || distance(a, CAMP) - distance(b, CAMP)
        );
      if (dests[0] && distance(dests[0], c.hunter) > distance(u, c.hunter)) {
        u.q = dests[0].q;
        u.r = dests[0].r;
      }
    }
  },
  { id: "idle", when: () => true, act: () => {} }
];

const RULE_TABLES = { hunter: HUNTER_RULES, guard: GUARD_RULES, wolf: WOLF_RULES, deer: DEER_RULES };
const CTX_BUILDERS = { hunter: hunterCtx, guard: guardCtx, wolf: wolfCtx, deer: deerCtx };

/** 只读：返回当前会命中的规则 id（测试与 UI 反馈用，不产生副作用）。 */
export function selectRule(world, u) {
  const table = RULE_TABLES[u.kind];
  if (!table) return "idle";
  const ctx = CTX_BUILDERS[u.kind](world, u);
  for (const rule of table) {
    if (rule.when(world, u, ctx)) return rule.id;
  }
  return "idle";
}

function runBehaviorTable(world, u) {
  const table = RULE_TABLES[u.kind];
  if (!table) {
    u.action = "idle";
    return;
  }
  const ctx = CTX_BUILDERS[u.kind](world, u);
  // 锁存状态同步：离开集群狩猎规则，或已经贴到友方 2 格内，就结束归队
  if (u.kind === "hunter") {
    if (world.rule !== "pack") u.cohesion = false;
    else if (u.cohesion && (!ctx.ally || distance(u, ctx.ally) <= 2)) u.cohesion = false;
  }
  for (const rule of table) {
    if (rule.when(world, u, ctx)) {
      rule.act(world, u, ctx);
      u.action = rule.id;
      return;
    }
  }
  u.action = "idle";
}

function behave(world, u) {
  if (u.hp <= 0) return;
  u.cool = Math.max(0, u.cool - 1);

  // 在途命令到点生效；在途期间棋子继续按自主规则行动
  if (u.pending && world.tick >= u.pending.at) {
    const p = u.pending;
    u.pending = null;
    applyOrder(world, u, p.order, p.target);
    log(world, "命令生效：" + (BEHAVIOR_LABELS["order." + p.order] || p.order));
  }

  // 玩家指令优先于一切自主规则
  if (u.order === "move" || u.order === "hold") {
    u.action = u.order === "move" ? "order.move" : "order.hold";
    if (!u.target) {
      u.order = "auto";
      return;
    }
    const status = advanceAlongPath(world, u, u.target);
    if (status === "arrived" || status === "adjacent") {
      if (u.order === "move") {
        log(world, "战团抵达指定位置，恢复自主");
        u.order = "auto";
        u.target = null;
      }
    } else if (status === "blocked") {
      u.stall++;
      if (u.stall >= 4) {
        log(world, "无法抵达指定位置，恢复自主");
        u.order = "auto";
        u.target = null;
        u.stall = 0;
      }
    } else {
      u.stall = 0;
    }
    if (u.order === "hold") {
      const enemy = closest(world, u, (x) => x.team !== u.team);
      if (enemy && distance(u, enemy) <= u.range) hit(world, u, enemy);
    }
    return;
  }

  if (u.order === "attack") {
    u.action = "order.attack";
    const target = u.target && unitById(world, u.target.id);
    if (!target) {
      log(world, "目标已消失，恢复自主");
      u.order = "auto";
      u.target = null;
      return;
    }
    if (!hit(world, u, target)) {
      const moved = stepToward(world, u, target);
      u.stall = moved ? 0 : u.stall + 1;
      if (u.stall >= 4) {
        log(world, "目标不可达，恢复自主");
        u.order = "auto";
        u.target = null;
        u.stall = 0;
      }
    } else {
      u.stall = 0;
    }
    return;
  }

  runBehaviorTable(world, u);
}

export function stepWorld(world) {
  world.tick++;

  const wolf = aliveUnits(world).find((u) => u.kind === "wolf");
  const hunter = aliveUnits(world).find((u) => u.kind === "hunter");
  if (!world.encounter && wolf && hunter && distance(wolf, hunter) <= 3) {
    world.encounter = true;
    world.offer = true;
    log(world, "危险！猎团发现捕食者。可以干预战团或安装一条文明行为规则。");
  }

  const alive = aliveUnits(world).sort((a, b) => a.id - b.id);
  for (const u of alive) behave(world, u);
  world.units = world.units.filter((u) => u.hp > 0);
  stepBarracks(world);
  if (world.civilianMode) stepCivilians(world, (message) => log(world,message));

  if (world.tick % DAY_TICKS === 0) {
    world.day++;
    world.food = Math.max(0, world.food - Math.ceil(world.pop / 4));
    log(world, "新的一天到来，部落消耗食物。");
    if (world.military) {
      const squads = fieldSquads(world);
      if (squads > 0) {
        const upkeep = squads * MILITARY.upkeepPerSquad;
        world.food = Math.max(0, world.food - upkeep);
        log(world, "军粮消耗 " + upkeep + "（在野 " + squads + " 支）");
      }
    }
    if (world.civilianMode && world.food >= MILITARY.growthFoodThreshold && world.civilians.length < 30 && world.day % 2 === 0) {
      world.food -= 6;
      const i=world.civilians.length+1;
      world.civilians.push({id:"new-"+world.tick,q:0,r:0,home:{q:0,r:0},state:"idle",job:i%4===0?"builder":"forager",carried:0,work:0});
      world.pop=world.civilians.length;
      log(world,"部落食物充足，新流民加入（人口 +1，食物 -6）");
    }
    if (!world.units.some((u) => u.kind === "deer")) {
      const spots = [[4, -1], [3, 1], [2, -3], [4, 0]];
      const p = spots.find((s) => passable(world, s[0], s[1]));
      if (p) spawn(world, "wild", "deer", p[0], p[1]);
    }
    // 狼群恢复有缓冲期；禁止连续两天刷狼将小部落反复清空。
    if (world.day % MILITARY.wolfRespawnDays === 0 && !world.units.some((u) => u.kind === "wolf")) {
      const p = [4, -2];
      if (passable(world, p[0], p[1])) spawn(world, "wild", "wolf", p[0], p[1]);
    }
  }

  if (world.pop === 0 || world.food === 0) world.halted = true;
  return world;
}

export function snapshot(world) {
  return {
    tick: world.tick,
    day: world.day,
    pop: world.pop,
    civilians: (world.civilians || []).map(c=>({id:c.id,q:c.q,r:c.r,state:c.state,job:c.job,carried:c.carried})),
    settlement: world.settlement ? {...world.settlement} : null,
    food: world.food,
    rule: world.rule,
    encounter: world.encounter,
    offer: world.offer,
    kills: world.kills,
    deploys: world.deploys || 0,
    military: !!world.military,
    seed: world.seed,
    barracks: (world.barracks || []).map((b) => ({
      id: b.id, q: b.q, r: b.r, stance: b.stance,
      garrison: { ...b.garrison }, training: b.training ? { ...b.training } : null,
      queue: b.queue.slice(), produced: b.produced
    })),
    units: aliveUnits(world)
      .map((u) => ({
        id: u.id, team: u.team, kind: u.kind, q: u.q, r: u.r, hp: u.hp,
        order: u.order, action: u.action, post: u.post, deployed: u.deployed,
        pending: u.pending ? { order: u.pending.order, at: u.pending.at } : null
      }))
      .sort((a, b) => a.id - b.id)
  };
}
