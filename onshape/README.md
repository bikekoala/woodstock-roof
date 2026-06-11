# onshape/ — 主预览/装配平台

> Three.js 是快速试错沙盒，Onshape 才是**装配级真件 + 真实标准件 + 出加工图**的地方。

## ⚠️ API 凭证管理（重要）

**API 密钥绝不入仓库**（仓库 PUBLIC，git history 全网可见）。统一存储位置：

```
~/.config/onshape/credentials.json   ← chmod 600，HOME 目录外
```

凭证文件格式（**这个示例不含真密钥**）：

```json
{
  "base_url":   "https://cad.onshape.com",
  "access_key": "on_xxxxxxxxxx",
  "secret_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**生成新密钥**：[Developer Portal → API Keys → Create new key](https://dev-portal.onshape.com/keys) → 选 OAuth scope `OAuth2Read` + `OAuth2Write` → 立即下载（**Secret 只显示一次**） → 保存到上面路径 + `chmod 600`。

**验证连接**：

```bash
node scripts/onshape-api-hello.js
```

应该看到 `✅ 认证成功 / 套餐 Free / 角色 DEVELOPER, USER`。

**密钥泄露应急**：
- 立刻去 [Developer Portal](https://dev-portal.onshape.com/keys) **Revoke** 旧密钥
- 创建新密钥替换 `~/.config/onshape/credentials.json`
- 已泄露密钥别管它（已 revoke 即失效）

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

### ✅ Phase 2：FeatureScript 一键生成 36 件零件

文件：[woodstock-frame.fs](woodstock-frame.fs)（自动生成）

```
cad/model.js
    ↓ scripts/gen-onshape-spec.js (pre-commit 自动)
onshape/woodstock-frame.fs   ← 装配蓝图 + 生成器，一份代码
    ↓ 你复制粘贴到 Onshape Custom Feature
Part Studio: 36 个实体（28 型材 + 3 滑轨/合页 + 4 板 + 1 水箱）一次性生成
```

**用法（30 秒）**：

1. Onshape **登录** → New Document → 命名 `woodstock-roof`
2. 左下角 + → **Create Feature Studio** → 命名 `frame-generator`
3. 全选 → 删除模板代码
4. **粘贴 [woodstock-frame.fs](woodstock-frame.fs) 全部内容**
5. 右上 **Commit**（按钮蓝色）
6. 顶栏 ← 回到 Part Studio
7. 工具栏右侧最末有个新图标（"Woodstock Frame"）→ 点开
8. 勾选"生成全部 36 件零件" → ✓ → **所有 36 个 Part 一次性出现**

改了 [cad/model.js](../cad/model.js)？pre-commit 会自动重生成 .fs；你只需重新粘贴到 Onshape Feature Studio 即可（5 秒）。

**如果有语法错 / 几何不对**：贴 Onshape 错误日志给我，我迭代 .fs 模板。Onshape 浏览器报错信息直接显示行号 + 原因。

### ⏳ Phase 3：标准件库 + 装配（部分自动化）

**3.A 采购清单**：[../design/shopping-list.md](../design/shopping-list.md)（已出，含淘宝关键词 + 估价 ~2850 元）

**3.B 自动 Insert Part Studio 到 Assembly**：
```bash
node scripts/onshape-assemble.js <documentId>
```
脚本：[scripts/onshape-assemble.js](../scripts/onshape-assemble.js) — 把 Part Studio 里的 36 个 Part 全部 Insert 到 Assembly 1，每个一个 instance。

**3.C 手动加 Group / Mate / 标准件**（Onshape UI 里做）：
- Cmd+A 全选 → 右键 → "Group" → 按当前位置锁定
- 从 [McMaster-Carr](https://www.mcmaster.com) / [MISUMI VONA](https://www.misumi-ec.com) 拖角码 + 螺丝 + T 螺母（按 [spec.md §4](spec.md) 数量）
- 按 [spec.md §3](spec.md) Mate 表逐节点加约束（出工程图必做，仅看不必）
- 跑 Onshape Interference Check（应该 0 处，model.js 已经验过）

### ✅ Phase 4 入门：API 一键上传 FS（已实现）

不用手工 8 步了，直接跑：

```bash
# 创建新文档 + Feature Studio + 上传 FS（首次）
node scripts/onshape-upload.js

# 改了 model.js 后更新现有文档（复用 documentId）
node scripts/onshape-upload.js <documentId>
```

脚本：[scripts/onshape-upload.js](../scripts/onshape-upload.js)
工作流：
1. 调 `POST /api/documents` 创建 Public 文档
2. 调 `POST /api/featurestudios/d/{did}/w/{wid}` 建 frame-generator
3. 调 `POST /api/featurestudios/.../{eid}` 上传 woodstock-frame.fs

3 次 API 调用，输出一个 Onshape URL 给你直接打开。

### ⏳ Phase 4 高级（继续）

- 调 REST API 跑参数批量更新（model.js 改了 → 自动同步到 Onshape）
- 跑 Onshape Interference Check 拉报告（与 model.js 自检交叉验证）
- 拉 Onshape BOM / 重量 / 重心写回 design/

凭证管理见上面"API 凭证管理"段。
基础脚本：[scripts/onshape-api-hello.js](../scripts/onshape-api-hello.js)

## API 限额账（免费版 2500 请求/月）

| 操作 | 大约调用次数 |
|---|---|
| hello world（sessioninfo + 文档列表） | 2 |
| 一次完整 Phase 4 模型生成（28 零件 + 装配 + 干涉 + BOM） | ~50 |
| 仅改一个参数批量更新 | ~5 |
| **2500/月够干** | ~50 次完整生成 / 月，或 ~500 次参数调整 |

**Phase 2 FeatureScript 不调 REST API**（FS 在 Onshape 内部跑，不走配额）。配额压力主要在 Phase 4。

撞限怎么办：
- 升级 Standard 套餐 ($1500/年，配额 +一大截 + 私有文档)
- 借第二个免费账号（私人 DIY 项目临时方案）
- Throttle：脚本里加 `await sleep(500)` 之间，减少瞬时峰值

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
