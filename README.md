# Wanjie Engine 0.4 · 网页 3D 棋盘基础版

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

## 项目设计档案（新成员/AI 接手请先读）

> **本 README 描述的是仓库内早期 0.4 代码现状，不代表《万界文明》设计止步于 0.4。**
> 游戏核心方向与近期六边形微雕美术方案已在下列文档归档；独立 HTML 研究原型的功能，不应误认为已经合入 main。

- [《万界文明》设计宪章与决策状态](docs/GAME_DESIGN_CANON.md)：卡牌构筑、三层作用对象、文明与世界、六边形空间、一格一建筑、镜头与已定/待定边界。
- [美术宪章与 AI 资产生产规范](docs/ART_BIBLE.md)：收藏级桌游微雕、**完整实体六边形石土地砖**、六向连接接口、Nano Banana → Meshy → Blender → GLB、性能与验收标准。

**当前美术优先事项**：制作用户指定样式的完整六边形石土/碎石/枯草实体微雕平地样板，再验证多格精准拼接和与矮人哨塔的风格统一；不要未经用户确认自行切换成程序化薄片或先去扩张道路/森林资产。
