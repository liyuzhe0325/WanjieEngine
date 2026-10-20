# WanjieEngine · 《万界文明》工程入口

> **新人从这里开始**：本仓库正在从多个历史实验收敛为正式游戏。当前开发优先级为**玩法与内容主线，微雕资产并行储备、暂缓批量美术接入**。先读 [最新开发流程](docs/DEVELOPMENT_WORKFLOW_2026-10-20.md)，再按下方入口运行。下面的 0.4 是早期编辑器版本号，不是整个项目的最新版本。

## 新人第一天做什么

1. 运行 `npm test`，保留结果；失败时先定位，不直接加内容。
2. 运行 `python -m http.server 8000`；访问 `/` 是**旧方格地图编辑器**，访问 `/experiments/hex-assembly-lod/` 才是**六角微雕实验**；**`game.html` 是新的六角游戏开发入口（只具备卡牌动作基本闭环，尚非完整文明游戏）**。
3. 阅读 [设计宪章](docs/GAME_DESIGN_CANON.md)、[统一主线整合台账](docs/ENGINE_MAIN_CONSOLIDATION_2026-10-19.md)、[质量台账](docs/QUALITY_LOG.md)。
4. 当前先复验地貌存档 WQ-001、GLB 提示 WQ-002 和真实场景 WQ-004，再推进六角正式游戏入口、选择/行动/反馈闭环。不要擅自回到美术接入或创建新长期分支。

## 正式游戏开发入口（2026-10-20）

打开 **http://localhost:8000/game.html**，进入六角数据驱动的 Three.js 3D 最小交互入口。可点击格子、选择演示卡、预览、确认、观察地貌变化或挂靠关系与事件日志。对应 `src/hex-game.js`（权威六角世界与卡牌事务）和 `src/game-main.js`（卡牌操作 UI、Three.js 占位渲染与实例拾取），3D 视图为 `src/hex-game-view.js`，复用 `src/hex-view-projection.js` 的六角坐标投影；测试在 `tests/hex-game.test.js`。模型是清楚标识的程序代理几何，未合入独立实验的 GLB / LOD 资产加载与优化。**这些仍是工程演示卡，不是正式内容或完整文明游戏。**

旧 `src/game.js` 仍依赖方格 `world.js`，本轮未迁移、也未让其同时成为权威游戏状态。后续必须审查/迁移旧实验而不是直接共用两套状态。

## 历史编辑器说明

### Wanjie Engine 0.4 · 网页 3D 棋盘基础版

本仓库包含《万界文明》的网页 3D 棋盘引擎技术原型，**不是已完成的游戏**。

## 运行

在项目根目录启动 `python -m http.server 8000`，随后打开 http://localhost:8000 。浏览器需联网从 CDN 加载 Three.js 0.180.0；暂不支持可靠离线运行。

## 测试

`node --test tests/*.test.js` 或 `npm test`。要求 Node.js 18+，测试无需 npm install。

## 架构

- `src/world.js`：确定性地图、编辑、撤销/重做、JSON 存档验证；不依赖浏览器。
- `src/view.js`：Three.js 地形网格、8×8 区块、实例化树木与石块、射线拾取、正交镜头。
- `src/main.js`：编辑器交互及文件导入导出。
- `tests/world.test.js`：数据层的五个自动测试。

## 参考与许可证

仅借鉴开源项目的技术思想，未复制代码或素材：
- [von-grid (MIT)](https://github.com/vonWolfehaus/von-grid)
- [threejs-hex-map (MIT)](https://github.com/Bunkerbewohner/threejs-hex-map)
- [Three.js docs](https://threejs.org/docs/)

## 已知限制

- 地貌与棋子使用程序几何占位模型，未达到美术目标。
- 地表修改后的格线不会同步重建；相邻区块的几何缓存可能需要联动更新。
- 缺少资源管线、性能基准、GPU 回归、自动浏览器截图和第三方依赖的本地构建。
- 逻辑测试与 JS 语法检查通过，不等于浏览器渲染通过。

## 游戏质量与验收

所有开发遵守 [GAME-QUALITY-001 长期质量协议](docs/GAME_QUALITY_001.md)。当前开放 P0–P3 问题及本轮审查见 [QUALITY_LOG](docs/QUALITY_LOG.md)。**代码提交不等于实际体验验收**；重要视觉和交互必须运行、截图与复验。

## 正式引擎统一整理（2026-10-19）

**统一主线为 `main`，不再按实验版本建立长期开发分支。** 已有微雕渲染、GLB、LOD、六角连接与卡牌实验仍分布在实验入口及历史分支；尚未完成正式游戏入口集成。

请先看 [全版本与分支整合台账](docs/ENGINE_MAIN_CONSOLIDATION_2026-10-19.md)，不要把根目录 0.4 编辑器当成整个引擎的最高版本，也不要直接批量合并/删除旧分支。

## 项目设计档案（新成员/AI 接手请先读）

> **本 README 描述的是仓库内早期 0.4 代码现状，不代表《万界文明》设计止步于 0.4。**
> 游戏核心方向与近期六边形微雕美术方案已在下列文档归档；独立 HTML 研究原型的功能，不应误认为已经合入 main。

- [《万界文明》设计宪章与决策状态](docs/GAME_DESIGN_CANON.md)：卡牌构筑、三层作用对象、文明与世界、六边形空间、一格一建筑、镜头与已定/待定边界。
- [美术宪章与 AI 资产生产规范](docs/ART_BIBLE.md)：收藏级桌游微雕、**完整实体六边形石土地砖**、六向连接接口、Nano Banana → Meshy → Blender → GLB、性能与验收标准。

**最新排期纠偏（2026-10-20）**：先做正式游戏玩法与内容；Meshy 有时限积分用于并行生成并储备微雕母版，**默认暂不接入**。先前平地微雕的外观与拼接验收要求依然有效，但不再是当前整个工程的开发阻塞项。详见 [开发流程](docs/DEVELOPMENT_WORKFLOW_2026-10-20.md)。
