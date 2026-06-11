# cad/ — Three.js 快速试错沙盒

> **定位变化（2026-06-11）**：原本是主预览，转 Onshape 后降级为"快速试错沙盒"。
> Onshape 才是 [主预览/装配/出图](../onshape/) 的地方，cad/ 留作改尺寸快速看冲突。

## 这里有什么

| 文件 | 用途 |
|---|---|
| **[model.js](model.js)** | ★ **单一数据源**（所有零件几何 + BOM 元数据）— 整个项目唯一真相 |
| **[roof-rack-3d.html](roof-rack-3d.html)** | 浏览器交互预览，Three.js + dat.GUI — 滑块改参数立刻看 3D |

## 用法

```bash
# 启动本地服务（项目根目录）
python3 -m http.server 8787

# 浏览器打开
open http://localhost:8787/cad/roof-rack-3d.html
```

或者通过 [.claude/launch.json](../.claude/launch.json) 的 `roof-3d` 配置直接启。

## 操作

- **拖拽旋转** / **滚轮缩放** / **右键平移**
- **右上 GUI 滑块**：调箱体尺寸 / 板滑出程度（deploy）/ 翻折程度（flip）/ 显隐开关
- **点击零件**：右下角显示零件编号、规格、长度、数量
- **左侧 BOM 表**：分类列出所有零件，点击行高亮 3D 里对应件
- **"角码节点" 开关**：默认关闭让画面清爽；开启看 59 个连接节点位置

## 为什么不直接用 Onshape？

| 工作 | cad/ (Three.js) | onshape/ (Onshape) |
|---|---|---|
| 改一个尺寸（railLength 1300→1400）| 拖滑块立刻看 | 改 Variable 等重建 |
| 跑全行程干涉自检 | `node scripts/check-interference.js` | 不支持 |
| 装配真实标准件 | 占位方块 | ✅ McMaster-Carr 拖入 |
| 计算真实重心 / 重量 | 估算 | ✅ 精确 |
| 出加工图 / CNC 数据 | ❌ | ✅ |

**结论**：cad/ 适合"试错 + 形态推敲"，onshape/ 适合"装配 + 出图"。

## 改 model.js 的规则

只在 `cad/model.js` 改零件：

```js
B(vis, code, name, profile, section, length, cat,
  xw, yd, zh,      // 包围盒尺寸 (mm)
  x, y, z,          // 最小角点 (mm)
  color, opacity);
```

`vis` = 控制显隐的 P 字段名（null 常显），`cat ∈ struct/tray/panel/tank/slide/conn/motor`。

改完按这三步：

1. **跑干涉自检**：`node scripts/check-interference.js` — 非法穿插 / 承接悬空必须 0
2. **跑两份生成器**：`node scripts/gen-bom.js && node scripts/gen-onshape-spec.js`
3. **刷新浏览器**：Cmd+R 看 3D（HTML 不会自动重载 model.js）

或者一次性 `git commit` → pre-commit 自动跑前两步。

## 坐标系

- **X = 左右**（车横向，主驾在 x 小那侧）
- **Y = 前后**（车长方向，车头 y=0）
- **Z = 上**（车顶 z=0，往上走）

Three.js 用 Y-up 坐标系，HTML 的 `addBeam()` 内部做了"设计 Z → Three.js Y"的映射，写 model.js 时按设计坐标系（Z up）来即可。

## 不在 cad/ 做的事

- **真实标准件**：去 onshape/
- **加工图 / CNC**：去 onshape/
- **重心 / 重量精算**：去 onshape/
- **手改 BOM**：[design/bom.md](../design/bom.md) 自动生成，**手改没用**，下次 commit 会被覆盖
- **手改 Onshape spec**：[onshape/spec.md](../onshape/spec.md) 同理
