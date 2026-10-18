# 六边形底盘 / 地表装配与 LOD 实验

**状态：独立实验；未整合主引擎。**

启动：

```powershell
cd D:\Games\WanjieEngine
git pull origin main
py -m http.server 8000
```

打开 http://localhost:8000/experiments/hex-assembly-lod/ 。

页面自带**程序化占位六边形地块**，无需真实 GLB 也不会空白。可切换 1 / 19 / 37 格并调整 LOD；需要联网从 jsDelivr 加载 Three.js。

## 启用 Meshy 原始模型

由于当前 GitHub 连接不支持直接读取模型所在容器的二进制文件，**这次 Git 提交不含三份 GLB**。不要将占位预览误认为真实模型测试。

方法 A（无需再次提交）：下载之前提供的 `Wanjie_Hex_Assembly_LOD_Demo.zip`，解压后在网页“导入真实 GLB”选择 ZIP 中 `models/` 里的三份文件。

方法 B（一次性上传，从此可以 `git pull` 获得全部资源）：将三份模型放入此目录的 `models/` 中：

```text
models/base_lod1.glb
models/base_lod2.glb
models/terrain.glb
```

之后在本地仓库执行：

```powershell
git add experiments/hex-assembly-lod/models
git commit -m "assets: add Meshy hex base and terrain for LOD experiment"
git push origin main
```

完整模型 3 份合计约 14 MB；如长期维护，应考虑 Git LFS 或专用资产包，但这三份普通 Git 亦可承载。网页会自动尝试加载相对路径模型；即使模型找不到，也会显示可交互的占位棋盘。

## 验证范围

- 三种视野规模；按屏幕投影尺寸选择 LOD；模型文件输入、底盘/地表显隐、对位参数调试。
- 实际原生素材尚未精确六角重拓扑、UV/法线细节烘焙、近远场质量验证。
- 远景为代理网格而非正式烘焙 LOD3。
- 帧数、Draw Calls 需在**真实 GLB 自动加载成功后**才有参考意义；浏览器需实测。

## 2026-10-18：观察尺度实验

新增 91 格、217 格布局与六向地表旋转开关，用于观察镜头缩放时可见对象数量增长与绘制精度下降的关系。地表六向旋转只改善重复感，不生成新的地貌，不改变世界数值状态。此版仍不具有模拟 LOD（不含经济/战争/人口结算调度），且未在用户浏览器上完成性能验收；大规模渲染数据只代表当前浏览器的 draw calls / tris 计数。

在仓库根目录 `git pull origin main` 后按原地址刷新浏览器。原三份 GLB 若已安装于 models 文件夹，无需再次安装。
