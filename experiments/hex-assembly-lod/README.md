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

## v3：实例化与真实地表纹理（实验）

- 不再对 19 格画面强制 3 格高模 / 8 格中模的固定数量上限。按屏幕像素大小优先选择 LOD；共享 GLB 的几何和 PBR 材质通过 `THREE.InstancedMesh` 批量绘制。
- 给可见几何配置可调的三角面预算（初始 2M）；超过预算时先降级远处的地块。**预算是保护机制，不是成熟游戏画质标准**。LOD 切换暂未 crossfade，边缘跳变仍可能出现。
- 若尚未生产 LOD2，远景使用复用地表原始 base color 纹理的轻量几何代理，不再是纯色面片。
- 自动加载原三份 GLB，以及可选的 `terrain_lod1.glb` / `terrain_lod2.glb`；支持 Blender 脚本生成后刷新。
- 此版本需要网页实机验收；**尚未测得用户机器的 FPS、显存和帧时间**。

### 使用 Blender 本地生成地表简化版本

请确保 Blender CLI 已安装。模型需位于 `experiments/hex-assembly-lod/models/terrain.glb`。

在仓库根目录执行（可将 `blender` 替换为 Blender.exe 的完整路径）：

```powershell
blender --background --python experiments/hex-assembly-lod/blender_make_terrain_lods.py
```

生成近似 4500 面的 `terrain_lod1.glb` 与 1400 面的 `terrain_lod2.glb`。材质与 UV 随 GLB 导出，但 Blender 简化器可能损伤极细碎草/石几何，**务必在浏览器和 Blender 中检查效果**。脚本只生成简化资产，不执行完整法线贴图重烘焙；烘焙仍需后续独立工序。

## v3.1：LOD 防抖与浏览器 FPS

- 为每个轴坐标地块跟踪上次视觉 LOD，使用屏幕尺寸阈值 ±12% 的滞回区间，减少镜头轻微移动时频繁切换。
- LOD 更新间隔由 180 ms 调整到 90 ms（接近 11 Hz），使缩放响应更及时；GPU 仍逐帧渲染。
- 侧栏显示浏览器主循环近似 FPS，便于后续与性能预算比较；不代表 GPU 详细计时。
- **还未实现 cross-fade / dither fade**。截图中的近远景材质和雕刻边框差异仍可能形成明显的带状边界；下一步应通过底盘 LOD2、材质匹配与 GPU 过渡改进。
- 不能仅凭地表面数降低判断优化成功，需要在目标设备上对比放大/缩小的 FPS、帧时间以及视角变化时的闪烁。

## v3.2：按摄像机离地高度统一画质

- 改用 `abs(camera.position.y - controls.target.y)` 作为整个棋盘的统一缩放 LOD 决策依据，不再逐地块使用摄像机斜距形成可见画质分割线。仅针对当前平整实验棋盘；未来有山地/楼层时须使用真实观察投影误差、地表高度或区域分层。
- 分为 5 个缩放区间（初始高度边界 4、7、12、20，含 ±10% 滞回），但目前只有 3 套绘制几何，映射为 0/0/1/1/2；**尚不等于 5 套独立高质量模型**。
- 预算不足时全视野统一降低几何档位，避免出现不连续的高低模带状分界；这一方式在非常大的视野下有画质代价。
- OrbitControls 调整了阻尼、旋转速度、缩放速度、最小/最大角度。仍没有真正跨模型 dissolve/crossfade、GPU 定时和自动质量调节。
- 更新方式：在仓库根目录 `git pull origin main`；浏览器强制刷新。模型文件不变。

## v3.3：荒地与草地同一实验入口

正式测试入口仍为 `/experiments/hex-assembly-lod/`，不再需要打开另一套 `tools/meadow-lod-viewer` 页面。保留旧页面仅为历史实验，不再作为优先入口。

- “地表材质族”切换荒地 / 草地，共享现有 Hex 坐标、1/19/37/91/217 格、InstancedMesh、镜头控制、全局 LOD、FPS 统计。
- 草地模型可自动从 `models/` 加载，也能通过页面导入：`meadow_lod1.glb`（约 40981 面）、`meadow_lod2.glb`（9249）、`meadow_lod3.glb`（2715）、`meadow_lod4.glb`（730）。
- **GitHub 此次只提交了代码，未提交草地二进制模型。** 用户原有 `models/` 的五个 GLB 不受影响。缺失草地时显示明确警告并使用代理几何，不应误认为真实草地。
- 目前草地共用旧地表“缩放/高度”校准滑块，因此默认值未必贴合石底座；先在单块模式手动校准，再检查 19 格接缝。
- 这仍是实验用四套草地简化几何与全局镜头档位映射，未做到草地颜色图远景烘焙、精确边界重拓扑和 GPU 基准测试。请检查 UV、地表穿插和 19 格重复纹理。

本地同步（确保先处于 main）：

```powershell
git switch main
git pull --ff-only origin main
py -m http.server 8000
```
