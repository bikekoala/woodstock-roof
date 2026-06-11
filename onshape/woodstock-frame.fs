FeatureScript 2625;
import(path : "onshape/std/geometry.fs", version : "2625.0");

// ============================================================
// woodstock-roof Frame Generator (Onshape Custom Feature)
// 自动从 cad/model.js 生成（commit b3ccbba · 2026-06-11）
// ⚠️ 不要手改本文件 — 改 cad/model.js → commit → 自动重生成
//
// 用法（30 秒）：
//   1. Onshape Part Studio → 新建 Custom Feature（左上角 Feature Studio 图标）
//   2. 粘贴本文件全部内容
//   3. 右上 "Commit"
//   4. 回 Part Studio，工具栏点 "Woodstock Frame" 图标 → "Generate" → ✓
//   5. 36 个 Part 一次性出现（型材 + 板 + 水箱 + 滑轨/合页）
//
// 装配阶段：标准件（角码 + 螺丝 + T 螺母）从 McMaster-Carr 或 MISUMI VONA 拖入，
// 按 onshape/spec.md §3 Mate 表逐节点加约束。
// ============================================================

// 全部 36 个实体实例（坐标 mm；o=最小角点，s=包围盒尺寸）
export const PARTS = [
    { "code" : "M1", "cat" : "struct", "name" : "M1-1 底框纵梁", "profile" : 4040, "o" : [0, 0, 35], "s" : [40, 1300, 40] },
    { "code" : "M1", "cat" : "struct", "name" : "M1-2 底框纵梁", "profile" : 4040, "o" : [980, 0, 35], "s" : [40, 1300, 40] },
    { "code" : "M2", "cat" : "struct", "name" : "M2-1 底框横梁", "profile" : 4040, "o" : [40, 0, 35], "s" : [940, 40, 40] },
    { "code" : "M2", "cat" : "struct", "name" : "M2-2 底框横梁", "profile" : 4040, "o" : [40, 1260, 35], "s" : [940, 40, 40] },
    { "code" : "C1", "cat" : "struct", "name" : "C1-1 角立柱", "profile" : 4040, "o" : [0, 0, 75], "s" : [40, 40, 130] },
    { "code" : "C1", "cat" : "struct", "name" : "C1-2 角立柱", "profile" : 4040, "o" : [980, 0, 75], "s" : [40, 40, 130] },
    { "code" : "C1", "cat" : "struct", "name" : "C1-3 角立柱", "profile" : 4040, "o" : [0, 1260, 75], "s" : [40, 40, 130] },
    { "code" : "C1", "cat" : "struct", "name" : "C1-4 角立柱", "profile" : 4040, "o" : [980, 1260, 75], "s" : [40, 40, 130] },
    { "code" : "T1", "cat" : "struct", "name" : "T1-1 顶框纵梁", "profile" : 4040, "o" : [0, 0, 205], "s" : [40, 1300, 40] },
    { "code" : "T1", "cat" : "struct", "name" : "T1-2 顶框纵梁", "profile" : 4040, "o" : [980, 0, 205], "s" : [40, 1300, 40] },
    { "code" : "T2", "cat" : "struct", "name" : "T2-1 顶框横梁", "profile" : 2020, "o" : [40, 0, 225], "s" : [940, 20, 20] },
    { "code" : "T2", "cat" : "struct", "name" : "T2-2 顶框横梁", "profile" : 2020, "o" : [40, 1280, 225], "s" : [940, 20, 20] },
    { "code" : "T2", "cat" : "struct", "name" : "T2-3 顶框横梁", "profile" : 2020, "o" : [40, 640, 225], "s" : [940, 20, 20] },
    { "code" : "S1", "cat" : "struct", "name" : "S1-1 中央竖撑", "profile" : 2020, "o" : [500, 0, 75], "s" : [20, 20, 60] },
    { "code" : "S1", "cat" : "struct", "name" : "S1-2 中央竖撑", "profile" : 2020, "o" : [500, 1280, 75], "s" : [20, 20, 60] },
    { "code" : "S2", "cat" : "struct", "name" : "S2-1 中央吊撑", "profile" : 2020, "o" : [500, 640, 155], "s" : [20, 20, 70] },
    { "code" : "S3", "cat" : "struct", "name" : "S3-1 前后端中央立柱", "profile" : 2020, "o" : [500, 0, 155], "s" : [20, 20, 70] },
    { "code" : "S3", "cat" : "struct", "name" : "S3-2 前后端中央立柱", "profile" : 2020, "o" : [500, 1280, 155], "s" : [20, 20, 70] },
    { "code" : "D2", "cat" : "tray", "name" : "D2-1 托盘纵向边梁", "profile" : 2020, "o" : [20, 40, 135], "s" : [20, 1220, 20] },
    { "code" : "D2", "cat" : "tray", "name" : "D2-2 托盘纵向边梁", "profile" : 2020, "o" : [980, 40, 135], "s" : [20, 1220, 20] },
    { "code" : "D1", "cat" : "tray", "name" : "D1-1 托盘中段吊柱", "profile" : 2020, "o" : [20, 640, 155], "s" : [20, 20, 50] },
    { "code" : "D1", "cat" : "tray", "name" : "D1-2 托盘中段吊柱", "profile" : 2020, "o" : [980, 640, 155], "s" : [20, 20, 50] },
    { "code" : "D3", "cat" : "tray", "name" : "D3-1 托盘承托横档", "profile" : 2020, "o" : [40, 0, 135], "s" : [940, 20, 20] },
    { "code" : "D3", "cat" : "tray", "name" : "D3-2 托盘承托横档", "profile" : 2020, "o" : [40, 315, 135], "s" : [940, 20, 20] },
    { "code" : "D3", "cat" : "tray", "name" : "D3-3 托盘承托横档", "profile" : 2020, "o" : [40, 640, 135], "s" : [940, 20, 20] },
    { "code" : "D3", "cat" : "tray", "name" : "D3-4 托盘承托横档", "profile" : 2020, "o" : [40, 965, 135], "s" : [940, 20, 20] },
    { "code" : "D3", "cat" : "tray", "name" : "D3-5 托盘承托横档", "profile" : 2020, "o" : [40, 1280, 135], "s" : [940, 20, 20] },
    { "code" : "D4", "cat" : "tray", "name" : "D4-1 托盘中央纵梁", "profile" : 2020, "o" : [500, 0, 135], "s" : [20, 1300, 20] },
    { "code" : "R1", "cat" : "slide", "name" : "R1-1 扁装三节滑轨(前)", "profile" : 0, "o" : [10, 40, 75], "s" : [1000, 12, 27] },
    { "code" : "R1", "cat" : "slide", "name" : "R1-2 扁装三节滑轨(前)", "profile" : 0, "o" : [10, 1248, 75], "s" : [1000, 12, 27] },
    { "code" : "K2", "cat" : "slide", "name" : "K2-1 钢琴合页 SS304 1120mm", "profile" : 0, "o" : [7, 90, 108], "s" : [6, 1120, 3] },
    { "code" : "PC", "cat" : "panel", "name" : "PC 太阳能板C(下挂前抽)", "profile" : 0, "o" : [10, 0, 23], "s" : [1000, 1120, 6] },
    { "code" : "PA1", "cat" : "panel", "name" : "PA1 太阳能板A主板", "profile" : 0, "o" : [10, 90, 102], "s" : [1000, 1120, 6] },
    { "code" : "PA2", "cat" : "panel", "name" : "PA2 太阳能板A延展板", "profile" : 0, "o" : [10, 90, 111], "s" : [1000, 1120, 8] },
    { "code" : "PT", "cat" : "panel", "name" : "PT 顶板(固定)", "profile" : 0, "o" : [10, 40, 245], "s" : [1000, 590, 6] },
    { "code" : "WT", "cat" : "tank", "name" : "WT 扁平水箱", "profile" : 0, "o" : [40, 40, 155], "s" : [940, 570, 50] }
];

annotation { "Feature Type Name" : "Woodstock Frame" }
export const woodstockFrame = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Generate all 36 parts" }
        definition.confirmGenerate is boolean;
    }
    {
        if (!definition.confirmGenerate)
            return;
        // 全部用 createBoxPart 保证位置 100% 正确（绝对坐标 sketch on XY + extrude +z）
        // 4040/2020 T 槽视觉是另一回事，等位置确认对了再加（见 docs/onshape/todo-tslot.md）
        for (var i = 0; i < size(PARTS); i += 1)
        {
            createBoxPart(context, id + ("p" ~ i), PARTS[i]);
        }
    });

// ============================================================
// 真 T 槽铝型材生成器（MISUMI HFS5 系列参考尺寸）
// 4040：边长 40，T 槽外口 7mm，槽深 6mm，4 面各一道纵向 T 槽
// 2020：边长 20，T 槽外口 5mm，槽深 4mm
// 简化：用矩形凹槽近似真 T 槽内腔（视觉接近，能看到"螺丝孔"）
// ============================================================
function tslotPolyline(S is number, W is number, D is number) returns array
{
    // 截面 polyline 顶点（从原点起，沿外形 + 4 道矩形凹槽逆时针走一圈，单位 mm）
    // body 后续会用 opTransform 平移/旋转到目标位置
    return [
        // 底边 + 底面凹槽
        [0,         0],
        [S/2 - W/2, 0],
        [S/2 - W/2, D],
        [S/2 + W/2, D],
        [S/2 + W/2, 0],
        [S,         0],
        // 右边 + 右面凹槽
        [S,         S/2 - W/2],
        [S - D,     S/2 - W/2],
        [S - D,     S/2 + W/2],
        [S,         S/2 + W/2],
        [S,         S],
        // 顶边 + 顶面凹槽
        [S/2 + W/2, S],
        [S/2 + W/2, S - D],
        [S/2 - W/2, S - D],
        [S/2 - W/2, S],
        [0,         S],
        // 左边 + 左面凹槽
        [0,         S/2 + W/2],
        [D,         S/2 + W/2],
        [D,         S/2 - W/2],
        [0,         S/2 - W/2]
    ];
}

function createAluBeam(context is Context, id is Id, part is map)
{
    var o = part.o;
    var s = part.s;
    var prof = part.profile;
    var S = prof == 4040 ? 40 : 20;
    var W = prof == 4040 ? 7  : 5;
    var D = prof == 4040 ? 6  : 4;

    // 找型材长度方向（最大维度）
    var lengthAxis = 0;
    if (s[1] > s[lengthAxis]) lengthAxis = 1;
    if (s[2] > s[lengthAxis]) lengthAxis = 2;
    var depth = s[lengthAxis];

    // 1. 在世界 XY 平面原点画 T 槽截面（避免 sketch 平面 orientation 歧义）
    var sketchPlane = plane(vector(0, 0, 0) * meter, vector(0, 0, 1));
    var sk = newSketchOnPlane(context, id + "section", { "sketchPlane" : sketchPlane });
    var pts = tslotPolyline(S, W, D);
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

    // 2. Extrude 沿 +Z，得到 body 在原点：(0,0,0)-(S,S,depth)，长度方向 = +Z
    opExtrude(context, id + "extrude", {
        "entities"  : qSketchRegion(id + "section"),
        "direction" : vector(0, 0, 1),
        "endBound"  : BoundingType.BLIND,
        "endDepth"  : depth * millimeter
    });

    // 3. opTransform：通过 coordSystem 把 body 从原点旋转 + 平移到 (o, 沿 lengthAxis)
    //    coordSystem(origin, xAxis, yAxis) 自动算 zAxis = xAxis × yAxis = 目标长度方向
    var origVec = vector(o[0], o[1], o[2]) * millimeter;
    var cs;
    if (lengthAxis == 2) {
        // 沿 +Z：local = world，只平移
        cs = coordSystem(origVec, vector(1, 0, 0), vector(0, 1, 0));
    } else if (lengthAxis == 1) {
        // 沿 +Y：cs.zAxis = (0,1,0) → 选 xAxis=(0,0,1), yAxis=(1,0,0)
        cs = coordSystem(origVec, vector(0, 0, 1), vector(1, 0, 0));
    } else {
        // 沿 +X：cs.zAxis = (1,0,0) → 选 xAxis=(0,1,0), yAxis=(0,0,1)
        cs = coordSystem(origVec, vector(0, 1, 0), vector(0, 0, 1));
    }

    opTransform(context, id + "xform", {
        "bodies"    : qCreatedBy(id + "extrude", EntityType.BODY),
        "transform" : toWorld(cs)
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
