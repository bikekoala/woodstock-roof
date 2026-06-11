# design/ — 设计文档

> 设计的"为什么 + 是什么"。所有 md 都是给人读的；零件几何由 [cad/model.js](../cad/model.js) 维护。

## 导航

| 文档 | 读的人 | 用途 |
|---|---|---|
| [spec.md](spec.md) | 想理解整体设计的人 | 尺寸链、层高账、材料分配、太阳能汇总 |
| [decisions.md](decisions.md) | 想知道"为什么"的人 | 决策记录 D1–D24，每条带理由和数字 |
| [joints.md](joints.md) | 装配工 / 转 CAD 的人 | 59 个连接节点登记表（位置 + 角码型号 + 螺丝规格）|
| [bom.md](bom.md) | 下单材料的人 | 物料清单（**自动生成，勿手改**）|

## 读的顺序

1. **新接手** → [spec.md](spec.md) 看整体框架 → [decisions.md](decisions.md) 看为什么 →（写到这就够了，要细节再 [joints.md](joints.md) / [bom.md](bom.md)）
2. **要改尺寸** → 先看 [decisions.md](decisions.md) 是否有相关决策，避免重走弯路 → 改 [cad/model.js](../cad/model.js) → 跑 pre-commit
3. **要装配** → [joints.md](joints.md) 节点表 + [../onshape/spec.md](../onshape/spec.md) §3 Mate 表

## 文件来源约束

| 文件 | 来源 | 改它 |
|---|---|---|
| spec.md | 人写 | 直接改（同步 model.js 改动时一起改）|
| decisions.md | 人写 | 每个决策一节，按 D 编号追加，**永不删除已落地决策**（只标 ★ 推翻）|
| joints.md | 人写（节点 spec 表）| 改节点表 → 同步改 model.js buildJoints()|
| **bom.md** | **scripts/gen-bom.js 生成** | **不要手改**，改 model.js 后 pre-commit 自动重算 |

## 跟 onshape/ 的关系

- **design/spec.md** 是设计意图 / decisions.md 是决策史 / joints.md 是节点登记 — 都是**人脑可读**的设计材料
- **onshape/spec.md** 是从 model.js 一次性生成的**建模指南**（每个零件原点、Mate 关系、采购单）— 给装配/CAD 工人照搭
- 两者不重复：design/ 解释"为什么"，onshape/ 解释"怎么搭"
