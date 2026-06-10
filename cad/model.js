// ============================================================
// cad/model.js — 单一数据源（Single Source of Truth）
// 零件定义（几何 + BOM 元数据）。浏览器与 Node 共用。
// 改这里 → 3D 预览 与 docs/bom.md 一起更新。
// 不要在 HTML 里另写零件定义；不要手改 docs/bom.md（自动生成）。
// ============================================================
(function (root) {
  // 默认主控参数（实测真车后回填这里）
  const DEFAULTS = {
    railSpacing: 1000,  // OEM 导轨中心距（实测）
    railLength:  1200,  // 主纵梁长
    boxHeight:   110,   // 箱体内净高（立柱高）
    panelTravel: 1000,  // 单侧抽出行程
    deploy:      0,     // 展开程度 0~1（仅影响显示位置）
    tankH:       70,    // 水箱/托盘深
  };
  // 固定常量
  const P40 = 40, P20 = 20, panelW = 1000, panelL = 1200, zBot = 35;
  // 调色板
  const COLOR = { frame: 0x4a90d9, tray: 0xe07b39, panel: 0x1f3a5f, tank: 0x37c0e0 };
  // 类别中文名
  const CAT = { struct: '箱体骨架 4040', tray: '吊装托盘', panel: '太阳能板', tank: '水箱', conn: '连接件（估算）' };

  // 生成全部零件记录（含几何与元数据）。vis = 控制其显隐的开关名（null=常显）。
  function buildModel(opts) {
    const P = Object.assign({}, DEFAULTS, opts || {});
    const gap = P.railSpacing, outerW = P.railSpacing + 2 * P40;
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
    B(null, 'M3', '底框中央纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, outerW / 2 - P40 / 2, 0, zBot, COLOR.frame);
    // ----- 角立柱 4040 -----
    [[0, 0], [outerW - P40, 0], [0, P.railLength - P40], [outerW - P40, P.railLength - P40]].forEach(([x, y]) =>
      B(null, 'C1', '角立柱', '4040 铝型材', '40×40', P.boxHeight, 'struct', P40, P40, P.boxHeight, x, y, zBotTop, COLOR.frame));
    // ----- 顶框 4040（含中梁）-----
    B(null, 'T1', '顶框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, 0, 0, zTop0, COLOR.frame);
    B(null, 'T1', '顶框纵梁', '4040 铝型材', '40×40', P.railLength, 'struct', P40, P.railLength, P40, outerW - P40, 0, zTop0, COLOR.frame);
    B(null, 'T2', '顶框横梁', '4040 铝型材', '40×40', gap, 'struct', gap, P40, P40, P40, 0, zTop0, COLOR.frame);
    B(null, 'T2', '顶框横梁', '4040 铝型材', '40×40', gap, 'struct', gap, P40, P40, P40, P.railLength - P40, zTop0, COLOR.frame);
    B(null, 'T2', '顶框横梁', '4040 铝型材', '40×40', gap, 'struct', gap, P40, P40, P40, P.railLength / 2 - P40 / 2, zTop0, COLOR.frame);
    // ----- 中央竖撑 2020 -----
    const cx = outerW / 2 - P20 / 2, sh = floor - zBotTop;
    B(null, 'S1', '中央竖撑', '2020 铝型材', '20×20', Math.round(sh), 'struct', P20, P20, sh, cx, 0, zBotTop, COLOR.frame);
    B(null, 'S1', '中央竖撑', '2020 铝型材', '20×20', Math.round(sh), 'struct', P20, P20, sh, cx, P.railLength - P20, zBotTop, COLOR.frame);
    // ----- 底层 板C -----
    B('showPanelC', 'PC', '太阳能板C(下挂)', 'ETFE 柔性板', '1000×1200', '—', 'panel', panelW, panelL, 8, xc, -off, zBot - 14, COLOR.panel, 0.95);
    // ----- 中层 板B / 板A -----
    B('showSliding', 'PB', '太阳能板B(右滑)', 'ETFE 柔性板', '1000×1200', '—', 'panel', panelW, panelL, 8, xc + off, 0, zBotTop + 8, COLOR.panel, 0.92);
    B('showSliding', 'PA', '太阳能板A(左滑)', 'ETFE 柔性板', '1000×1200', '—', 'panel', panelW, panelL, 8, xc - off, 0, zBotTop + 22, COLOR.panel, 0.92);
    // ----- 整体吊装托盘 2020 -----
    const drop = zTop0 - floor, yMid = P.railLength / 2 - P20 / 2;
    B('showTray', 'D1', '托盘吊立柱', '2020 铝型材', '20×20', Math.round(drop), 'tray', P20, P20, drop, 0, yMid, floor, COLOR.tray);
    B('showTray', 'D1', '托盘吊立柱', '2020 铝型材', '20×20', Math.round(drop), 'tray', P20, P20, drop, outerW - P20, yMid, floor, COLOR.tray);
    B('showTray', 'D2', '托盘纵向边梁', '2020 铝型材', '20×20', P.railLength, 'tray', P20, P.railLength, P20, 0, 0, floor, COLOR.tray);
    B('showTray', 'D2', '托盘纵向边梁', '2020 铝型材', '20×20', P.railLength, 'tray', P20, P.railLength, P20, outerW - P20, 0, floor, COLOR.tray);
    [0, P.railLength * 0.25 - P20 / 2, yMid, P.railLength * 0.75 - P20 / 2, P.railLength - P20].forEach(y =>
      B('showTray', 'D3', '托盘承托横档', '2020 铝型材', '20×20', outerW, 'tray', outerW, P20, P20, 0, y, floor, COLOR.tray));
    B('showTray', 'D4', '托盘中央纵梁', '2020 铝型材', '20×20', P.railLength, 'tray', P20, P.railLength, P20, outerW / 2 - P20 / 2, 0, floor, COLOR.tray);
    // ----- 水箱 -----
    B('showTank', 'WT', '扁平水箱', '不锈钢扁箱', gap + '×' + (P.railLength / 2 - 80) + '×' + P.tankH, '—', 'tank',
      gap, P.railLength / 2 - 80, P.tankH - P20, P40, 40, floor + P20, COLOR.tank, 0.5);
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
