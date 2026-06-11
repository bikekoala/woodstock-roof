# woodstock-roof

> 荣威 eRX5 PHEV 车顶多层伸缩太阳能平台 · DIY 参数化设计

[![commits](https://img.shields.io/github/last-commit/bikekoala/woodstock-roof)](https://github.com/bikekoala/woodstock-roof/commits/main)
[![status](https://img.shields.io/badge/status-D24%20%E6%94%B6%E6%95%9B-green)]()

---

## 一句话

给自家白色荣威 eRX5 装一套**铝型材车顶平台**：3 张柔性太阳能板（~820W）+ 扁平水箱 + 主驾侧 2㎡ 侧边帐 + ESP32 电控伸缩，零钻零焊，所有连接 T 槽 + 内六角扳手。

## 现在长什么样

| 维度 | 数字 |
|---|---|
| 箱体外尺寸 | 1020 × 1300 × 251 mm |
| 行驶高度 | ~249 mm（板折叠态）|
| 展开总宽 | 3020 mm（主驾侧 2m 侧边帐） |
| 总功率 | ~820 W（板 A 主+延 480 + 板 C 240 + 顶板 100） |
| 总重 | ~25 kg（型材 + 板 + 水箱空 + 连接件） |
| 型材 | 4040: 7.6m / 2020: 11.69m |
| 零件 | 28 型材实例 + 59 连接节点 + 4 张板 + 1 水箱 |

## 仓库结构

```
.
├── README.md              ← 你在这
├── CLAUDE.md              ← AI agent 上手指南
│
├── design/                ← 设计文档（人读为主）
│   ├── README.md          ← 文档导航
│   ├── spec.md            ← 设计规格（尺寸链/层高/材料分配）
│   ├── decisions.md       ← 决策记录 D1–D24（为什么是现在这样）
│   ├── joints.md          ← 59 个连接节点登记表
│   └── bom.md             ← 物料清单（自动生成）
│
├── onshape/               ← ★ 主预览/装配平台
│   ├── README.md          ← Onshape 使用指南
│   ├── spec.md            ← 建模工程描述（人读，自动生成）
│   └── spec.json          ← 机读 spec（给 FeatureScript 吃）
│
├── cad/                   ← Three.js 快速试错沙盒（次要）
│   ├── README.md          ← 定位说明
│   ├── model.js           ← ★ 单一数据源（几何 + BOM 元数据）
│   └── roof-rack-3d.html  ← 浏览器交互预览
│
├── scripts/               ← 自动化工具
│   ├── check-interference.js  ← 实体干涉自检（pre-commit 阻断）
│   ├── gen-bom.js             ← 重算 design/bom.md
│   └── gen-onshape-spec.js    ← 重算 onshape/spec.md + spec.json
│
└── reference/             ← 早期废弃方案（仅历史参考）
```

## 我从哪开始读

| 你是 | 看这个 |
|---|---|
| **AI agent 接手项目** | [CLAUDE.md](CLAUDE.md) |
| **想理解整体设计** | [design/spec.md](design/spec.md) |
| **想知道为什么这样设计** | [design/decisions.md](design/decisions.md) |
| **要在 Onshape 里建模** | [onshape/README.md](onshape/README.md) → [onshape/spec.md](onshape/spec.md) |
| **要下单材料** | [design/shopping-list.md](design/shopping-list.md) ⭐ — 一站式淘宝清单 + 总预算 |
| **要装配连接节点** | [design/joints.md](design/joints.md) |
| **想快速看 3D 形态** | [cad/roof-rack-3d.html](cad/roof-rack-3d.html)（浏览器打开） |

## 两个核心特性

### ① 单侧二次展开 = 2㎡ 侧边帐 ★

主驾侧太阳能板 A 设计成"主板 + 延展板"双层折叠：

```
行驶：两板叠在中层
  ↓ 沿 x 滑出 1m（DC 电机 + 同步带）
第一次展开：折叠态在主驾外
  ↓ 延展板翻 180°（电动推杆）
完全展开：2m × 1.12m 阴影 = 桌椅 + 烧烤 + 遮雨
```

### ② 后半顶部完全开放置物

中层只在前半（水箱区上方）放板 A 折叠态；后半 1300mm 长完全空，从顶部往里塞行李/装备。

## 自动化保障

- **干涉自检** [scripts/check-interference.js](scripts/check-interference.js)：每次 commit 跑全行程扫描（板 A 滑出 + 翻折），非法穿插阻断提交
- **BOM 同步** [scripts/gen-bom.js](scripts/gen-bom.js)：改 model.js → BOM 自动重算
- **Onshape spec 同步** [scripts/gen-onshape-spec.js](scripts/gen-onshape-spec.js)：改 model.js → Onshape 建模指南 + 机读 spec 自动重算

三件都挂 pre-commit。**单一数据源 = `cad/model.js`**，其余全部派生。

## 进度

- ✅ 形态收敛 D1–D24（cad/model.js 装配蓝图完整）
- ✅ 板选型 + 二次展开机构 + 电动接口预留
- ✅ Onshape 自动化 Phase 1（spec 自动生成）
- ⏳ **Onshape 自动化 Phase 2**（FeatureScript 一键生成骨架）
- ⏳ zBot 实测 / 水箱定型 / 电机选型采购
- ⏳ 实物装配 + ESP32 电控集成

## 跟我有什么关系

这是个人 DIY 项目，所有设计/代码 MIT 友好风格，但请理解：

- **车型针对性**：尺寸是按荣威 eRX5（白色 PHEV）实测的，别的车 OEM 导轨跨距不同
- **零编程门槛要求**：能看 [cad/roof-rack-3d.html](cad/roof-rack-3d.html) 在浏览器里转就行
- **欢迎 Issue**：尺寸/结构/选型建议都欢迎，AI agent + 车主一起回

## 协作

AI agent 工作流见 [CLAUDE.md](CLAUDE.md)。要参与设计讨论：
- GitHub Issue 提问/吐槽
- Fork 后改 model.js + 跑 `node scripts/check-interference.js` 验证

---

**项目状态：D24 收敛点（2026-06-11），准备转 Onshape 装配。**
