import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createLab, applyAction, applyScript, advance, digest, brief, compare, formatCompare
} from '../tools/tribe-lab/sim-lab.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ——————————————————— 动作 DSL ———————————————————

test('DSL：部署/训练/出营/方针/规则都能通过一行动作完成', () => {
  const lab = createLab();
  assert.equal(applyAction(lab, 'stance reserve').ok, true);
  assert.equal(applyAction(lab, 'train hunter').ok, true);
  const foodAfterQueue = lab.world.food;
  advance(lab, 7);
  assert.equal(lab.world.barracks[0].garrison.hunter, 1, '训练完成应进驻军池');
  assert.ok(lab.world.food <= foodAfterQueue, '训练应扣食物');
  assert.equal(applyAction(lab, 'sortie').ok, true);
  assert.equal(lab.world.units.filter((u) => u.team === 'human').length, 3);
  assert.equal(applyAction(lab, 'install pack').ok, true);
  assert.equal(lab.world.rule, 'pack');
});

test('DSL：非法动作返回失败但不抛错', () => {
  const lab = createLab();
  assert.equal(applyAction(lab, 'deploy hunter 9 9').ok, false, '超半径应失败');
  assert.equal(applyAction(lab, 'stance nope').ok, false);
  assert.equal(applyAction(lab, 'teleport 1 2').ok, false, '未知动作应失败');
  assert.equal(applyAction(lab, 'order 999 move 1 1').ok, false, '不存在的棋子');
});

test('DSL：applyScript 支持数组与分号字符串', () => {
  const a = createLab();
  const ra = applyScript(a, ['deploy guard 2 -1', 'step 5']);
  assert.equal(ra.length, 2);
  const b = createLab();
  const rb = applyScript(b, 'deploy guard 2 -1;step 5');
  assert.equal(rb.length, 2);
  assert.deepEqual(digest(a).units, digest(b).units);
});

// ——————————————————— 多臂对照 ———————————————————

test('ab：同种子同步骤，不同部署位置产生不同结果且可复现', () => {
  const arms = [
    { name: '不部署', actions: [] },
    { name: '前压', actions: ['deploy guard 2 -1', 'deploy hunter 1 1'] }
  ];
  const one = compare(arms, { steps: 54 });
  const two = compare(arms, { steps: 54 });
  assert.equal(one.rows.length, 2);
  assert.deepEqual(one.rows.map((r) => r.pop), two.rows.map((r) => r.pop), '两臂同条件下必须可复现');
  const table = formatCompare(one);
  assert.match(table, /不部署/);
  assert.match(table, /前压/);
  assert.notEqual(one.rows[0].pop + one.rows[0].squads, one.rows[1].pop + one.rows[1].squads, '部署与否应产生可观测差异');
});

test('brief：摘要包含兵营/驻军/日志三类信息', () => {
  const lab = createLab();
  applyScript(lab, ['train guard', 'step 9']);
  const s = brief(lab);
  assert.match(s, /兵营@/);
  assert.match(s, /方针=/);
  assert.match(s, /日志：/);
});

// ——————————————————— CLI ———————————————————

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['tools/tribe-lab/cli.mjs', ...args], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (code) => resolve({ code, out }));
  });
}

test('CLI：ab 子命令能跑出对照表', async () => {
  const r = await runCli(['ab', '--steps', '12', '--arm', '空:', '--arm', '部署:deploy guard 2 -1']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /不|空/);
  assert.match(r.out, /部署/);
  assert.match(r.out, /同种子/);
});

test('CLI：run 子命令执行动作并打印状态', async () => {
  const r = await runCli(['run', '--steps', '6', '--do', 'deploy hunter 1 1', '--do', 'stance patrol']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok/);
  assert.match(r.out, /兵营@/);
});

// ——————————————————— MCP 握手 ———————————————————

function mcpSession(messages, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/tribe-lab/mcp-server.mjs'], { cwd: ROOT });
    let buf = '';
    const seen = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('MCP 超时，已收到：' + JSON.stringify(seen)));
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      buf += d;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) seen.push(JSON.parse(line));
      }
      if (seen.length >= messages.length) {
        clearTimeout(timer);
        child.kill();
        resolve(seen);
      }
    });
    child.stderr.on('data', (d) => (buf += ''));
    child.on('error', reject);
    for (const m of messages) child.stdin.write(JSON.stringify(m) + '\n');
  });
}

test('MCP：initialize / tools/list / 工具调用都能正常应答', async () => {
  const replies = await mcpSession([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lab_do', arguments: { actions: ['deploy guard 2 -1', 'step 3'] } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'lab_state', arguments: {} } }
  ]);
  const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
  assert.equal(byId[1].result.serverInfo.name, 'wanjie-tribe-lab');
  const tools = byId[2].result.tools.map((t) => t.name);
  for (const name of ['lab_new', 'lab_do', 'lab_step', 'lab_state', 'lab_ab', 'tests_run', 'serve_start', 'serve_stop']) {
    assert.ok(tools.includes(name), '缺少工具 ' + name);
  }
  const doText = byId[3].result.content[0].text;
  assert.match(doText, /deploy guard/);
  assert.match(doText, /兵营@/);
  assert.match(byId[4].result.content[0].text, /tick/);
});

test('MCP：lab_ab 返回对照表，未知工具返回错误内容', async () => {
  const replies = await mcpSession([
    {
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'lab_ab', arguments: { steps: 10, arms: [{ name: '甲', actions: [] }, { name: '乙', actions: ['deploy guard 2 -1'] }] } }
    },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nope', arguments: {} } }
  ]);
  const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
  assert.match(byId[1].result.content[0].text, /甲/);
  assert.match(byId[1].result.content[0].text, /乙/);
  assert.equal(byId[2].result.isError, true);
});
