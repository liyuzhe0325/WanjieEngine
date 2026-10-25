// 万界文明 · 战棋实验的开发脚手架（库层）
// 作用：把「建世界 → 下指令 → 推进 → 对比」变成一行可复现的操作，
//       让 agent 和人用同一套入口跑实验，而不是每次手写临时脚本。
// 依赖：只依赖 experiment 里的纯规则内核，无 DOM、无第三方包。

import * as S from "../../experiments/tribe-opening/tribe-sim.js";

export const DEFAULT_BARRACKS = { q: 0, r: -1, stance: "hold" };

/** 新建一个实验世界（默认带一座兵营、启用军事子系统与命令延迟）。 */
export function createLab(opts = {}) {
  const seed = opts.seed ?? 1117;
  const military = opts.military ?? true;
  const orderDelay = opts.orderDelay ?? (military ? S.MILITARY.orderDelay : 0);
  const world = S.createWorld(seed, { military, orderDelay });
  const lab = { world, applied: [] };
  if (opts.barracks ?? military) {
    const b = opts.barracksAt ?? DEFAULT_BARRACKS;
    S.createBarracks(world, b.q, b.r, b.stance ?? "hold");
  }
  return lab;
}

/**
 * 把一句人类可读的动作作用到世界：
 *   deploy hunter 2 -1       部署战团
 *   order 3 move 1 0         给 3 号棋子下令移动到 (1,0)
 *   order 3 attack 5         指定攻击 5 号
 *   order 3 auto             恢复自主
 *   stance patrol            兵营方针
 *   train hunter             排队训练
 *   sortie                   立即出营
 *   install pack             安装文明规则
 *   barracks 2 -1 hold       再建一座兵营
 *   step 5                   推进 5 步
 */
export function applyAction(lab, spec) {
  const parts = String(spec).trim().split(/\s+/);
  const verb = parts[0];
  const w = lab.world;
  const barracks = () => w.barracks[w.barracks.length - 1];
  let result;
  switch (verb) {
    case "deploy": {
      const kind = parts[1];
      const q = Number(parts[2]);
      const r = Number(parts[3]);
      const res = S.deploy(w, kind, q, r);
      result = { ok: res.ok, note: res.ok ? `deploy ${kind} @${q},${r}` : `deploy failed: ${res.reason}` };
      break;
    }
    case "order": {
      const id = Number(parts[1]);
      const order = parts[2];
      let target = null;
      if (order === "attack") target = { id: Number(parts[3]) };
      else if (order === "move" || order === "hold") target = { q: Number(parts[3]), r: Number(parts[4]) };
      const ok = S.issueOrder(w, id, order, target);
      result = { ok, note: ok ? `order #${id} ${order}` : `order #${id} ${order} rejected` };
      break;
    }
    case "stance": {
      const ok = S.setStance(w, barracks()?.id, parts[1]);
      result = { ok, note: ok ? `stance ${parts[1]}` : `stance ${parts[1]} rejected` };
      break;
    }
    case "train": {
      const res = S.orderTraining(w, barracks()?.id, parts[1]);
      result = { ok: res.ok, note: res.ok ? `train ${parts[1]}` : `train failed: ${res.reason}` };
      break;
    }
    case "sortie": {
      const res = S.deployFromGarrison(w, barracks());
      result = { ok: res.ok, note: res.ok ? "sortie" : `sortie failed: ${res.reason}` };
      break;
    }
    case "install": {
      const ok = S.installRule(w, parts[1]);
      result = { ok, note: ok ? `install ${parts[1]}` : `install ${parts[1]} rejected` };
      break;
    }
    case "barracks": {
      const b = S.createBarracks(w, Number(parts[1]), Number(parts[2]), parts[3] || "hold");
      result = { ok: !!b, note: b ? `barracks @${parts[1]},${parts[2]}` : "barracks rejected" };
      break;
    }
    case "step": {
      const n = Number(parts[1] || 1);
      advance(lab, n);
      result = { ok: true, note: `step ${n}` };
      break;
    }
    default:
      result = { ok: false, note: `unknown action: ${spec}` };
  }
  lab.applied.push({ spec, ...result });
  return result;
}

/** 按顺序执行一组动作（字符串或数组）。遇到失败默认继续，并保留记录。 */
export function applyScript(lab, specs) {
  const list = Array.isArray(specs) ? specs : String(specs).split(";");
  const results = [];
  for (const spec of list) {
    if (!spec || !String(spec).trim()) continue;
    results.push(applyAction(lab, spec));
  }
  return results;
}

export function advance(lab, n = 1) {
  for (let i = 0; i < n; i++) S.stepWorld(lab.world);
  return lab;
}

export function state(lab) {
  return S.snapshot(lab.world);
}

/** 一行的紧凑摘要，便于在终端/MCP 里读。 */
export function brief(lab) {
  const s = state(lab);
  const humans = s.units.filter((u) => u.team === "human");
  const wild = s.units.filter((u) => u.team === "wild");
  const b = s.barracks[0];
  const lines = [
    `tick ${s.tick} · 第 ${s.day} 日 · 人口 ${s.pop} · 食物 ${s.food} · 击杀 ${s.kills}` +
      (s.rule ? ` · 规则 ${s.rule}` : ""),
    `我方 ${humans.length} 支` +
      (humans.length ? "：" + humans.map((u) => `${u.kind}@${u.q},${u.r}(${u.hp})`).join(" ") : "") +
      ` ｜野生 ${wild.length}`,
    b
      ? `兵营@${b.q},${b.r} 方针=${b.stance} 驻军 猎${b.garrison.hunter}/卫${b.garrison.guard}` +
        (b.training ? ` 训练中=${b.training.kind}(剩${b.training.left})` : "") +
        ` 已出营=${b.produced}`
      : "无兵营",
    `日志：` + (lab.world.logs.slice(0, 3).join(" ｜ ") || "（空）")
  ];
  return lines.join("\n");
}

/** 紧凑 JSON，便于写进文件或断言。 */
export function digest(lab) {
  const s = state(lab);
  return {
    tick: s.tick,
    day: s.day,
    pop: s.pop,
    food: s.food,
    kills: s.kills,
    rule: s.rule,
    squads: s.units.filter((u) => u.team === "human").length,
    wild: s.units.filter((u) => u.team === "wild").length,
    units: s.units.map((u) => `${u.kind}@${u.q},${u.r}:${u.hp}`),
    barracks: s.barracks.map((b) => `${b.stance}|猎${b.garrison.hunter}卫${b.garrison.guard}|出${b.produced}`)
  };
}

/**
 * 多臂对照：每臂 = {name, actions[]}，同种子、同步数跑完再比。
 * 这是这个项目里最常用的动作（"三臂对照"），所以做成一行调用。
 */
export function compare(arms, opts = {}) {
  const steps = opts.steps ?? 54;
  const rows = arms.map((arm) => {
    const lab = createLab({ seed: opts.seed ?? 1117, military: opts.military, orderDelay: opts.orderDelay });
    applyScript(lab, arm.actions || []);
    advance(lab, steps);
    const d = digest(lab);
    return { name: arm.name || "arm", ...d, logs: lab.world.logs.slice(0, 4) };
  });
  return { steps, rows };
}

/** 把 compare 的结果印成等宽表。 */
export function formatCompare(result) {
  const head = ["arm", "pop", "food", "squads", "kills", "day", "barracks"];
  const body = result.rows.map((r) => [
    r.name, r.pop, r.food, r.squads, r.kills, r.day, r.barracks.join("/") || "—"
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => String(row[i]).length)));
  const line = (row) => row.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  const out = [line(head), widths.map((n) => "-".repeat(n)).join("  "), ...body.map(line)];
  out.push(`（同种子、同 ${result.steps} 步）`);
  return out.join("\n");
}
