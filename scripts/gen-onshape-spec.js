#!/usr/bin/env node
// scripts/gen-onshape-spec.js
// 从 cad/model.js 自动生成 Onshape 建模指南（人读 Markdown + 机读 JSON）
//
// 输出：
//   onshape/spec.md   — 人读：建模顺序 / Mate 表 / 采购清单
//   onshape/spec.json — 机读：给 Phase 2 FeatureScript 生成器吃
//
// 用法：node scripts/gen-onshape-spec.js
//
// 设计意图：把当前 Three.js 装配蓝图直接搬到 Onshape，零件 + 节点 + 标准件
// 都自动列好，你打开 Onshape 照着建即可。改 model.js 重跑此脚本会同步更新。

const path = require('path');
const fs = require('fs');
const M = require(path.join(__dirname, '..', 'cad', 'model.js'));

// ============================================================
// 1. 收集数据
// ============================================================

const parts = M.buildModel({});
const joints = M.buildJoints(M.DEFAULTS);
const bom = M.computeBOM(parts);

// 按 code 聚合所有"型材/板/水箱/滑轨/合页"实例
function aggregateByCode(filterFn) {
  const map = {};
  parts.filter(filterFn).forEach(p => {
    if (!map[p.code]) {
      map[p.code] = { code: p.code, name: p.name, profile: p.profile, section: p.section,
                     length: p.length, cat: p.cat, instances: [] };
    }
    map[p.code].instances.push({
      origin: [p.x, p.y, p.z],
      size:   [p.xw, p.yd, p.zh],
    });
  });
  return Object.values(map);
}

const extrusions = aggregateByCode(p => p.cat === 'struct' || p.cat === 'tray');
const slideHinge = aggregateByCode(p => p.cat === 'slide');
const panels     = aggregateByCode(p => p.cat === 'panel');
const tank       = aggregateByCode(p => p.cat === 'tank');

// 节点：保留 spec / loc / pos / qty 用于 Mate 表
const jointList = joints.map(j => ({
  id: j.id,
  loc: j.loc,
  spec: j.spec,
  specName: M.JOINT_SPECS[j.spec] ? M.JOINT_SPECS[j.spec].name : '?',
  cat: (M.JOINT_SPECS[j.spec] && M.JOINT_SPECS[j.spec].cat) || 'conn',
  pos: j.pos,
  qty: j.qty,
  screws: (M.JOINT_SPECS[j.spec] && M.JOINT_SPECS[j.spec].screws) || {},
}));

// ============================================================
// 2. 采购清单（型材按长度+截面分组、角码/紧固件/板按 code 分组）
// ============================================================

const profileBuy = {};        // "4040 1300mm" -> qty
extrusions.forEach(e => {
  if (typeof e.length === 'number') {
    const key = `${e.profile} L=${e.length}mm`;
    profileBuy[key] = (profileBuy[key] || 0) + e.instances.length;
  }
});

const jointBuy = {};          // "A2" -> qty
parts.filter(p => p.cat === 'conn').forEach(p => {
  jointBuy[p.code] = (jointBuy[p.code] || 0) + 1;
});

const motorBuy = {};
parts.filter(p => p.cat === 'motor').forEach(p => {
  motorBuy[p.code] = (motorBuy[p.code] || 0) + 1;
});

// ============================================================
// 3. 输出 JSON（给 Phase 2 FeatureScript 生成器吃）
// ============================================================

const spec = {
  version:    '1.0',
  source:     'cad/model.js',
  scriptVersion: require('child_process').execSync('git rev-parse --short HEAD').toString().trim(),
  params:     M.DEFAULTS,
  constants:  M.CONST,
  // 几何
  extrusions, slideHinge, panels, tank: tank[0] || null,
  // 装配
  joints: jointList,
  // 采购
  shoppingList: {
    profiles:  profileBuy,
    joints:    jointBuy,
    fasteners: bom.fasteners,
    panels:    panels.map(p => ({ code: p.code, name: p.name, section: p.section, qty: p.instances.length })),
    motor:     motorBuy,
  },
  totals: {
    parts:        parts.length,
    extrusions:   extrusions.reduce((s, e) => s + e.instances.length, 0),
    joints:       jointList.length,
    profileLen_mm: extrusions.reduce((s, e) => s + (typeof e.length === 'number' ? e.length * e.instances.length : 0), 0),
  },
};

fs.writeFileSync(path.join(__dirname, '..', 'onshape', 'spec.json'), JSON.stringify(spec, null, 2));

// ============================================================
// 4. 输出 Markdown（人读，照着搭 Onshape）
// ============================================================

function md_paramsTable(p) {
  return Object.entries(p).map(([k, v]) => `| \`${k}\` | ${v} | mm |`).join('\n');
}

function md_extrusionsTable(arr) {
  return arr.map(e => {
    const inst = e.instances.map((i, k) =>
      `    ${e.code}-${k + 1}: origin=(${i.origin.join(', ')}), size=(${i.size.join(' × ')})`
    ).join('\n');
    return `\n### ${e.code} — ${e.name}\n` +
           `- 截面：**${e.profile}** (${e.section})\n` +
           `- 长度：${e.length}mm\n` +
           `- 数量：${e.instances.length}\n` +
           `- 实例（原点 + 包围盒尺寸 mm）：\n\`\`\`\n${inst}\n\`\`\``;
  }).join('\n');
}

function md_jointsTable(arr) {
  // 按 spec 分组
  const bySpec = {};
  arr.forEach(j => { (bySpec[j.spec] = bySpec[j.spec] || []).push(j); });
  return Object.entries(bySpec).map(([spec, js]) => {
    const rows = js.map(j =>
      `| ${j.id} | ${j.loc} | ${j.pos.join(', ')} | ${j.qty} | ${Object.entries(j.screws).map(([k, v]) => `${k}×${v}`).join(' + ') || '—'} |`
    ).join('\n');
    return `\n### ${spec} — ${js[0].specName} （${js.length} 个节点）\n\n` +
           `| Node ID | 位置描述 | 坐标 (x, y, z) | 数量 | 紧固件 |\n` +
           `|---|---|---|---|---|\n${rows}`;
  }).join('\n');
}

function md_shopping(s) {
  let out = '\n### 4.1 型材定长切割单（淘宝下单或本地切割）\n\n';
  out += `| 规格 | 数量 |\n|---|---|\n` +
         Object.entries(s.profiles).map(([k, v]) => `| ${k} | ${v} 根 |`).join('\n');
  out += '\n\n### 4.2 角码 / 卡扣 / 滑轨\n\n';
  out += `| 编号 | 数量 | 规格说明 |\n|---|---|---|\n` +
         Object.entries(s.joints).map(([code, qty]) =>
           `| ${code} | ${qty} 块 | ${M.JOINT_SPECS[code] ? M.JOINT_SPECS[code].mat : '—'} |`).join('\n');
  out += '\n\n### 4.3 紧固件\n\n';
  out += `| 编号 | 数量 | 规格 |\n|---|---|---|\n` +
         Object.entries(s.fasteners).map(([code, qty]) =>
           `| ${code} | ${qty} 套 | ${M.FASTENERS[code] ? M.FASTENERS[code].name : '—'} |`).join('\n');
  out += '\n\n### 4.4 太阳能板\n\n';
  out += `| 编号 | 数量 | 规格 |\n|---|---|---|\n` +
         s.panels.map(p => `| ${p.code} | ${p.qty} 张 | ${p.section} |`).join('\n');
  out += '\n\n> ⚠️ **延展板 PA2 电池片反向定制**：跟柔性板厂家说明"电池片装在背板的另一面"。\n';
  out += '\n### 4.5 电动接口（D22 占位，型号待选）\n\n';
  out += `| 编号 | 数量 | 规格说明 |\n|---|---|---|\n` +
         Object.entries(s.motor).map(([code, qty]) =>
           `| ${code} | ${qty} 件 | ${M.JOINT_SPECS[code] ? M.JOINT_SPECS[code].mat : '—'} |`).join('\n');
  return out;
}

const dt = new Date().toISOString().slice(0, 10);
const md = `# Onshape 建模工程描述

> ⚙️ **本文件由 \`scripts/gen-onshape-spec.js\` 从 \`cad/model.js\` 自动生成，请勿手改。**
> 改设计 → 改 model.js → \`node scripts/gen-onshape-spec.js\` 重生成此文档。
> 同时输出 \`onshape/spec.json\` 供 Phase 2 FeatureScript 生成器使用。
>
> 配套来源：commit \`${spec.scriptVersion}\` · 生成日期 ${dt}

## 总览

| 维度 | 值 |
|---|---|
| 零件总数（含 marker） | ${spec.totals.parts} |
| 型材实例 | ${spec.totals.extrusions} |
| 连接节点 | ${spec.totals.joints} |
| 型材总长 | ${(spec.totals.profileLen_mm / 1000).toFixed(2)} m |
| 箱体外尺寸 | ${spec.params.railSpacing} × ${spec.params.railLength} × ${75 + spec.params.boxHeight + 40 + 6}mm（W × L × H 含 PT 顶板）|

---

## 1. 主控参数（在 Onshape Part Studio 创建 Variables）

| 变量名 | 默认值 | 单位 |
|---|---|---|
${md_paramsTable(spec.params)}

**常量**（不在 Variables 里，直接在 Sketch 用数字）：

| 名称 | 值 | 含义 |
|---|---|---|
| \`P40\` | 40 | 4040 截面 |
| \`P20\` | 20 | 2020 截面 |
| \`panelW\` | 1000 | 板 x 方向宽 |
| \`panelL\` | 1120 | 板 y 方向长 |
| \`zBot\` | 35 | OEM 导轨抬高（待实测）|

---

## 2. 型材清单（按建模顺序）

> 每个零件用 Onshape 的 **Sketch + Extrude** 建：先在 X-Y 平面画 40×40 或 20×20 方框，再 Extrude 到目标长度。
> 然后用 **Linear Pattern** 或 **Mirror** 复制其他实例。
> 装配在 Assembly 里用 Mate（详见 §3）。

### 2.1 箱体骨架（结构件 struct）
${md_extrusionsTable(extrusions.filter(e => e.cat === 'struct'))}

### 2.2 吊装托盘（tray）
${md_extrusionsTable(extrusions.filter(e => e.cat === 'tray'))}

### 2.3 滑轨 / 合页（slide）
${md_extrusionsTable(slideHinge)}

### 2.4 太阳能板（panel）
${panels.map(p => `\n#### ${p.code} — ${p.name}\n- 规格：${p.section}\n- 数量：${p.instances.length}\n- 厚度：${p.instances[0].size[2]}mm\n- 默认位置（原点）：(${p.instances[0].origin.join(', ')})`).join('\n')}

### 2.5 水箱
${tank[0] ? `- ${tank[0].code} — ${tank[0].name}\n- 截面：${tank[0].section}\n- 位置：(${tank[0].instances[0].origin.join(', ')})` : '无'}

---

## 3. 装配 Mate 表

> 每个节点 = 在 Onshape Assembly 里加一个 Mate（Fastened / Slider / Cylindrical 等）。
> 节点的 \`spec\` 决定用哪种角码 / 卡扣（详见 §4.2 采购清单）。
> \`pos\` 是节点中心坐标（mm），用作 Onshape Mate Connector 的定位参考。

${md_jointsTable(jointList)}

---

## 4. 采购清单（一站式下单）

${md_shopping(spec.shoppingList)}

---

## 5. Onshape 建模建议顺序

1. **新建 Document** \`woodstock-roof\`
2. **新建 Part Studio "Frame-Skeleton"**
   - 创建 §1 的所有 Variables
   - 按 §2.1 顺序建 M1/M2/C1/T1/T2/S1/S2/S3（先 Sketch 截面 → Extrude → Pattern）
   - 用 Linear Pattern 复制对称实例
3. **新建 Part Studio "Tray"**
   - 按 §2.2 建 D1-D4
4. **新建 Part Studio "Slide-Hinge"**
   - 按 §2.3 建 R1/K2
5. **新建 Part Studio "Panels"**
   - 按 §2.4 建 PA1/PA2/PC/PT（用 Surface 或薄 Solid）
6. **新建 Assembly "Roof-Rack"**
   - Insert 上面所有 Part Studio 的零件
   - 按 §3 Mate 表逐节点加 Mate
7. **标准件**：从 MISUMI / McMaster-Carr 拖角码 + 螺丝 + T 螺母（按 §4 数量）
8. **干涉检查**：Assembly → Interference Check → 应该 0 处（我们已经在 model.js 里跑过）

---

## 6. 下一步（Phase 2）

我会写一段 **Onshape FeatureScript** 代码（基于 \`onshape/spec.json\`）：
- 输入：本 JSON
- 输出：自动生成所有 §2 型材的 Part Studio
- 你只需在 Onshape Custom Feature 里粘贴 FS 代码 + 选 JSON → 一键生成骨架

需要你先准备：
- ✅ Onshape 免费 Public 账号（[onshape.com/cad-software](https://www.onshape.com/cad-software)）
- ✅ 看 1 个 30 分钟官方 Custom Feature tutorial
- ✅ 跟我说"准备好了"，我开始写 FeatureScript
`;

fs.writeFileSync(path.join(__dirname, '..', 'onshape', 'spec.md'), md);

// ============================================================
// 5. 输出 FeatureScript（Phase 2，给 Onshape Custom Feature 用）
// ============================================================

function fsArr(arr) { return '[' + arr.join(', ') + ']'; }

// 收集所有需要在 Onshape 里生成实体的 box 实例
// 角码/电动 marker 不进 FS（属于"小件"，Onshape 用 McMaster-Carr 标准件库拖入更好）
// 加 profile 字段：4040/2020 走真 T 槽截面，0 走简化 box
const PROFILE_BY_CODE = {
  M1: 4040, M2: 4040, C1: 4040, T1: 4040,                         // 4040 主承力件
  T2: 2020, S1: 2020, S2: 2020, S3: 2020, D1: 2020, D2: 2020, D3: 2020, D4: 2020,  // 2020 全部
};
const fsItems = [];
extrusions.forEach(e => {
  e.instances.forEach((inst, k) => fsItems.push({
    code: e.code,
    name: `${e.code}-${k + 1} ${e.name}`,
    cat: e.cat,
    profile: PROFILE_BY_CODE[e.code] || 0,
    o: inst.origin, s: inst.size,
  }));
});
slideHinge.forEach(e => {
  e.instances.forEach((inst, k) => fsItems.push({
    code: e.code, name: `${e.code}-${k + 1} ${e.name}`, cat: e.cat,
    profile: 0, o: inst.origin, s: inst.size,
  }));
});
panels.forEach(e => {
  e.instances.forEach((inst, k) => fsItems.push({
    code: e.code, name: `${e.code} ${e.name}`, cat: e.cat,
    profile: 0, o: inst.origin, s: inst.size,
  }));
});
if (tank[0]) {
  tank[0].instances.forEach((inst, k) => fsItems.push({
    code: tank[0].code, name: `${tank[0].code} ${tank[0].name}`, cat: tank[0].cat,
    profile: 0, o: inst.origin, s: inst.size,
  }));
}

const partsLiteral = fsItems.map(p =>
  `    { "code" : "${p.code}", "cat" : "${p.cat}", "name" : "${p.name.replace(/"/g, '\\"')}", "profile" : ${p.profile}, "o" : ${fsArr(p.o)}, "s" : ${fsArr(p.s)} }`
).join(',\n');

const fsCode = `FeatureScript 2625;
import(path : "onshape/std/geometry.fs", version : "2625.0");

// ============================================================
// woodstock-roof Frame Generator (Onshape Custom Feature)
// 自动从 cad/model.js 生成（commit ${spec.scriptVersion} · ${dt}）
// ⚠️ 不要手改本文件 — 改 cad/model.js → commit → 自动重生成
//
// 用法（30 秒）：
//   1. Onshape Part Studio → 新建 Custom Feature（左上角 Feature Studio 图标）
//   2. 粘贴本文件全部内容
//   3. 右上 "Commit"
//   4. 回 Part Studio，工具栏点 "Woodstock Frame" 图标 → "Generate" → ✓
//   5. ${fsItems.length} 个 Part 一次性出现（型材 + 板 + 水箱 + 滑轨/合页）
//
// 装配阶段：标准件（角码 + 螺丝 + T 螺母）从 McMaster-Carr 或 MISUMI VONA 拖入，
// 按 onshape/spec.md §3 Mate 表逐节点加约束。
// ============================================================

// 全部 ${fsItems.length} 个实体实例（坐标 mm；o=最小角点，s=包围盒尺寸）
export const PARTS = [
${partsLiteral}
];

annotation { "Feature Type Name" : "Woodstock Frame" }
export const woodstockFrame = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Generate all ${fsItems.length} parts" }
        definition.confirmGenerate is boolean;
    }
    {
        if (!definition.confirmGenerate)
            return;
        for (var i = 0; i < size(PARTS); i += 1)
        {
            var p = PARTS[i];
            if (p.profile == 4040 || p.profile == 2020)
                createAluBeam(context, id + ("p" ~ i), p);    // 真 T 槽截面（4040/2020 工业铝型材）
            else
                createBoxPart(context, id + ("p" ~ i), p);    // 简化 box（板/水箱/滑轨/合页）
        }
    });

// ============================================================
// 真 T 槽铝型材生成器（MISUMI HFS5 系列参考尺寸）
// 4040：边长 40，T 槽外口 7mm，槽深 6mm，4 面各一道纵向 T 槽
// 2020：边长 20，T 槽外口 5mm，槽深 4mm
// 简化：用矩形凹槽近似真 T 槽内腔（视觉接近，能看到"螺丝孔"）
// ============================================================
function tslotPolyline(anchorX is number, anchorY is number, S is number, W is number, D is number) returns array
{
    // 截面 polyline 顶点（沿外形 + 4 道矩形凹槽逆时针走一圈，单位 mm）
    return [
        // 底边 + 底面凹槽
        [anchorX,             anchorY],
        [anchorX + S/2 - W/2, anchorY],
        [anchorX + S/2 - W/2, anchorY + D],
        [anchorX + S/2 + W/2, anchorY + D],
        [anchorX + S/2 + W/2, anchorY],
        [anchorX + S,         anchorY],
        // 右边 + 右面凹槽
        [anchorX + S,         anchorY + S/2 - W/2],
        [anchorX + S - D,     anchorY + S/2 - W/2],
        [anchorX + S - D,     anchorY + S/2 + W/2],
        [anchorX + S,         anchorY + S/2 + W/2],
        [anchorX + S,         anchorY + S],
        // 顶边 + 顶面凹槽
        [anchorX + S/2 + W/2, anchorY + S],
        [anchorX + S/2 + W/2, anchorY + S - D],
        [anchorX + S/2 - W/2, anchorY + S - D],
        [anchorX + S/2 - W/2, anchorY + S],
        [anchorX,             anchorY + S],
        // 左边 + 左面凹槽
        [anchorX,             anchorY + S/2 + W/2],
        [anchorX + D,         anchorY + S/2 + W/2],
        [anchorX + D,         anchorY + S/2 - W/2],
        [anchorX,             anchorY + S/2 - W/2]
    ];
}

function createAluBeam(context is Context, id is Id, part is map)
{
    var o = part.o;
    var s = part.s;
    var prof = part.profile;
    // T 槽参数
    var S = prof == 4040 ? 40 : 20;
    var W = prof == 4040 ? 7  : 5;   // 槽外口宽
    var D = prof == 4040 ? 6  : 4;   // 槽深

    // 找型材长度方向：size 数组里最大的那一维
    var lengthAxis = 0;
    if (s[1] > s[lengthAxis]) lengthAxis = 1;
    if (s[2] > s[lengthAxis]) lengthAxis = 2;
    var depth = s[lengthAxis];

    // 根据长度方向选择 sketch 平面（截面在垂直于长度方向的平面）
    // 用 PolylinePoints 画截面 polyline
    var pts;
    var sketchPlane;
    var direction;
    if (lengthAxis == 2) {
        // 长度沿 z；截面在 xy 平面 z=o[2]
        sketchPlane = plane(vector(0, 0, o[2]) * millimeter, vector(0, 0, 1));
        pts = tslotPolyline(o[0], o[1], S, W, D);
        direction = vector(0, 0, 1);
    } else if (lengthAxis == 1) {
        // 长度沿 y；截面在 xz 平面 y=o[1]，截面坐标 (x, z)
        sketchPlane = plane(vector(0, o[1], 0) * millimeter, vector(0, 1, 0));
        pts = tslotPolyline(o[0], o[2], S, W, D);
        direction = vector(0, 1, 0);
    } else {
        // 长度沿 x；截面在 yz 平面 x=o[0]，截面坐标 (y, z)
        sketchPlane = plane(vector(o[0], 0, 0) * millimeter, vector(1, 0, 0));
        pts = tslotPolyline(o[1], o[2], S, W, D);
        direction = vector(1, 0, 0);
    }

    var sk = newSketchOnPlane(context, id + "section", { "sketchPlane" : sketchPlane });
    // 逐段画线（skLineSegment 比 skPolyline 兼容性更稳）
    for (var i = 0; i < size(pts); i += 1)
    {
        var p1 = pts[i];
        var p2 = pts[(i + 1) % size(pts)];
        skLineSegment(sk, "L" ~ i, {
            "start" : vector(p1[0], p1[1]) * millimeter,
            "end"   : vector(p2[0], p2[1]) * millimeter
        });
    }
    skSolve(sk);

    opExtrude(context, id + "extrude", {
        "entities"  : qSketchRegion(id + "section"),
        "direction" : direction,
        "endBound"  : BoundingType.BLIND,
        "endDepth"  : depth * millimeter
    });

    setProperty(context, {
        "entities"     : qCreatedBy(id + "extrude", EntityType.BODY),
        "propertyType" : PropertyType.NAME,
        "value"        : part.name
    });
}

// 在绝对坐标系生成一个轴对齐 box 实体
function createBoxPart(context is Context, id is Id, part is map)
{
    var o = part.o;   // [ox, oy, oz] mm
    var s = part.s;   // [sx, sy, sz] mm

    // 在 z = o[2] 的水平面（XY 平面平移）创建 sketch
    var sketchPlane = plane(
        vector(0, 0, o[2]) * millimeter,
        vector(0, 0, 1)
    );

    var sk = newSketchOnPlane(context, id + "sketch", { "sketchPlane" : sketchPlane });
    skRectangle(sk, "rect", {
        "firstCorner"  : vector(o[0],          o[1])          * millimeter,
        "secondCorner" : vector(o[0] + s[0],   o[1] + s[1])   * millimeter
    });
    skSolve(sk);

    opExtrude(context, id + "extrude", {
        "entities"  : qSketchRegion(id + "sketch"),
        "direction" : vector(0, 0, 1),
        "endBound"  : BoundingType.BLIND,
        "endDepth"  : s[2] * millimeter
    });

    // 命名生成的实体（在 Parts 列表中显示）
    setProperty(context, {
        "entities"     : qCreatedBy(id + "extrude", EntityType.BODY),
        "propertyType" : PropertyType.NAME,
        "value"        : part.name
    });
}
`;

fs.writeFileSync(path.join(__dirname, '..', 'onshape', 'woodstock-frame.fs'), fsCode);

console.log(`[gen-onshape-spec] onshape/spec.md + onshape/spec.json + onshape/woodstock-frame.fs 已更新`);
console.log(`  零件 ${spec.totals.parts} 件 / 型材实例 ${spec.totals.extrusions} / 节点 ${spec.totals.joints} / 型材 ${(spec.totals.profileLen_mm / 1000).toFixed(2)}m`);
console.log(`  FeatureScript: ${fsItems.length} 个 box 实例待 Onshape 一键生成`);
