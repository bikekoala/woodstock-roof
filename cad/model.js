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
    boxHeight:   130,   // 箱体内净高（立柱高）— D19 升 110→130 容纳中层 44mm（滑轨 27+主 6+合页 3+延 8）
    panelTravel: 1000,  // 板 A 沿 x 滑出行程（主驾侧）
    deploy:      0,     // 滑出程度 0~1（板 A 整体沿 x 向左滑）
    flip:        0,     // 延展板翻 180° 程度 0~1（D20 二次展开）— 0=叠主板上、1=共面外侧
    tankH:       70,    // 水箱/托盘深
  };
  // 固定常量
  const P40 = 40, P20 = 20, panelW = 1000, panelL = 1120, zBot = 35;
  // 板 A 复合结构（D19/D20）：主板 ETFE 3 + 铝塑板 3 = 6mm；延展板 ETFE 3 + 蜂窝铝 5 = 8mm；合页 3mm
  const panelMainH = 6, panelExtH = 8, hingeH = 3, railFlatH = 27;
  // 调色板（panelExt 用稍浅色区分延展板）
  const COLOR = { frame: 0x4a90d9, tray: 0xe07b39, panel: 0x1f3a5f, panelExt: 0x3b5f8a, tank: 0x37c0e0, slide: 0x6b7280, hinge: 0x10b981 };
  // 类别中文名
  const CAT = { struct: '箱体骨架 4040', tray: '吊装托盘', panel: '太阳能板', tank: '水箱', slide: '滑轨/合页', conn: '连接件 角码（按节点登记 docs/joints.md）', motor: '电动接口（D22）' };

  // ===== 连接节点（角码）型号字典 — 见 docs/joints.md =====
  // box  = 3D 标识方块外接尺寸（mm，BOM 与 3D 一致）。简化呈现：每节点 1 块方块代表角码位置，
  //        颜色按规格区分；BOM 数量按规格聚合，紧固件按每节点 screws 累加。真实角码 L 形/带筋外形
  //        留到转 Onshape 阶段用厂商 STEP 替换。
  // screws = 该规格每块角码需要的紧固件数（B1 = M6 套，B2 = M5 套）。
  // box = 3D 标识方块尺寸（mm）：缩小至原角码 ~40-50%，避免遮挡型材结构；尺寸差仍可一眼分辨型号
  //       A2 重型最大(30)、A1/A4 中(22)、A3 最小(15)。真实角码 L 形/带筋外形留到转 Onshape 用厂商 STEP 替换。
  const JOINT_SPECS = {
    A1: { box: [22, 22, 22], color: 0xf59e0b, name: '4040 标准 L 角码', mat: '铝合金 L40×40×3.5mm', screws: { B1: 2 } },
    A2: { box: [30, 30, 30], color: 0xd97706, name: '4040 重型加强角码', mat: '铸铝 L80×80×60 带筋', screws: { B1: 4 } },
    A3: { box: [15, 15, 15], color: 0xfbbf24, name: '2020 标准 L 角码', mat: '铝合金 L20×20×3mm', screws: { B2: 2 } },
    A4: { box: [22, 22, 15], color: 0xfb923c, name: '4040↔2020 转接 L 角码', mat: '转接 L40×20', screws: { B1: 2, B2: 2 } },
    // U1 = 连车 U 卡扣（夹 M1 底面 + 抱底 OEM 导轨）— 自带螺栓，不进 B1/B2
    U1: { box: [40, 60, 30], color: 0x10b981, name: '4040 U 卡扣（连车）', mat: '不锈钢 U 夹（抱 OEM 导轨）', screws: {} },
    // K1 = 水箱 4 角压片（A3 + 弹簧片）— 真实卡子待水箱定型校正
    K1: { box: [20, 20, 15], color: 0x06b6d4, name: '水箱角压片', mat: 'A3 角码 + 不锈钢弹簧片', screws: { B2: 2 } },
    // D19/D20 板 A 双层折叠机构：滑轨自带螺孔不进 B1/B2、合页自带铆钉
    R1: { box: [30, 12, 27], color: 0x6b7280, name: '扁装三节滑轨 1m 全伸', mat: '钢制三节抽屉滑轨 27×12.7×1000', screws: {} },
    K2: { box: [25, 12, 3],  color: 0x10b981, name: '钢琴合页（主板↔延展板）', mat: 'SS304 钢琴合页 1120mm 整条', screws: {} },
    // D22 电动接口 marker（具体型号待选）
    E0: { cat: 'motor', box: [80, 60, 30], color: 0x8b5cf6, name: 'ESP32 控制盒（含 L298N）', mat: 'ABS 盒 80×60×30 + ESP32-DevKit + L298N', screws: {} },
    E1: { cat: 'motor', box: [40, 35, 30], color: 0xa855f7, name: 'DC 减速电机（滑出驱动）', mat: '12V 30W 减速电机 + GT2 带轮', screws: {} },
    E2: { cat: 'motor', box: [25, 25, 25], color: 0xc084fc, name: 'GT2 同步带轮 / 张紧轮', mat: '20T GT2 同步轮 25×25 圆柱', screws: {} },
    E3: { cat: 'motor', box: [250, 25, 25], color: 0xa855f7, name: '电动推杆（延展板翻折驱动）', mat: '12V 直线推杆 250mm 行程沿 x', screws: {} },
    L1: { cat: 'motor', box: [10, 10, 5],  color: 0xef4444, name: '限位微动开关', mat: '机械微动 + 霍尔备份', screws: {} },
  };
  const FASTENERS = {
    B1: { name: 'M6×16 内六角 + 弹簧 T 螺母 M6', use: '4040 槽用（A1/A2/A4 的 4040 侧）' },
    B2: { name: 'M5×12 内六角 + 弹簧 T 螺母 M5', use: '2020 槽用（A3/A4/K1 的 2020 侧）' },
  };

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
    // ----- 底层 板C（下挂前抽，保留）-----
    B('showPanelC', 'PC', '太阳能板C(下挂前抽)', 'ETFE 柔性板', '1000×1120 + 3mm 铝塑', '—', 'panel', panelW, panelL, 6, xc, -off, zBot - 12, COLOR.panel, 0.95);
    // ===== D19/D20：取消板 B；板 A 拆为主板 PA1 + 延展板 PA2（合页对折，单侧二次展开）=====
    // 居中端隙 = (railLength - panelL)/2 = 90mm/端（前 90 / 后 90）
    const paY = (P.railLength - panelL) / 2;
    const zRail = zBotTop;                       // 滑轨底 z=75
    const zPa1  = zRail + railFlatH;             // 主板底 z=102（滑轨顶）
    const zHinge = zPa1 + panelMainH;            // 合页 z=108（主板顶）
    const zPa2Fold = zHinge + hingeH;            // 折叠态延展板底 z=111
    const zPa2Open = zPa1;                       // 展开态延展板底 z=102（与主板共面）
    // 滑出位移：deploy 0→1 = 板整体沿 x 向主驾（左，x 负向）滑出 panelTravel mm
    const slideX = -P.deploy * P.panelTravel;
    // 折叠/翻折状态：flip 0→1 = 延展板从"叠主板上"翻到"主板外侧共面"
    // 折叠时 PA2 位置 = PA1 位置（叠上方），翻到 1 时 PA2 位置 = PA1 位置 - panelW（外侧共面）
    const flipDX = -P.flip * panelW;
    const pa2Z = zPa2Fold + P.flip * (zPa2Open - zPa2Fold);   // 翻转过程中 z 从 111 渐降到 102
    // 主板 PA1（下层 · 始终发电朝上）
    B('showSliding', 'PA1', '太阳能板A主板', 'ETFE 柔性 + 3mm 铝塑', '1000×1120', '—', 'panel',
      panelW, panelL, panelMainH, xc + slideX, paY, zPa1, COLOR.panel, 0.95);
    // 延展板 PA2（上层 · 折叠时电池片朝下；翻 180° 后朝上）
    // ⚠️ 延展板生产时电池片要装"折叠朝下、翻后朝上"那一面（详见 docs/decisions.md D19）
    B('showSliding', 'PA2', '太阳能板A延展板', 'ETFE 柔性 + 5mm 蜂窝铝', '1000×1120', '—', 'panel',
      panelW, panelL, panelExtH, xc + slideX + flipDX, paY, pa2Z, COLOR.panelExt, 0.92);
    // ===== 扁装三节滑轨 R1：M2 前/后横梁顶面各一根，沿 x 1m =====
    const railLen = P.panelTravel;               // 1000mm 全伸三节
    const railX = (outerW - railLen) / 2;        // 居中（收回时滑轨完全在箱内）
    // 收回 → 展开：滑轨内拉段同步左移 deploy×panelTravel；近似呈现外段固定 + 内段位移
    // 简化用一根 marker（不分三段），位置随板移动
    const railSlideX = -P.deploy * P.panelTravel / 2;        // 中段平均位移
    B('showSliding', 'R1', '扁装三节滑轨(前)', '钢制 27×12.7×1000', '—', 1000, 'slide',
      railLen, 12, railFlatH, railX + railSlideX, P40, zRail, COLOR.slide, 0.85);
    B('showSliding', 'R1', '扁装三节滑轨(后)', '钢制 27×12.7×1000', '—', 1000, 'slide',
      railLen, 12, railFlatH, railX + railSlideX, P.railLength - P40 - 12, zRail, COLOR.slide, 0.85);
    // ===== 钢琴合页 K2（主板外端整条沿 y 方向 1120mm）=====
    // 折叠时合页在主板外端（朝主驾外的 x 方向）；滑出+翻折时合页位置随板移动
    B('showSliding', 'K2', '钢琴合页 SS304 1120mm', 'SS304 钢琴合页', '—', panelL, 'slide',
      6, panelL, hingeH, xc + slideX - 3, paY, zHinge, COLOR.hinge, 0.95);
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
    // ----- 顶板（固定）— 厚 6mm 与板 C 同规格（D19）-----
    B('showTopPanel', 'PT', '顶板(固定)', 'ETFE 柔性 + 3mm 铝塑', '1000×' + (P.railLength / 2 - 60), '—', 'panel',
      1000, P.railLength / 2 - 60, 6, xc, 40, zTop1, COLOR.panel, 0.95);

    // ===== 连接节点（角码 marker）/ 电动接口 marker — 节点表见 docs/joints.md =====
    buildJoints(P).forEach(j => {
      const s = JOINT_SPECS[j.spec];
      const [w, d, h] = s.box;
      const cat = s.cat || 'conn';           // spec 可声明自己的 cat（如 E0/E1/L1 = 'motor'），默认连接件
      const visKey = cat === 'motor' ? 'showJoints' : 'showJoints';
      for (let k = 0; k < j.qty; k++) {
        // qty=2 节点的 2 块沿 x 错开 25mm，视觉对称可辨；不动 BOM 件数
        const dx = j.qty > 1 ? (k === 0 ? -12 : 12) : 0;
        parts.push({
          vis: visKey, code: j.spec, name: s.name, profile: cat === 'motor' ? '电动接口' : '角码', section: s.mat,
          length: '—', cat: cat,
          xw: w, yd: d, zh: h,
          x: j.pos[0] + dx, y: j.pos[1], z: j.pos[2],
          color: s.color, opacity: 0.92,
          joint: j.id, loc: j.loc,
        });
      }
    });

    return parts;
  }

  // 节点定义（41 项；详见 docs/joints.md）— pos = 角码 marker 的最小角点 (x,y,z)
  function buildJoints(P) {
    const outerW = P.railSpacing, cx = outerW / 2;
    const zBotTop = zBot + P40;
    const zTop0 = zBotTop + P.boxHeight;
    const floor = zTop0 - P.tankH;
    const yMid = P.railLength / 2;
    // D3 五根的 y（与 buildModel 内 D3 几何一致）
    const d3Ys = [40, P.railLength * 0.25 - P20 / 2, yMid - P20 / 2, P.railLength * 0.75 - P20 / 2, P.railLength - P20];
    const J = [
      // 底框 4 角 (A2 重型, C1↔M1↔M2 三件汇合)
      { id: 'J01', loc: '底框左前角(C1↔M1↔M2)', spec: 'A2', pos: [0,           0,                  zBotTop], qty: 1 },
      { id: 'J02', loc: '底框右前角',             spec: 'A2', pos: [outerW - 60, 0,                  zBotTop], qty: 1 },
      { id: 'J03', loc: '底框左后角',             spec: 'A2', pos: [0,           P.railLength - 60,  zBotTop], qty: 1 },
      { id: 'J04', loc: '底框右后角',             spec: 'A2', pos: [outerW - 60, P.railLength - 60,  zBotTop], qty: 1 },
      // M3 端接 M2 横梁中点 (A4 转接)
      { id: 'J05', loc: 'M3前端接M2', spec: 'A4', pos: [cx - 20, 0,                  zBotTop - 20], qty: 1 },
      { id: 'J06', loc: 'M3后端接M2', spec: 'A4', pos: [cx - 20, P.railLength - 40,  zBotTop - 20], qty: 1 },
      // S1 底 (A3 ×2, 接 M2/M3)
      { id: 'J07', loc: 'S1前底接M2/M3', spec: 'A3', pos: [cx - 10, 20,                  zBotTop], qty: 2 },
      { id: 'J08', loc: 'S1后底接M2/M3', spec: 'A3', pos: [cx - 10, P.railLength - 40,    zBotTop], qty: 2 },
      // 顶框 4 角 (A2 重型, C1↔T1↔T2)
      { id: 'J09', loc: '顶框左前角(C1↔T1↔T2)', spec: 'A2', pos: [0,           0,                  zTop0 - 20], qty: 1 },
      { id: 'J10', loc: '顶框右前角',             spec: 'A2', pos: [outerW - 60, 0,                  zTop0 - 20], qty: 1 },
      { id: 'J11', loc: '顶框左后角',             spec: 'A2', pos: [0,           P.railLength - 60,  zTop0 - 20], qty: 1 },
      { id: 'J12', loc: '顶框右后角',             spec: 'A2', pos: [outerW - 60, P.railLength - 60,  zTop0 - 20], qty: 1 },
      // T2 中横梁端接 T1 (A4 转接)
      { id: 'J13', loc: 'T2中横L端接T1', spec: 'A4', pos: [20,          yMid - 10, zTop0 + 20], qty: 1 },
      { id: 'J14', loc: 'T2中横R端接T1', spec: 'A4', pos: [outerW - 60, yMid - 10, zTop0 + 20], qty: 1 },
      // S2 顶 + S3 前后顶 (A3 ×2, 接 T2)
      { id: 'J15', loc: 'S2顶接T2中横',  spec: 'A3', pos: [cx - 10, yMid - 10,           zTop0 + 20], qty: 2 },
      { id: 'J16', loc: 'S3前顶接T2前横', spec: 'A3', pos: [cx - 10, 20,                  zTop0 + 20], qty: 2 },
      { id: 'J17', loc: 'S3后顶接T2后横', spec: 'A3', pos: [cx - 10, P.railLength - 40,    zTop0 + 20], qty: 2 },
      // D2 怼 C1 (A2 关键承力, D15 决策)
      { id: 'J18', loc: 'D2左前怼C1', spec: 'A2', pos: [0,           40,                 floor], qty: 1 },
      { id: 'J19', loc: 'D2左后怼C1', spec: 'A2', pos: [0,           P.railLength - 100, floor], qty: 1 },
      { id: 'J20', loc: 'D2右前怼C1', spec: 'A2', pos: [outerW - 60, 40,                 floor], qty: 1 },
      { id: 'J21', loc: 'D2右后怼C1', spec: 'A2', pos: [outerW - 60, P.railLength - 100, floor], qty: 1 },
      // S1 顶 / S2 底 / S3 前后底 (A3 ×2, 接 D4)
      { id: 'J37', loc: 'S1前顶接D4', spec: 'A3', pos: [cx - 10, 20,                 floor],      qty: 2 },
      { id: 'J38', loc: 'S1后顶接D4', spec: 'A3', pos: [cx - 10, P.railLength - 40,   floor],      qty: 2 },
      { id: 'J39', loc: 'S2底接D4中', spec: 'A3', pos: [cx - 10, yMid - 10,           floor + 20], qty: 2 },
      { id: 'J40', loc: 'S3前底接D4', spec: 'A3', pos: [cx - 10, 20,                 floor + 20], qty: 2 },
      { id: 'J41', loc: 'S3后底接D4', spec: 'A3', pos: [cx - 10, P.railLength - 40,   floor + 20], qty: 2 },
    ];
    // D3×D2 (J22-31)：5 根 × 两端；第一/末根沿 D3 轴往内偏 20mm 避开 D2 端 A2
    d3Ys.forEach((y, i) => {
      const off = (i === 0) ? 25 : (i === 4 ? -25 : 0);
      J.push({ id: 'J' + (22 + i * 2), loc: 'D3#' + (i + 1) + '×D2L', spec: 'A3', pos: [40,           y + off, floor], qty: 1 });
      J.push({ id: 'J' + (23 + i * 2), loc: 'D3#' + (i + 1) + '×D2R', spec: 'A3', pos: [outerW - 60,  y + off, floor], qty: 1 });
    });
    // D4×D3 (J32-36)：5 处十字，D4 与每根 D3 中点交汇
    d3Ys.forEach((y, i) => {
      J.push({ id: 'J' + (32 + i), loc: 'D4×D3#' + (i + 1), spec: 'A3', pos: [cx - 10, y, floor], qty: 1 });
    });
    // ===== U 卡扣连车点 (J42-45) — 4 点抱 OEM 导轨 =====
    // 位置：M1 底面（左 x=0–40 / 右 x=outerW-40），y 在 OEM 平直支撑段（D8 实测，前后各悬挑 ~150）。
    // ⚠️ zBot=35 仍是估算（D8 待办），实测后需校正 z 起点；y 同理（不同车 OEM 导轨节点位置略异，装配现场对位）。
    const usupY = [150 - 30, P.railLength - 150 - 30];  // 卡扣中心 y=150 / railLength-150，marker 长 60mm 居中偏 -30
    usupY.forEach((y, i) => {
      J.push({ id: 'J' + (42 + i * 2), loc: '左U卡扣' + (i ? '后' : '前') + '点(连车)', spec: 'U1', pos: [0,          y, 5], qty: 1 });
      J.push({ id: 'J' + (43 + i * 2), loc: '右U卡扣' + (i ? '后' : '前') + '点(连车)', spec: 'U1', pos: [outerW - 40, y, 5], qty: 1 });
    });
    // ===== 水箱 4 角压片 (J46-49) — A3 + 弹簧片压住水箱顶面凸缘 =====
    // ⚠️ 真实卡子规格待水箱定型校正：水箱可能自带凸缘螺孔/抓握耳，那时换 K1 为对应固定方案。
    // 简化暂用 A3+弹簧片，位置在水箱 4 角顶面 z=floor+tankH=185（水箱顶 z）。
    const tankXr = 40 + (outerW - 80) - 20, tankYr = 40 + (P.railLength / 2 - 80) - 20, tankTop = floor + P.tankH;
    J.push({ id: 'J46', loc: '水箱前左角压片', spec: 'K1', pos: [45,     45,     tankTop], qty: 1 });
    J.push({ id: 'J47', loc: '水箱前右角压片', spec: 'K1', pos: [tankXr, 45,     tankTop], qty: 1 });
    J.push({ id: 'J48', loc: '水箱后左角压片', spec: 'K1', pos: [45,     tankYr, tankTop], qty: 1 });
    J.push({ id: 'J49', loc: '水箱后右角压片', spec: 'K1', pos: [tankXr, tankYr, tankTop], qty: 1 });

    // ===== D22 电动接口 marker（J50-J57, 8 节点）=====
    // R1 滑轨自带螺孔拧 M2 T 槽（不另登记），K2 合页自带铆钉沿板外端整条（不另登记）
    // 位置随板移动用 slideX；几何细节见 docs/decisions.md D22
    const xcA = (outerW - panelW) / 2;
    const slideX = -P.deploy * P.panelTravel;
    const zPa1 = zBotTop + railFlatH;
    const zHinge = zPa1 + panelMainH;
    const paY = (P.railLength - panelL) / 2;
    // E0 ESP32 控制盒（水箱后方置物区上方，副驾角立柱内侧，z 在立柱内空间中部）
    J.push({ id: 'J50', loc: 'ESP32 控制盒',         spec: 'E0', pos: [outerW - 120,    900,                   zBotTop + 90],         qty: 1 });
    // E1 DC 电机（副驾侧 M1 后段顶面，y 在板 A 后端 1210 与 R1 后滑轨 1248 之间的 38mm 空隙内）
    J.push({ id: 'J51', loc: 'DC 减速电机(滑出)',    spec: 'E1', pos: [outerW - 40,     paY + panelL + 3,      zBotTop],              qty: 1 });
    // E2 GT2 同步带轮（前后 M2 顶面，副驾侧避开 C1 角立柱 x=980-1020）
    J.push({ id: 'J52', loc: 'GT2 同步轮(前)',        spec: 'E2', pos: [outerW - 130,    10,                    zBotTop],              qty: 1 });
    J.push({ id: 'J53', loc: 'GT2 同步轮(后驱动)',    spec: 'E2', pos: [outerW - 130,    P.railLength - 30,     zBotTop],              qty: 1 });
    // E3 电动推杆（沿 x 方向 250mm 长，铰接在板前端外侧 y=paY-30 即板 y 范围外）
    J.push({ id: 'J54', loc: '电动推杆(翻折)',         spec: 'E3', pos: [xcA + slideX + 10, paY - 30, zPa1],                              qty: 1 });
    // L1 限位开关 ×4：滑出 0/1m + 翻折 0°/180°
    J.push({ id: 'J55', loc: '限位 · 滑出收回',       spec: 'L1', pos: [outerW - 50,     P.railLength - 60,     zBotTop + railFlatH],  qty: 1 });
    J.push({ id: 'J56', loc: '限位 · 滑出全开',       spec: 'L1', pos: [5,               P.railLength - 60,     zBotTop + railFlatH],  qty: 1 });
    J.push({ id: 'J57', loc: '限位 · 翻折 0°/180°',  spec: 'L1', pos: [xcA + slideX - 15, paY - 12,           zHinge],               qty: 1 });

    return J;
  }

  // 按编号聚合 + 紧固件按节点精确累加（浏览器与 Node 共用）
  function computeBOM(parts) {
    const map = new Map();
    parts.forEach(p => {
      if (!map.has(p.code)) map.set(p.code, Object.assign({}, p, { qty: 0 }));
      map.get(p.code).qty++;
    });
    // 紧固件：扫每个 conn 件按其规格的 screws 累加（精确数，不再 ×1.6 估算）
    const fasteners = { B1: 0, B2: 0 };
    parts.filter(p => p.cat === 'conn').forEach(p => {
      const sp = JOINT_SPECS[p.code];
      if (sp && sp.screws) Object.entries(sp.screws).forEach(([k, v]) => { fasteners[k] = (fasteners[k] || 0) + v; });
    });
    // 不同节点数（按 joint id 去重）
    const jointSet = new Set();
    parts.filter(p => p.cat === 'conn' && p.joint).forEach(p => jointSet.add(p.joint));
    return { items: [...map.values()], fasteners, jointsCount: jointSet.size };
  }

  const api = { DEFAULTS, CONST: { P40, P20, panelW, panelL, zBot }, COLOR, CAT, JOINT_SPECS, FASTENERS, buildModel, buildJoints, computeBOM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoofModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
