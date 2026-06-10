// ============================================================
// cad/model.js — 单一数据源（Single Source of Truth）
// 零件定义（几何 + BOM 元数据）。浏览器与 Node 共用。
// 改这里 → 3D 预览 与 docs/bom.md 一起更新。
// 不要在 HTML 里另写零件定义；不要手改 docs/bom.md（自动生成）。
// ============================================================
(function (root) {
  // 默认主控参数（railSpacing/railLength 已按 2026-06-10 实测回填；zBot 仍待实测）
  const DEFAULTS = {
    railSpacing: 1020,  // OEM 导轨中心距，实测：后端 1020、前端 1070 渐缩，取后端
    railLength:  1300,  // 主纵梁长，实测：平直支撑段 1000 + 前坡 250/后坡 200，折中取 1300
    boxHeight:   110,   // 箱体内净高（立柱高）
    panelTravel: 1000,  // 单侧抽出行程
    deploy:      0,     // 展开程度 0~1（仅影响显示位置）
    tankH:       70,    // 水箱/托盘深
  };
  // 固定常量
  const P40 = 40, P20 = 20, panelW = 1000, panelL = 1200, zBot = 35; // zBot=OEM 导轨抬高，待实测
  // 调色板
  const COLOR = { frame: 0x4a90d9, tray: 0xe07b39, panel: 0x1f3a5f, tank: 0x37c0e0 };
  // 类别中文名
  const CAT = { struct: '箱体骨架 4040', tray: '吊装托盘', panel: '太阳能板', tank: '水箱', conn: '连接件（估算）' };

  // 生成全部零件记录（含几何与元数据）。vis = 控制其显隐的开关名（null=常显）。
  function buildModel(opts) {
    const P = Object.assign({}, DEFAULTS, opts || {});
    // railSpacing = 箱体总外宽（实测 OEM 导轨外缘跨距 1020）。两侧纵梁各占 40，
    // 横梁/内腔净宽 = 总宽 − 2×40。之前误把 railSpacing 当净宽又外扩 80，导致总宽虚胖到 1100、横梁多算 80（D11 修正）。
    const outerW = P.railSpacing, gap = P.railSpacing - 2 * P40;
    const xc = (outerW - panelW) / 2, off = P.deploy * P.panelTravel;
    const zBotTop = zBot + P40, zTop0 = zBotTop + P.boxHeight, zTop1 = zTop0 + P40;
    const floor = zTop0 - P.tankH;
    const parts = [];
    const B = (vis, code, name, profile, section, length, cat, xw, yd, zh, x, y, z, color, opacity) =>
      parts.push({ vis, code, name, profile, section, length, cat, xw, yd, zh, x, y, z, color, opacity: opacity == null ? 1 : opacity });

    // ----- 底框 4040 -----
    B(null, 'M1', '底框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, 0, 0, zBot, COLOR.frame);
    B(null, 'M1', '底框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, outerW - P40, 0, zBot, COLOR.frame);
    B(null, 'M2', '底框横梁', '4040 铝型材', '40×40', gap, 'struct', gap, P40, P40, P40, 0, zBot, COLOR.frame);
    B(null, 'M2', '底框横梁', '4040 铝型材', '40×40', gap, 'struct', gap, P40, P40, P40, P.railLength - P40, zBot, COLOR.frame);
    B(null, 'M3', '底框中央纵梁', '2020 铝型材', '20×20', P.railLength, 'struct', P20, P.railLength, P20, outerW / 2 - P20 / 2, 0, zBot + (P40 - P20), COLOR.frame); // 降 2020：不在水箱承重路上，仅中脊/抗扭（D12），顶面齐平 z=75
    // ----- 角立柱 4040 -----
    [[0, 0], [outerW - P40, 0], [0, P.railLength - P40], [outerW - P40, P.railLength - P40]].forEach(([x, y]) =>
      B(null, 'C1', '角立柱', '4040 铝型材', '40×40', P.boxHeight, 'struct', P40, P40, P.boxHeight, x, y, zBotTop, COLOR.frame));
    // ----- 顶框 4040（含中梁）-----
    B(null, 'T1', '顶框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, 0, 0, zTop0, COLOR.frame);
    B(null, 'T1', '顶框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, outerW - P40, 0, zTop0, COLOR.frame);
    // T2 降 2020：吊载经 T1 与"中横梁+S2"两路下传，中横梁被 S2 在跨中托住、跨度减半 → 2020 足够（D12）。顶面齐平 z=205~225。
    B(null, 'T2', '顶框横梁', '2020 铝型材', '20×20', gap, 'struct', gap, P20, P20, P40, 0, zTop0 + P20, COLOR.frame);
    B(null, 'T2', '顶框横梁', '2020 铝型材', '20×20', gap, 'struct', gap, P20, P20, P40, P.railLength - P20, zTop0 + P20, COLOR.frame);
    B(null, 'T2', '顶框横梁', '2020 铝型材', '20×20', gap, 'struct', gap, P20, P20, P40, P.railLength / 2 - P20 / 2, zTop0 + P20, COLOR.frame);
    // ----- 中央竖撑 2020 -----
    const cx = outerW / 2 - P20 / 2, sh = floor - zBotTop;
    B(null, 'S1', '中央竖撑', '2020 铝型材', '20×20', Math.round(sh), 'struct', P20, P20, sh, cx, 0, zBotTop, COLOR.frame);
    B(null, 'S1', '中央竖撑', '2020 铝型材', '20×20', Math.round(sh), 'struct', P20, P20, sh, cx, P.railLength - P20, zBotTop, COLOR.frame);
    // ----- 中央吊撑 S2：顶框中横梁 → 托盘中脊 D4，跨中加支点，使 T2 可降 2020（见 docs/decisions.md D12）-----
    const s2h = (zTop0 + P20) - (floor + P20);
    B(null, 'S2', '中央吊撑', '2020 铝型材', '20×20', Math.round(s2h), 'struct', P20, P20, s2h, outerW / 2 - P20 / 2, P.railLength / 2 - P20 / 2, floor + P20, COLOR.frame);
    // ----- 前后端中央立柱 S3：D4 端部 → T2 端横梁中点。功能 = 刹车/颠簸时的水平拦阻骨架
    //   （前后端中线在 D3 z135 与 T2 z205 之间本有 70mm 高的口子，水箱/置物会从此飞出），
    //   兼作绑带/网兜锚点。力学非必需（顶板载荷小、T2 跨 940 2020 已够），关键是物理约束。
    //   几何与 S2 镜像，仅 y 位置不同（前端 y=0、后端 y=railLength-20）。详见 docs/decisions.md D16。
    B(null, 'S3', '前后端中央立柱', '2020 铝型材', '20×20', Math.round(s2h), 'struct', P20, P20, s2h, outerW / 2 - P20 / 2, 0, floor + P20, COLOR.frame);
    B(null, 'S3', '前后端中央立柱', '2020 铝型材', '20×20', Math.round(s2h), 'struct', P20, P20, s2h, outerW / 2 - P20 / 2, P.railLength - P20, floor + P20, COLOR.frame);
    // ----- 底层 板C -----
    B('showPanelC', 'PC', '太阳能板C(下挂)', 'ETFE 柔性板', '1000×1200', '—', 'panel', panelW, panelL, 8, xc, -off, zBot - 14, COLOR.panel, 0.95);
    // ----- 中层 板B / 板A（长边=railLength-120 居中：对角立柱让 20、对竖撑 S1 让 40，滑出路径零碰撞，见 docs/decisions.md D9）-----
    const abLen = Math.min(panelL, P.railLength - 120), abY = (P.railLength - abLen) / 2;
    B('showSliding', 'PB', '太阳能板B(右滑)', 'ETFE 柔性板', '1000×' + abLen, '—', 'panel', panelW, abLen, 8, xc + off, abY, zBotTop + 8, COLOR.panel, 0.92);
    B('showSliding', 'PA', '太阳能板A(左滑)', 'ETFE 柔性板', '1000×' + abLen, '—', 'panel', panelW, abLen, 8, xc - off, abY, zBotTop + 22, COLOR.panel, 0.92);
    // ----- 整体托盘：边梁 D2 升 4040，与 M1/C1 同规格、同 x 平面（x0–40 / outerW−40），两端直接怼进前后角立柱 C1。
    //   托盘载荷 D2 → C1 → M1 → 导轨 直传（这才是"接到 C1"）。D2 跨两立柱(1220) 4040 自身够刚(跨中垂~1mm)，
    //   故原中段吊柱 D1 由立柱顶替、取消（与上次误删不同：那时 D2 还是细 2020 需 D1 兜）。详见 docs/decisions.md D15。
    const yMid = P.railLength / 2 - P20 / 2;
    const d2Len = P.railLength - 2 * P40;             // D2 在前后两立柱之间对接（1220）
    const gap2 = outerW - 2 * P40;                    // 托盘内净宽 = 两 D2 内侧之间（940）
    B('showTray', 'D2', '托盘纵向边梁', '4040 铝型材', '40×40', d2Len, 'tray', P40, d2Len, P40, 0, P40, floor, COLOR.tray);
    B('showTray', 'D2', '托盘纵向边梁', '4040 铝型材', '40×40', d2Len, 'tray', P40, d2Len, P40, outerW - P40, P40, floor, COLOR.tray);
    [0, P.railLength * 0.25 - P20 / 2, yMid, P.railLength * 0.75 - P20 / 2, P.railLength - P20].forEach(y =>
      B('showTray', 'D3', '托盘承托横档', '2020 铝型材', '20×20', gap2, 'tray', gap2, P20, P20, P40, y, floor, COLOR.tray));
    B('showTray', 'D4', '托盘中央纵梁', '2020 铝型材', '20×20', P.railLength, 'tray', P20, P.railLength, P20, outerW / 2 - P20 / 2, 0, floor, COLOR.tray);
    // ----- 水箱（坐在托盘内，宽=托盘内净宽 gap2）-----
    B('showTank', 'WT', '扁平水箱', '不锈钢扁箱', gap2 + '×' + (P.railLength / 2 - 80) + '×' + P.tankH, '—', 'tank',
      gap2, P.railLength / 2 - 80, P.tankH - P20, P40, 40, floor + P20, COLOR.tank, 0.5);
    // ----- 顶板（固定）-----
    B('showTopPanel', 'PT', '顶板(固定)', 'ETFE 柔性板', '1000×' + (P.railLength / 2 - 60), '—', 'panel',
      1000, P.railLength / 2 - 60, 8, xc, 40, zTop1, COLOR.panel, 0.95);

    return parts;
  }

  // 按编号聚合 + 连接件估算（浏览器与 Node 共用）
  function computeBOM(parts) {
    const map = new Map();
    parts.forEach(p => {
      if (!map.has(p.code)) map.set(p.code, Object.assign({}, p, { qty: 0 }));
      map.get(p.code).qty++;
    });
    const beams = parts.filter(p => p.cat === 'struct' || p.cat === 'tray').length;
    const angles = Math.round(beams * 1.6);
    return { items: [...map.values()], angles };
  }

  const api = { DEFAULTS, CONST: { P40, P20, panelW, panelL, zBot }, COLOR, CAT, buildModel, computeBOM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoofModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
