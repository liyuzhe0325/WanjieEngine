// 《万界文明》河谷流民 · 自主战棋开局实验 —— 纯规则内核（无 DOM、可被 node --test 直接测试）
// 与正式 game.html / 六角世界权威状态无关。这里的数值是实验常量，不是定稿平衡。

export const SQRT3 = Math.sqrt(3);
export const R = 29;
export const CX = 430;
export const CY = 305;
export const CAMP = { q: 0, r: 0 };
export const DAY_TICKS = 18;
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const STATS = { hunter: [6, 2, 2], guard: [10, 3, 1], deer: [3, 0, 2], wolf: [7, 2, 2] };
export const NAMES = { hunter: "猎团", guard: "守卫", deer: "鹿", wolf: "狼" };
export const RULES = {
  caution: { key: "caution", title: "警戒本能", desc: "猎团发现附近捕食者时主动撤离，并在安全后恢复自主" },
  pack: { key: "pack", title: "集群狩猎", desc: "猎团与友方战团保持在 2 格内协同，额外造成 2 点伤害" }
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
  return !unitAt(world, q, r, selfId);
}

/**
 * 六角网格 BFS 寻路（修复原实现的贪心一步走：贪心无法绕开水面与其他单位，
 * 一旦第一个更近的邻格不可通行就永久停在原地）。
 * 返回从 start 的下一步起、直到 goal 的格序列；不可达返回 null。
 */
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
  // 目标格被占用（例如营地里有守卫）：走到邻格即算「已抵达附近」，不让单位永久空转
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

export function spawn(world, team, kind, q, r) {
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
    cool: 0,
    stall: 0
  };
  world.units.push(unit);
  return unit;
}

export function createWorld(seed = 1117) {
  const world = {
    seed,
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
  spawn(world, "human", "hunter", 1, 0);
  spawn(world, "human", "guard", 0, 1);
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

export function issueOrder(world, unitId, order, target) {
  const u = unitById(world, unitId);
  if (!u) return false;
  if (order === "auto") {
    u.order = "auto";
    u.target = null;
    u.stall = 0;
    return true;
  }
  if (order === "attack") {
    const t = target && unitById(world, target.id);
    if (!t) return false;
    u.order = "attack";
    u.target = { id: t.id };
    u.stall = 0;
    return true;
  }
  if (!target || !cell(world, target.q, target.r)) return false;
  if (cell(world, target.q, target.r).t === "water") return false;
  u.order = order;
  u.target = { q: target.q, r: target.r };
  u.stall = 0;
  return true;
}

export function hit(world, attacker, defender) {
  if (attacker.cool > 0 || distance(attacker, defender) > attacker.range) return false;
  let dmg = attacker.atk;
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
      world.pop = Math.max(0, world.pop - (defender.kind === "hunter" ? 4 : 5));
      log(world, "战团溃散，人口受损");
    }
    world.kills++;
  }
  return true;
}

/** 只在明显打不过（自己快死、狼还很硬）时脱离，避免猎团自杀式扑狼把构筑实验变成「猎团必死」。 */
function shouldDisengage(world, u, wolf) {
  const dmg = u.atk + packBonus(world, u);
  return u.hp <= wolf.atk * 2 && wolf.hp > dmg;
}

/** 撤离：在 2 步可达范围内选「离威胁最远、其次离营地最近」的落脚点。 */
function flee(world, u, threat, reason) {
  const options = reachableWithin(world, u, 2, u.id);
  if (!options.length) return false;
  options.sort(
    (a, b) =>
      distance(b, threat) - distance(a, threat) ||
      distance(a, CAMP) - distance(b, CAMP) ||
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

function hunterAuto(world, u) {
  const wolf = closest(world, u, (x) => x.kind === "wolf");
  const wd = wolf ? distance(u, wolf) : Infinity;

  // 警戒本能：附近有捕食者就撤离；不再「逃到营地后原地不动」
  if (world.rule === "caution" && wolf && wd <= 3) {
    if (flee(world, u, wolf, "警戒本能")) return;
  }
  // 生存判断：血少且狼还很硬时脱离战斗（原版没有这条，猎团几乎必死，构筑因此永远无从生效）
  if (wolf && wd <= 2 && shouldDisengage(world, u, wolf)) {
    if (world.rule !== "caution" && flee(world, u, wolf, "避开强敌")) return;
  }
  if (!wolf || wd > 3) u.retreat = null;

  // 集群狩猎：先与最近友方合流（保持 2 格内），再一起下手
  if (world.rule === "pack") {
    const ally = closest(world, u, (x) => x.team === "human");
    if (ally && distance(u, ally) > 2) {
      if (stepToward(world, u, ally)) return;
    }
  }

  const prey = closest(world, u, (x) => x.kind === "deer" || (x.kind === "wolf" && distance(u, x) <= 2));
  if (prey) {
    if (!hit(world, u, prey)) stepToward(world, u, prey);
  } else if (distance(u, CAMP) > 1) {
    stepToward(world, u, CAMP);
  }
}

function guardAuto(world, u) {
  const enemy = closest(world, u, (x) => x.team === "wild" && x.kind === "wolf");
  if (enemy && distance(enemy, CAMP) <= 3) {
    if (!hit(world, u, enemy)) stepToward(world, u, enemy);
  } else if (distance(u, CAMP) > 1) {
    stepToward(world, u, CAMP);
  }
}

function wolfAuto(world, u) {
  const enemy = closest(world, u, (x) => x.team === "human");
  if (enemy && distance(u, enemy) <= 3) {
    if (!hit(world, u, enemy)) stepToward(world, u, enemy);
  } else if (distance(u, CAMP) > 1) {
    stepToward(world, u, CAMP);
  }
}

function deerAuto(world, u) {
  const hunter = closest(world, u, (x) => x.team === "human");
  if (!hunter || distance(u, hunter) > 1) return;
  const dests = neighbors(u.q, u.r)
    .filter((p) => passable(world, p.q, p.r, u.id))
    .sort(
      (a, b) => distance(b, hunter) - distance(a, hunter) || distance(a, CAMP) - distance(b, CAMP)
    );
  if (dests[0] && distance(dests[0], hunter) > distance(u, hunter)) {
    u.q = dests[0].q;
    u.r = dests[0].r;
  }
}

function behave(world, u) {
  if (u.hp <= 0) return;
  u.cool = Math.max(0, u.cool - 1);

  if (u.order === "move" || u.order === "hold") {
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
      // hold：抵达后驻守
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

  if (u.kind === "hunter") hunterAuto(world, u);
  else if (u.kind === "guard") guardAuto(world, u);
  else if (u.kind === "wolf") wolfAuto(world, u);
  else if (u.kind === "deer") deerAuto(world, u);
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

  if (world.tick % DAY_TICKS === 0) {
    world.day++;
    world.food = Math.max(0, world.food - Math.ceil(world.pop / 4));
    log(world, "新的一天到来，部落消耗食物。");
    if (!world.units.some((u) => u.kind === "deer")) {
      const spots = [[4, -1], [3, 1], [2, -3], [4, 0]];
      const p = spots.find((s) => passable(world, s[0], s[1]));
      if (p) spawn(world, "wild", "deer", p[0], p[1]);
    }
    if (world.day % 2 === 0 && !world.units.some((u) => u.kind === "wolf")) {
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
    food: world.food,
    rule: world.rule,
    encounter: world.encounter,
    offer: world.offer,
    kills: world.kills,
    seed: world.seed,
    units: aliveUnits(world)
      .map((u) => ({ id: u.id, team: u.team, kind: u.kind, q: u.q, r: u.r, hp: u.hp, order: u.order }))
      .sort((a, b) => a.id - b.id)
  };
}
