#!/usr/bin/env node
// 万界文明 · 战棋实验 MCP 服务器（零依赖，stdio + 行分隔 JSON-RPC）
// 目的：让 agent 用工具调用的方式跑实验（建世界/下指令/推进/多臂对照/跑测试/起服务），
//       而不是每次现写临时脚本。与 CLI 共用同一层 sim-lab。

import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createLab, applyScript, advance, brief, digest, compare, formatCompare } from "./sim-lab.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER = { name: "wanjie-tribe-lab", version: "0.1.0" };
const PROTOCOL = "2024-11-05";

let lab = createLab();
let server = null; // { child, port }

const TOOLS = [
  {
    name: "lab_new",
    description: "新建一局战棋实验世界（默认启用军事子系统与命令延迟、带一座兵营），返回状态摘要。",
    inputSchema: {
      type: "object",
      properties: {
        seed: { type: "number", description: "随机种子（默认 1117）" },
        military: { type: "boolean", description: "是否启用兵营/军粮/命令延迟（默认 true）" },
        orderDelay: { type: "number", description: "命令在途步数（默认取 MILITARY.orderDelay）" }
      }
    }
  },
  {
    name: "lab_do",
    description:
      "对当前世界执行动作。动作语法与 CLI 相同，例如 " +
      "deploy hunter 2 -1 / order 3 move 1 0 / order 3 attack 5 / stance patrol / train hunter / sortie / install pack / step 5。",
    inputSchema: {
      type: "object",
      properties: { actions: { type: "array", items: { type: "string" } } },
      required: ["actions"]
    }
  },
  {
    name: "lab_step",
    description: "推进当前世界若干步（每步 = 一个 tick）。",
    inputSchema: { type: "object", properties: { n: { type: "number" } } }
  },
  {
    name: "lab_state",
    description: "读取当前世界的紧凑状态（含兵营驻军、在野部队、日志）。",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "lab_ab",
    description: "同种子多臂对照：每臂给名字和动作序列，跑同样步数后返回对照表。这是本项目最常用的实验形式。",
    inputSchema: {
      type: "object",
      properties: {
        arms: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, actions: { type: "array", items: { type: "string" } } },
            required: ["name"]
          }
        },
        steps: { type: "number" },
        seed: { type: "number" }
      },
      required: ["arms"]
    }
  },
  {
    name: "tests_run",
    description: "运行 node --test（默认 tests/*.test.js），返回通过/失败计数与输出尾部。",
    inputSchema: {
      type: "object",
      properties: { file: { type: "string", description: "只跑某个测试文件" } }
    }
  },
  {
    name: "serve_start",
    description: "在仓库根目录起本地 http 服务器，返回可打开的试玩地址。",
    inputSchema: { type: "object", properties: { port: { type: "number" } } }
  },
  {
    name: "serve_stop",
    description: "停止由 serve_start 起的服务器。",
    inputSchema: { type: "object", properties: {} }
  }
];

function text(s, isError = false) {
  return { content: [{ type: "text", text: s }], isError };
}

function runTests(file) {
  return new Promise((resolve) => {
    const args = ["--test", file || "tests/*.test.js"];
    const child = spawn(process.execPath, args, { cwd: ROOT });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("exit", (code) => {
      const num = (k) => (out.match(new RegExp("^ℹ " + k + " (\\d+)", "m")) || [])[1] ?? "?";
      resolve({
        exit: code,
        tests: num("tests"),
        pass: num("pass"),
        fail: num("fail"),
        tail: out.trim().split("\n").slice(-12).join("\n")
      });
    });
  });
}

function startServer(port) {
  if (server) return { ok: true, url: `http://127.0.0.1:${server.port}/experiments/tribe-opening/`, reused: true };
  const child = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  server = { child, port };
  return { ok: true, url: `http://127.0.0.1:${port}/experiments/tribe-opening/`, pid: child.pid };
}

async function callTool(name, a = {}) {
  switch (name) {
    case "lab_new": {
      lab = createLab({ seed: a.seed ?? 1117, military: a.military, orderDelay: a.orderDelay });
      return text(brief(lab));
    }
    case "lab_do": {
      const results = applyScript(lab, a.actions || []);
      const failed = results.filter((r) => !r.ok);
      return text(
        (results.map((r) => (r.ok ? "ok   " : "FAIL ") + r.note).join("\n") || "（无动作）") +
          "\n\n" + brief(lab),
        failed.length > 0 && failed.length === results.length
      );
    }
    case "lab_step": {
      advance(lab, a.n ?? 1);
      return text(brief(lab));
    }
    case "lab_state":
      return text(brief(lab) + "\n\n" + JSON.stringify(digest(lab), null, 2));
    case "lab_ab": {
      if (!Array.isArray(a.arms) || a.arms.length < 2) return text("需要至少两臂", true);
      const result = compare(a.arms, { steps: a.steps ?? 54, seed: a.seed ?? 1117 });
      return text(formatCompare(result) + "\n" + result.rows.map((r) => `  ${r.name}: ${r.logs[0] || "—"}`).join("\n"));
    }
    case "tests_run": {
      const r = await runTests(a.file);
      return text(
        `exit=${r.exit} tests=${r.tests} pass=${r.pass} fail=${r.fail}\n${r.tail}`,
        r.exit !== 0
      );
    }
    case "serve_start": {
      const r = startServer(a.port ?? 8123);
      return text(JSON.stringify(r));
    }
    case "serve_stop": {
      if (!server) return text("没有运行中的服务器");
      try { process.kill(server.child.pid); } catch { /* 已退出 */ }
      server = null;
      return text("已停止");
    }
    default:
      return text(`未知工具：${name}`, true);
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER }
    };
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    const { name, arguments: a } = params || {};
    try {
      const result = await callTool(name, a || {});
      return { jsonrpc: "2.0", id, result };
    } catch (err) {
      return { jsonrpc: "2.0", id, result: text("工具执行失败：" + err.message, true) };
    }
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
}

const rl = readline.createInterface({ input: process.stdin });
let queue = Promise.resolve();
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
    return;
  }
  queue = queue
    .then(() => handle(msg))
    .then((res) => { if (res) process.stdout.write(JSON.stringify(res) + "\n"); })
    .catch((err) => {
      process.stdout.write(
        JSON.stringify({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: String(err && err.message) } }) + "\n"
      );
    });
});

rl.on("close", () => {
  if (server) {
    try { process.kill(server.child.pid); } catch { /* ignore */ }
  }
  process.exit(0);
});
