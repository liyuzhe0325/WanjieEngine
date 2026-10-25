# tribe-lab · 万界文明战棋实验的开发脚手架

给「人」和「agent」共用的实验台：把**建世界 → 下指令 → 推进 → 多臂对照**变成一行调用，
不用每次现写临时脚本、也不用每次开浏览器点。

数据源只有一个：`experiments/tribe-opening/tribe-sim.js`（纯规则内核，无 DOM）。
本目录不复制任何规则，只做调用与对照。

## 三种入口

| 入口 | 给谁用 | 例子 |
|---|---|---|
| 库 `sim-lab.mjs` | 测试 / 其它脚本 | `createLab()` → `applyScript()` → `compare()` |
| CLI `cli.mjs` | 人（终端） | `node tools/tribe-lab/cli.mjs ab ...` |
| MCP `mcp-server.mjs` | agent（工具调用） | 见下方"注册到 Hermes" |

## 动作语法

```
deploy hunter 2 -1        部署战团（营地 2 格内、非水面、未占用）
order 3 move 1 0          给 3 号棋子下令移动
order 3 attack 5          指定攻击 5 号
order 3 auto              恢复自主
stance patrol             兵营方针：hold / patrol / reinforce / reserve
train hunter              排队训练（猎团 6 食物 / 守卫 8）
sortie                    立即出营
install pack              安装文明规则：caution / pack
barracks 2 -1 hold        再建一座兵营
step 5                    推进 5 步
```

多条动作用 `;` 串，或在 CLI 里重复 `--do`。

## CLI 常用配方

```bash
# 看一眼新局
node tools/tribe-lab/cli.mjs new

# 执行动作后推进
node tools/tribe-lab/cli.mjs run --steps 30 --do "deploy guard 2 -1" --do "stance patrol"

# 三臂对照（本项目最常用的实验形式：同种子、同步数）
node tools/tribe-lab/cli.mjs ab --steps 54 \
  --arm "不部署:" \
  --arm "前压:deploy guard 2 -1;deploy hunter 1 1" \
  --arm "兵营出兵:train guard;train hunter;step 12;stance patrol"

# 跑测试 / 起服务器
node tools/tribe-lab/cli.mjs test
node tools/tribe-lab/cli.mjs serve --port 8123
```

输出示例（真实运行结果）：

```
arm   pop  food  squads  kills  day  barracks
----  ---  ----  ------  -----  ---  --------------
不部署   15   56    1       7      4    hold|猎0卫0|出0
前压    20   24    4       6      4    hold|猎0卫0|出0
兵营出兵  15   42    2       7      4    patrol|猎1卫0|出1
（同种子、同 54 步）
```

## 注册到 Hermes（让 agent 直接调）

已在本机注册为 MCP 服务器 `wanjie-lab`（8 个工具）。换机器或换路径时：

```bash
hermes mcp add wanjie-lab \
  --command <node 可执行文件> \
  --args <仓库绝对路径>/tools/tribe-lab/mcp-server.mjs
```

工具清单：`lab_new` / `lab_do` / `lab_step` / `lab_state` / `lab_ab` / `tests_run` / `serve_start` / `serve_stop`。

> 注意：MCP 注册的是**某一台机器上的某个路径**。仓库被移动或改名后要重新注册，
> 否则 agent 会拿到"服务器连不上"，而不是拿到旧代码。

## 设计约束（这不是摆设）

1. **不做第二套规则**：本层只调用内核，禁止在这里写"临时判定"。规则改在 `tribe-sim.js`，测试跟着走。
2. **不做渲染 / 不做截图**：视觉验证仍走真实浏览器，本工具只跑规则与数值。
3. **默认确定性**：同种子 + 同动作 = 同结果；`ab` 因此可以当证据用，而不是"看起来差不多"。
4. **失败可见**：动作失败返回原因（超半径、水面、占用、食物不足、驻军为空……），不静默跳过。

## 现状与已知限制

- 军粮、训练时长、部署成本、命令延迟、同屏预算都是**实验常量**（见 `MILITARY` / `DEPLOY` / `STATS`），随时可能改。
- 测试会屏蔽"每日刷新野生动物"的干扰（`runIsolated` 一类），真实对局的波次压力比测试更狠。
- 只覆盖战棋内核：没有文明经济、卡牌概率波、碰撞包围、存档。
