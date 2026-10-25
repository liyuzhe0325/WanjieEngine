#!/usr/bin/env node
// 万界文明 · 战棋实验 CLI
// 用法示例：
//   node tools/tribe-lab/cli.mjs new
//   node tools/tribe-lab/cli.mjs run --steps 40 --do "deploy guard 2 -1" --do "install pack"
//   node tools/tribe-lab/cli.mjs ab --steps 54 --arm "不部署:" --arm "部署:deploy guard 2 -1;deploy hunter 1 1"
//   node tools/tribe-lab/cli.mjs test
//   node tools/tribe-lab/cli.mjs serve --port 8123

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createLab, applyScript, advance, brief, digest, compare, formatCompare
} from "./sim-lab.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const out = { _: [], do: [], arm: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--do") out.do.push(argv[++i]);
    else if (a === "--arm") out.arm.push(argv[++i]);
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function parseArm(spec) {
  const idx = spec.indexOf(":");
  if (idx < 0) return { name: spec, actions: [] };
  return { name: spec.slice(0, idx) || "arm", actions: spec.slice(idx + 1).split(";").filter(Boolean) };
}

function runNode(args, opts = {}) {
  return spawn(process.execPath, args, { cwd: ROOT, stdio: opts.stdio || "inherit" });
}

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const cmd = args._[0] || "help";

switch (cmd) {
  case "new": {
    const lab = createLab({ seed: Number(args.seed ?? 1117) });
    console.log(args.json ? JSON.stringify(digest(lab), null, 2) : brief(lab));
    break;
  }
  case "run": {
    const lab = createLab({ seed: Number(args.seed ?? 1117) });
    const acts = args.do.flatMap((s) => String(s).split(";")).filter(Boolean);
    const results = applyScript(lab, acts);
    advance(lab, Number(args.steps ?? 0));
    if (args.json) {
      console.log(JSON.stringify({ digest: digest(lab), applied: results }, null, 2));
    } else {
      for (const r of results) console.log((r.ok ? "ok   " : "FAIL ") + r.note);
      console.log("");
      console.log(brief(lab));
    }
    break;
  }
  case "ab": {
    if (args.arm.length < 2) {
      console.error("至少需要两个 --arm \"名字:动作;动作\"");
      process.exit(2);
    }
    const result = compare(args.arm.map(parseArm), {
      steps: Number(args.steps ?? 54),
      seed: Number(args.seed ?? 1117)
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatCompare(result));
      for (const row of result.rows) console.log(`  ${row.name} 日志：${row.logs[0] || "—"}`);
    }
    break;
  }
  case "test": {
    const files = args._.slice(1);
    const child = runNode(["--test", ...(files.length ? files : ["tests/*.test.js"])]);
    child.on("exit", (code) => process.exit(code ?? 0));
    break;
  }
  case "serve": {
    const port = Number(args.port ?? 8123);
    console.log(`serving ${ROOT} at http://127.0.0.1:${port}/experiments/tribe-opening/`);
    const child = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
      cwd: ROOT,
      stdio: "inherit"
    });
    child.on("exit", (code) => process.exit(code ?? 0));
    break;
  }
  default: {
    console.log(`万界文明 · 战棋实验脚手架

  new                            新建一局并打印摘要
  run --steps N --do "动作"      执行动作后推进 N 步
  ab --steps N --arm "名字:..."  同种子多臂对照（至少两臂）
  test [文件...]                 跑 node --test
  serve [--port 8123]            起本地服务器

动作语法：
  deploy hunter 2 -1             部署战团
  order 3 move 1 0               移动指令（也支持 order 3 attack 5 / order 3 auto）
  stance patrol                  兵营方针：hold/patrol/reinforce/reserve
  train hunter                   排队训练
  sortie                         立即出营
  install pack                   安装文明规则：caution/pack
  barracks 2 -1 hold             再建一座兵营
  step 5                         推进 5 步
`);
  }
}
