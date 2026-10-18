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
