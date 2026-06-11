# onshape/ — 主预览/装配平台

> Three.js 是快速试错沙盒，Onshape 才是**装配级真件 + 真实标准件 + 出加工图**的地方。

## 这里有什么

| 文件 | 来源 | 用途 |
|---|---|---|
| **[spec.md](spec.md)** | scripts/gen-onshape-spec.js | 人读建模指南：§1 参数 / §2 型材清单 / §3 Mate 表 / §4 采购单 / §5 建模顺序 |
| **[spec.json](spec.json)** | 同上 | 机读 spec：给 Phase 2 FeatureScript 直接消费 |
| (Phase 2 .fs 文件) | AI 生成 | Onshape Custom Feature 代码（一键生成所有型材）|

**两份 spec 都是 [cad/model.js](../cad/model.js) 自动派生**——改 model.js → pre-commit 自动重算。

## Onshape 自动化路径（分阶段）

### ✅ Phase 1：spec 自动生成（已完成）

```
cad/model.js (单一数据源)
    ↓ scripts/gen-onshape-spec.js (pre-commit 自动跑)
onshape/spec.md   ← 人读，照着搭 Part Studio
onshape/spec.json ← 机读，给 Phase 2 用
```

### ⏳ Phase 2：FeatureScript 一键生成骨架（下一步）

```
onshape/spec.json
    ↓ Onshape Custom Feature (Phase 2 .fs)
Part Studio: 28 个型材实例 自动生成
```

需要你先准备：
1. **Onshape 账号**：[onshape.com](https://www.onshape.com) — 免费版只能 Public 文档（已和我们 GitHub 仓库一致 PUBLIC）
2. **看 30 分钟 tutorial**：[FeatureScript Quick Start](https://learn.onshape.com/learn/article/featurescript-quick-start)
3. **跟 agent 说"准备好了"**：AI 写 ~300 行 .fs 文件 + 说明粘贴步骤

### ⏳ Phase 3：标准件库 + 装配（人主导）

- 从 [McMaster-Carr](https://www.mcmaster.com) / [MISUMI VONA](https://www.misumi-ec.com) 拖角码 + 螺丝 + T 螺母（按 [spec.md §4](spec.md) 数量）
- 在 Assembly 里按 [spec.md §3](spec.md) Mate 表逐节点加约束
- 跑 Onshape Interference Check（应该 0 处，model.js 已经验过）

### ⏳ Phase 4：REST API 自动化（高级）

- AI 调 Onshape REST API：① 改参数批量更新；② 跑干涉报告；③ 生成 BOM 给 design/
- 复用 model.js 的参数（boxHeight 改了 Onshape 自动重建）

## 跟 cad/ 的关系

| | **cad/ (Three.js)** | **onshape/ (Onshape)** |
|---|---|---|
| 角色 | 快速试错沙盒 | 主预览 / 装配 / 出图 |
| 几何 | 方块占位（型材 = BoxGeometry）| 真实 T 槽截面 + 真实标准件 |
| 参数化 | ✅ 滑块联动 | ✅ Variables 联动 |
| 装配约束 | ❌ 手坐标 | ✅ Mate 系统 |
| 输出工程图 / CNC | ❌ | ✅ |
| 适合的工作 | 改尺寸快速看冲突 / 干涉自检 | 加真实角码 / 算重心 / 出图 |

**工作流**：先在 cad/ 改 model.js 跑干涉 → 满意了 → 在 onshape/ 同步刷新（Phase 2 后一键自动）→ Onshape 里做装配/出图。

## 当前 spec 快照

打开 [spec.md](spec.md)，§总览 会显示当前数字。每次 pre-commit 自动同步到最新 commit。
