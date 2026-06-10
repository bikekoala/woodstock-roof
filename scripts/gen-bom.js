#!/usr/bin/env node
// scripts/gen-bom.js — 由 cad/model.js 自动生成 docs/bom.md
// 单一数据源：改 model.js → 运行本脚本（或 git commit 自动触发）→ bom.md 同步。
// 用法：node scripts/gen-bom.js

const fs = require('fs');
const path = require('path');
const { buildModel, computeBOM, CAT, DEFAULTS, JOINT_SPECS, FASTENERS } = require(path.join(__dirname, '..', 'cad', 'model.js'));

const P = DEFAULTS;
const parts = buildModel(P);
const { items, fasteners, jointsCount } = computeBOM(parts);

const order = ['struct', 'tray', 'panel', 'tank', 'conn'];
const byCat = {};
items.forEach(it => { (byCat[it.cat] = byCat[it.cat] || []).push(it); });

// 按型材累计总长
const lenByProfile = {};
items.forEach(it => {
  if (typeof it.length === 'number') lenByProfile[it.profile] = (lenByProfile[it.profile] || 0) + it.length * it.qty;
});

let md = `# 材料清单 BOM

> ⚙️ **本文件由 \`scripts/gen-bom.js\` 从 \`cad/model.js\` 自动生成，请勿手改。**
> 改零件 → 改 model.js → \`node scripts/gen-bom.js\`（git commit 会自动触发）。
> 当前参数：railSpacing=${P.railSpacing}, railLength=${P.railLength}, boxHeight=${P.boxHeight}, tankH=${P.tankH} (mm)

`;

order.forEach(cat => {
  const rows = (byCat[cat] || []).sort((a, b) => a.code.localeCompare(b.code));
  if (!rows.length) return;
  md += `## ${CAT[cat]}\n\n`;
  md += `| 编号 | 名称 | 截面 | 单根长(mm) | 数量 | 小计(mm) |\n|---|---|---|---|---|---|\n`;
  let sub = 0;
  rows.forEach(r => {
    const L = typeof r.length === 'number' ? r.length : '—';
    const st = typeof r.length === 'number' ? r.length * r.qty : '—';
    if (typeof st === 'number') sub += st;
    md += `| ${r.code} | ${r.name} | ${r.section} | ${L} | ${r.qty} | ${st} |\n`;
  });
  if (sub) md += `| **小计** | | | | | **${sub}** |\n`;
  md += `\n`;
});

md += `## 型材总长（按规格）\n\n`;
Object.keys(lenByProfile).sort().forEach(prof => {
  md += `- ${prof}：约 **${(lenByProfile[prof] / 1000).toFixed(2)} m**\n`;
});
const totalAl = Object.entries(lenByProfile)
  .filter(([k]) => k.includes('铝型材')).reduce((s, [, v]) => s + v, 0);
md += `- **铝型材合计**：约 **${(totalAl / 1000).toFixed(2)} m**（下单按 6m 原料 + 定长切割，留 ~10% 余量）\n\n`;

md += `## 紧固件（按节点表精确累加，不再 ×1.6 估算）\n\n`;
md += `> 共 **${jointsCount}** 个结构连接节点（详见 [joints.md](joints.md)）。每节点的角码型号与所配紧固件如下汇总。\n\n`;
md += `| 编号 | 名称 | 适用槽 | 数量 |\n|---|---|---|---|\n`;
if (fasteners.B1) md += `| B1 | ${FASTENERS.B1.name} | 4040 | ${fasteners.B1} 套 |\n`;
if (fasteners.B2) md += `| B2 | ${FASTENERS.B2.name} | 2020 | ${fasteners.B2} 套 |\n`;
md += `\n> 紧固件 = 螺丝 + T 螺母配对。每个节点的具体角码型号 / 螺丝数见 [joints.md](joints.md)；4040 节点（A1/A2/A4 的 4040 侧）配 B1，2020 节点（A3/A4 的 2020 侧）配 B2。\n\n`;

md += `## 其它（未计入参数化模型）\n\n`;
md += `- 1515 V-slot 滑轨 + V 轮组（伸缩层，待选型）\n`;
md += `- 驱动：齿轮齿条+减速电机（A/B）、12V 笔式推杆（C）\n`;
md += `- U 型卡扣夹具 ×4（连 OEM 导轨）\n`;
md += `- 控制：ESP32 + 驱动板 + 限位（复用 Woodstock）\n`;

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'bom.md'), md);
console.log(`[gen-bom] docs/bom.md 已更新（${items.length} 个编号，铝型材 ${(totalAl / 1000).toFixed(2)} m）`);
