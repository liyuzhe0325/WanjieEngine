# WanjieEngine 统一主线整理台账（2026-10-19）

> 状态：整合工作清单，不宣称已完成迁移。唯一长期开发目标为 `main`；保留实验与未合入分支，直到逐项审查并通过回归。禁止强制重置、批量 cherry-pick、提前删除分支或覆盖 GLB 高模。

## 1. 当前真实入口

| 入口 | 文件 | 现状 | 处理 |
|---|---|---|---|
| 根目录编辑器 | `index.html` → `src/main.js` | 0.4 方格世界编辑器 | 暂保留；未来迁至 `editor.html`，先确保等价测试 |
| 六角微雕 LOD | `experiments/hex-assembly-lod/index.html` → `viewer-v3.js` | 217 格、草地/荒地、GLB、五缩放档/多套几何、实例化、统计 | **正式渲染的主要遗产**，不得用旧 `src/view.js` 替代 |
| 卡牌环境/屏障 | `src/card-world-experiment.js`、`src/card-command-queue.js` 等 | 独立实验逻辑 | 审查后合并到正式游戏会话 |
| 新卡牌实例层 | `src/game.js` | 两种演示操作；未接 UI | 与屏障实验先统一数据契约，避免两个权威游戏状态 |

**版本号不能混用**：0.4 是 package.json 早期工程基线；0.9/1.3/1.4 为单文件实验版号；六角装配 LOD 的 v3.5 是另一条实验线的内部版本，不等于发行版本。

## 2. main 现存遗产

- `src/world.js`：旧方格数据；**不能直接当成正式轴坐标六角世界**。
- `src/view.js`：早期渲染；保留已验证的编辑器交互与材质实现。
- `src/asset-catalog.js`、`src/asset-loader.js`：基础 glTF 登记及实例化加载。
- `src/terrain-assets.js`、`experiments/hex-assembly-lod/terrain-assets.json`：地形资源清单和加载校验。
- `experiments/hex-assembly-lod/viewer-v3.js`：六角地表真实 GLB 实例化及视角/LOD。
- `docs/ART_BIBLE.md`、`docs/GAME_DESIGN_CANON.md`：正式美术/设计边界，不代表功能实现。

## 3. 资产缺口：登记不等于二进制交付

资源清单列出如下九份 GLB 名称：
- 石质底盘：`base_lod1.glb`、`base_lod2.glb`
- 荒地：`terrain.glb`、`terrain_lod1.glb`、`terrain_lod2.glb`
- 草地：`meadow_lod1.glb` 至 `meadow_lod4.glb`

仓库历史 README 明确提示：**草地四份二进制当时尚未上传**，原三份底盘/地形 GLB 最初也未随代码提交。故必须通过 Git tree/本地文件核实每个文件是否真正存在；缺失时不得用代理模型冒充已完成的真实微雕美术。保留高模原件、优化版与版权信息，禁止自动覆盖。

## 4. main 外分支对照（以 2026-10-19 对比结果为准）

以下 `ahead` 是相对 main 的独有提交数，**不是必须逐条合并的次数**。

| 分支 | ahead / behind | 需要继承/检查 | 优先级 |
|---|---:|---|---|
| `refactor/hex-space-contract-001` | 13 / 18 | `src/hex-space.js`、模型清单、加载代际、资源生命周期；另含 viewer-v3 变更 | P0 |
| `foundation/controlled-world-state-001` | 4 / 5 | `world-store.js` 控制权威写入及基准测试；代码仍针对旧方格 | P0 |
| `feature/card-barrier-replay-001` | 12 / 21 | 卡牌界面、预览、反馈、回放、屏障测试；注意旧方格映射并非真六角空间 | P0 |
| `fix/world-state-invariants-001` | 4 / 19 | 世界状态不变量和测试；与 main 已合并的 #8 核对 | P1 |
| `feature/board-material-pass` | 2 / 68 | 材质改动与视觉文档；需对比当前渲染基线 | P1 |
| `feature/gltf-board-instance` | 6 / 69 | 样例 glTF 放置及资源生命周期；检查是否已入 main | P1 |
| `feature/model-asset-registry` | 6 / 70 | 资源登记、加载及测试；检查是否已入 main | P1 |
| `fix/terrain-edit-seams` | 2 / 71 | 旧编辑器接缝修复；检查是否已入 main | P2 |
| `feature/import-engine-0.4` | 10 / 72 | 初始工程基线；多数应已进 main | P2 |

这些分支当前均为 diverged；**禁止直接合并全部历史**。逐模块提取，单独测试，完成后再归档。

## 5. 统一路线（仅 main 长期保留）

1. **保全阶段**：记录全部分支指针与 main HEAD；保留旧入口和现有资产；不修改渲染结果。
2. **空间与状态**：引入轴坐标契约/共享边状态，隔离方格兼容层；状态由单一权威所有者写入，新增回归。
3. **渲染与资源**：让正式六角世界消费现有 GLB 清单和实例化渲染；保护加载并发与 GPU 资源；不丢 v3.5 LOD / 镜头设置。
4. **游戏与编辑器**：在同一空间数据上提供一个正式游戏入口和一个正式编辑器入口；逐步吸收卡牌预览、屏障结算、回放。
5. **验收并收尾**：Node 测试、浏览器 WebGL、真实 GLB 画面、217 格视角和性能、导入/存档、卡牌投放均验收后，才更新根目录入口及归档旧实验。

## 6. 迁移门槛

- 任何替换必须保留可以对照的旧实验入口，直到新入口实测过关。
- 真实 GLB 缺失时明确提示，禁止悄悄降级并声称通过美术验收。
- 地块身份、共享边、建筑占格、卡牌挂载引用必须有单一规则。
- 跨文件修改尽量作为单主题提交直接落在 main；避免新建长期功能分支，允许小范围临时工作区但不形成新长期开发线。
- 禁止以提交或语法检查替代真实浏览器和 GPU 测试。
- 每次实质迁移更新此台账：已迁移、待迁移、回归结果、风险。
