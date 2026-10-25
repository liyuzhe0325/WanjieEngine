// 河谷流民实验的渲染与交互（Canvas + DOM）。规则全部在 tribe-sim.js，本文件不持有游戏状态权威。
import {
  R, SQRT3, CX, CY, CAMP, RULES, cell, createWorld, distance, installRule,
  issueOrder, snapshot, stepWorld, toXY, unitAt, unitById, aliveUnits, log
} from "./tribe-sim.js";

const cv = document.getElementById("field");
const ctx = cv.getContext("2d");
const $ = (id) => document.getElementById(id);

let world = createWorld();
let paused = false;
let speed = 1;
let last = 0;
let acc = 0;

function refresh() {
  $("pop").textContent = world.pop;
  $("food").textContent = world.food;
  $("threat").textContent = aliveUnits(world).some((u) => u.kind === "wolf") ? "捕食者" : "暂时安全";
  $("time").textContent = "第 " + world.day + " 日";
  const mine = aliveUnits(world).filter((u) => u.team === "human");
  $("status").textContent =
    "战团 " + mine.length + " 支 · 野生单位 " + aliveUnits(world).filter((u) => u.team === "wild").length + " 只";

  const u = unitById(world, world.selected);
  $("selected").textContent = u
    ? "已选：" + (u.kind === "hunter" ? "猎团" : "守卫") + " ｜生命 " + u.hp + "/" + u.maxHp +
      " ｜行为 " + u.order + (u.retreat ? "（" + u.retreat + "）" : "")
    : "选择一支我方战团";
  $("orderHint").textContent =
    world.mode === "select"
      ? "点击棋子选择；指令无需消耗卡牌。"
      : "当前指令：" + ({ move: "移动到指定格子", attack: "攻击选中的敌方目标", hold: "到指定格子坚守" }[world.mode] || world.mode);

  $("cardPrompt").textContent =
    world.offer && !world.rule
      ? "首次遭遇危险！选择一张长期机制牌，永久改变猎团行为。"
      : world.rule
        ? "已安装文明行为规则；这是早期构筑实验。"
        : "首次遭遇捕食者后开放两种行为构筑。";

  $("cards").innerHTML = "";
  if (world.offer && !world.rule) {
    for (const key of ["caution", "pack"]) {
      const b = document.createElement("button");
      b.innerHTML = RULES[key].title + "<small>" + RULES[key].desc + "</small>";
      b.addEventListener("click", () => {
        installRule(world, key);
        refresh();
      });
      $("cards").appendChild(b);
    }
  }
  $("installed").textContent = world.rule
    ? "已安装：" + RULES[world.rule].title
    : "可在危机发生后构筑";

  document.querySelectorAll("[data-order]").forEach((b) =>
    b.classList.toggle("active", b.dataset.order === world.mode)
  );
  draw();
}

function hexPath(x, y) {
  ctx.beginPath();
  for (let j = 0; j < 6; j++) {
    const a = (Math.PI / 180) * (60 * j - 30);
    const px = x + R * Math.cos(a);
    const py = y + R * Math.sin(a);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function draw() {
  ctx.clearRect(0, 0, 880, 660);
  for (const c of world.map.values()) {
    const [x, y] = toXY(c.q, c.r);
    hexPath(x, y);
    ctx.fillStyle = { plain: "#718767", wood: "#396849", hill: "#8e8266", water: "#477f96" }[c.t];
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#263d38";
    ctx.stroke();
    if (c.t === "wood") {
      ctx.fillStyle = "#244b36";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (c.t === "hill") {
      ctx.fillStyle = "#b9a783";
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 7);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x + 13, y + 7);
      ctx.fill();
    }
  }
  const [bx, by] = toXY(CAMP.q, CAMP.r);
  ctx.fillStyle = "#f0c678";
  ctx.beginPath();
  ctx.arc(bx, by, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#563925";
  ctx.fillRect(bx - 10, by + 8, 20, 5);

  for (const u of aliveUnits(world)) {
    const [x, y] = toXY(u.q, u.r);
    ctx.fillStyle =
      u.team === "human" ? (u.kind === "hunter" ? "#c2e59a" : "#a4cafa") : u.kind === "wolf" ? "#c9665b" : "#d3b985";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = u.id === world.selected ? "#fff281" : "#203237";
    ctx.lineWidth = u.id === world.selected ? 4 : 2;
    ctx.stroke();
    ctx.fillStyle = "#1b2525";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText({ hunter: "猎", guard: "卫", wolf: "狼", deer: "鹿" }[u.kind], x, y);
    ctx.fillStyle = "#1c2725";
    ctx.fillRect(x - 13, y - 21, 26, 4);
    ctx.fillStyle = "#e69b84";
    ctx.fillRect(x - 13, y - 21, 26 * Math.max(0, u.hp / u.maxHp), 4);
    if (u.id === world.selected && u.target && typeof u.target.q === "number") {
      const [tx, ty] = toXY(u.target.q, u.target.r);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = "#fce083";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#ecede6";
  ctx.font = "15px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("◎ 营地    ● 我方猎/卫    ● 野生鹿/狼", 18, 28);
  ctx.fillText("森林 / 山丘 / 河流：构成可见战术空间", 18, 50);
  ctx.fillText("已安装规则：" + (world.rule ? RULES[world.rule].title : "无"), 18, 72);
}

function fromPointer(e) {
  const rect = cv.getBoundingClientRect();
  const x = ((e.clientX - rect.left) * cv.width) / rect.width - CX;
  const y = ((e.clientY - rect.top) * cv.height) / rect.height - CY;
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / R;
  const r = ((2 / 3) * y) / R;
  const xx = q;
  const zz = r;
  const yy = -xx - zz;
  let rx = Math.round(xx);
  let ry = Math.round(yy);
  let rz = Math.round(zz);
  const dx = Math.abs(rx - xx);
  const dy = Math.abs(ry - yy);
  const dz = Math.abs(rz - zz);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

cv.addEventListener("click", (e) => {
  const p = fromPointer(e);
  if (!cell(world, p.q, p.r)) return;
  const clicked = unitAt(world, p.q, p.r);
  const current = unitById(world, world.selected);

  if (world.mode !== "select" && current) {
    if (world.mode === "attack") {
      if (clicked && clicked.team === "wild") {
        issueOrder(world, current.id, "attack", { id: clicked.id });
        log(world, "下令指定攻击");
      }
    } else {
      if (issueOrder(world, current.id, world.mode, p)) log(world, "下令：" + world.mode + " 至 " + p.q + "," + p.r);
      else log(world, "该格不可进入（水面）");
    }
    world.mode = "select";
  } else if (clicked && clicked.team === "human") {
    world.selected = clicked.id;
  } else {
    world.selected = null;
  }
  refresh();
});

document.querySelectorAll("[data-order]").forEach((b) =>
  b.addEventListener("click", () => {
    const u = unitById(world, world.selected);
    if (!u) {
      log(world, "请先选中友方战团");
      return;
    }
    if (b.dataset.order === "auto") {
      issueOrder(world, u.id, "auto");
      world.mode = "select";
      log(world, "战团恢复自主行动");
    } else {
      world.mode = b.dataset.order;
    }
    refresh();
  })
);

$("pause").addEventListener("click", () => {
  paused = !paused;
  $("pause").textContent = paused ? "继续" : "暂停";
});
$("speed").addEventListener("click", () => {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  $("speed").textContent = speed + "× 速度";
});
$("reset").addEventListener("click", () => {
  world = createWorld();
  paused = false;
  speed = 1;
  acc = 0;
  $("speed").textContent = "1× 速度";
  $("pause").textContent = "暂停";
  log(world, "流民扎营。猎团自主狩猎，守卫驻守营地。");
  renderLog();
  refresh();
});

function renderLog() {
  const el = $("log");
  el.innerHTML = "";
  for (const s of world.logs) {
    const d = document.createElement("div");
    d.textContent = s;
    el.appendChild(d);
  }
}

// 日志变化后同步 DOM（stepWorld 会写入 world.logs）
const _stepWorld = stepWorld;
function tickOnce() {
  _stepWorld(world);
  renderLog();
  if (world.halted) {
    paused = true;
    $("pause").textContent = "继续";
    log(world, world.pop === 0 ? "部落覆灭，可重新开始" : "食物耗尽！请重新开始或继续观察");
    renderLog();
  }
}

function frame(now) {
  if (!last) last = now;
  const dt = Math.min(0.2, (now - last) / 1000);
  last = now;
  if (!paused) {
    acc += dt * speed;
    while (acc >= 0.65) {
      tickOnce();
      acc -= 0.65;
    }
    refresh();
  }
  requestAnimationFrame(frame);
}

// 供自动化验证读取状态（不影响游戏逻辑）
window.__lab = {
  get world() {
    return world;
  },
  snapshot: () => snapshot(world),
  paused: (v) => {
    paused = v;
    last = 0;
    acc = 0;
  },
  reset: (seed) => {
    world = createWorld(seed);
    refresh();
  },
  install: (key) => {
    installRule(world, key);
    refresh();
  },
  order: (id, order, target) => {
    issueOrder(world, id, order, target);
    refresh();
  },
  step: (n = 1) => {
    for (let i = 0; i < n; i++) stepWorld(world);
    renderLog();
    refresh();
  }
};

log(world, "流民扎营。猎团自主狩猎，守卫驻守营地。");
renderLog();
refresh();
requestAnimationFrame(frame);
