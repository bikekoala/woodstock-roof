#!/usr/bin/env node
// scripts/check-interference.js — 实体干涉自检（保证模型物理可装配）
// 思路：从 model.js 取全部零件的 AABB，对每一对做体积相交检测；按"是否同框接头"分两类：
//   · 非法穿插 (ILLEGAL)：跨子系统/异平面的实体互相穿入（如托盘杆穿过角立柱、太阳能板插进骨架）——必须为 0。
//   · 接头重叠 (JOINT)：同一框架内共面构件在节点处相交（角接/十字），装配时切短或拼接——仅提示，不阻断。
// 滑板 A/B/C 会移动，故对 deploy 0→1 全行程扫描取并集。
// 用法：node scripts/check-interference.js          (有非法穿插则退出码 1)
//      node scripts/check-interference.js --json     (机读)

const path = require('path');
const { buildModel } = require(path.join(__dirname, '..', 'cad', 'model.js'));

const EPS = 0.5; // 小于此穿深视为"面贴合"（合法的堆叠/对接），不算干涉

// 同一框架内合法相交的构件组：组内任意两编号在节点处相交都算 JOINT（切短拼接解决）
const FRAME_GROUPS = [
  ['M1', 'M2', 'M3'],       // 底框
  ['T1', 'T2'],             // 顶框
  ['D1', 'D2', 'D3', 'D4'], // 吊装托盘
  ['PA1', 'PA2', 'K2'],     // D19/D20 板 A 双层折叠：合页跨主板/延展板接缝，共面接合算 JOINT
];
// 跨组的设计内连接（端面贴合，正常不会穿入；列出以免误报）：
//   C1 接底框/顶框、S1 接底框/托盘、D1 接顶框 —— 均为端面 touch，穿深 < EPS 自动豁免。
function sameFrame(a, b) {
  return FRAME_GROUPS.some(g => g.includes(a) && g.includes(b));
}

function intersect(a, b) {
  const ox = Math.min(a.x + a.xw, b.x + b.xw) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.yd, b.y + b.yd) - Math.max(a.y, b.y);
  const oz = Math.min(a.z + a.zh, b.z + b.zh) - Math.max(a.z, b.z);
  if (ox > EPS && oy > EPS && oz > EPS) return { ox, oy, oz, pen: Math.min(ox, oy, oz) };
  return null;
}

// 全行程扫描，记录每一对的最大穿深
//  · deploy 0→1 全程扫（板 A 折叠态沿 x 滑出，中间态线性插值物理正确）
//  · flip 只验两端态（折叠/展开）：中间态合页是弧线旋转、线性插值会假撞
const worst = new Map(); // key "CODEA|CODEB" -> {a,b,an,bn,pen,box}
const stateGrid = [];
for (let i = 0; i <= 20; i++) stateGrid.push({ deploy: i / 20, flip: 0 });
stateGrid.push({ deploy: 1, flip: 1 });   // 二次展开终态（PA2 与 PA1 边对边共面，不重叠）
for (const state of stateGrid) {
  // 连接件（角码 A*）/ 电动接口（motor）本就是骑在所连构件上的，与梁重叠属正常 → 不参与穿插检测
  const parts = buildModel(state).filter(p => p.cat !== 'conn' && p.cat !== 'motor');
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const A = parts[i], B = parts[j];
      if (A.code === B.code) continue;            // 同编号同款零件（左右成对等）不互检
      const r = intersect(A, B);
      if (!r) continue;
      const key = [A.code, B.code].sort().join('|');
      const prev = worst.get(key);
      if (!prev || r.pen > prev.pen)
        worst.set(key, { a: A.code, b: B.code, an: A.name, bn: B.name, pen: r.pen,
          box: `${r.ox.toFixed(0)}×${r.oy.toFixed(0)}×${r.oz.toFixed(0)}` });
    }
  }
}

const illegal = [], joints = [];
for (const h of worst.values()) (sameFrame(h.a, h.b) ? joints : illegal).push(h);
illegal.sort((x, y) => y.pen - x.pen);
joints.sort((x, y) => y.pen - x.pen);

// ---- 悬挂/支撑件"承接"检查（捕捉"该接没接上"的悬空——干涉检测看不见缝隙）----
// 竖向承力件的承力端必须与被接构件有"面积接触"（>0 投影重叠），仅棱边/缝隙都算未接。
//   TOP_BEARING：顶端要顶在上方构件底面（吊柱挂顶框、立柱接顶框、竖撑接托盘）。
//   BOT_BEARING：底端要坐在下方构件顶面（立柱坐底框、竖撑坐底框/托盘）。D1 底端是与边梁 D2 的并接（角码），故不查底。
const TOP_BEARING = { C1: 1, S1: 1, S2: 1, S3: 1, D1: 1 };
const BOT_BEARING = { C1: 1, S1: 1, S2: 1, S3: 1, D1: 1 };
const parts0 = buildModel({ deploy: 0 }).filter(p => p.cat !== 'conn');
const areaXY = (a, b) => (Math.min(a.x + a.xw, b.x + b.xw) - Math.max(a.x, b.x) > EPS)
  && (Math.min(a.y + a.yd, b.y + b.yd) - Math.max(a.y, b.y) > EPS);
const inZ = (b, z) => b.z - EPS <= z && z <= b.z + b.zh + EPS;
const bears = (c, z) => parts0.some(b => b !== c && b.code !== c.code && areaXY(c, b) && inZ(b, z));
const floating = [];
for (const c of parts0) {
  if (TOP_BEARING[c.code] && !bears(c, c.z + c.zh)) floating.push({ c: c.code, n: c.name, end: '顶端', z: c.z + c.zh });
  if (BOT_BEARING[c.code] && !bears(c, c.z)) floating.push({ c: c.code, n: c.name, end: '底端', z: c.z });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ illegal, joints, floating }, null, 2));
  process.exit(illegal.length || floating.length ? 1 : 0);
}

console.log('=== 实体干涉自检（全行程 deploy 0→1）===\n');
if (illegal.length === 0) {
  console.log('✅ 非法穿插：0 处（无跨件互穿）');
} else {
  console.log(`❌ 非法穿插：${illegal.length} 处 ——\n`);
  illegal.forEach(h => console.log(`   ${h.a}×${h.b}  ${h.an} / ${h.bn}  穿深 ${h.pen.toFixed(0)}mm  重叠 ${h.box}`));
}
console.log('');
if (floating.length === 0) {
  console.log('✅ 承接检查：0 处悬空（所有吊柱/立柱/竖撑两端均面接到位）');
} else {
  console.log(`❌ 悬空未接：${floating.length} 处 ——\n`);
  floating.forEach(f => console.log(`   ${f.c} ${f.n} 的${f.end}(z=${f.z}) 无面接构件 —— 该承力端悬空`));
}
console.log('');
if (joints.length) {
  console.log(`ℹ️  框架接头重叠：${joints.length} 类（同框构件节点相交，装配切短/拼接，BOM 长度按对接料计）——`);
  joints.forEach(h => console.log(`   ${h.a}×${h.b}  ${h.an} / ${h.bn}  穿深 ${h.pen.toFixed(0)}mm`));
}
console.log('');
process.exit(illegal.length || floating.length ? 1 : 0);
