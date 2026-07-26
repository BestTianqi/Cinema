/* 热度地图引擎
   用 Canvas 把影厅里每个座位的"受欢迎程度"画出来，红=热门、黄=一般、蓝=冷门。
   热度不是随便给的，综合考虑了几个因素：
     1. 黄金区：中后排+居中是大家最爱坐的位置（高斯分布模拟）
     2. 走道两侧：方便进出，略加分
     3. 时间因素：周末整体更热，工作日偏冷；同一天里晚上比白天热
     4. 已售情况：已经被订走的座位本身热度更高（真实选座反馈）
   可以按周一到周日切换看一周变化。
*/

const HeatmapEngine = (() => {
  const A = () => window.CinemaApp;

  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 高斯函数，越靠近中心值越接近1
  function gauss(x, mean, sigma) {
    return Math.exp(-((x - mean) ** 2) / (2 * sigma * sigma));
  }

  // 算单个座位的热度（0~1）
  function seatHeat(row, col, H, dayIdx, soldSet, soldRate) {
    const centerCol = (H.cols + 1) / 2;

    // 黄金排：影厅总排数的一半偏后一点（一般是第5-7排最抢手）
    const goldenRow = H.rows * 0.55;
    // 列方向的集中度比排数更强（大家更在意左右居中）
    const rowScore = gauss(row, goldenRow, H.rows * 0.32);
    const colScore = gauss(col, centerCol, H.cols * 0.22);
    const golden = rowScore * 0.45 + colScore * 0.55;

    // 时间因素：周末(周六周日=5,6)热度整体上浮，工作日偏低
    // dayIdx: 0=周一 ... 6=周日
    const isWeekend = dayIdx >= 5;
    const timeBoost = isWeekend ? 0.22 : 0.06 + dayIdx * 0.012;

    // 走道两侧略加分（groups 把每排分成几段，段边界附近是走道）
    const groups = H.groups || [H.cols];
    let nearAisle = 0;
    let acc = 0;
    for (const g of groups) {
      if (Math.abs(col - (acc + 1)) <= 1 || Math.abs(col - (acc + g)) <= 1) nearAisle = 0.08;
      acc += g;
    }

    // 已经售出的座位本身就更热（真实反馈）
    const soldBonus = soldSet.has(`${row}-${col}`) ? 0.25 : 0;
    // 整体售出率拉高所有座位的基础热度
    const rateBoost = soldRate * 0.18;

    const heat = Math.min(1, golden * 0.6 + timeBoost + nearAisle + soldBonus + rateBoost);
    return heat;
  }

  // 把 0~1 的热度值映射成颜色，走 蓝→青→黄→红 的连续渐变
  // 用 HSL 插值比直接算 RGB 平滑得多
  function heatColor(t) {
    // t=0 蓝(240°) → t=0.5 黄(55°) → t=1 红(0°)
    // 用两段线性插值，绕过紫色那段
    let hue;
    if (t < 0.5) {
      // 240° → 55°
      hue = 240 - (240 - 55) * (t / 0.5);
    } else {
      // 55° → 0°
      hue = 55 - 55 * ((t - 0.5) / 0.5);
    }
    const sat = 70 + t * 20;   // 越热越饱和
    const light = 45 + (1 - t) * 15; // 冷色稍亮一点便于看清
    return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
  }

  // 取当前影厅+日期的热度数据
  function _heatData() {
    const app = A();
    const hall = app.heatHall;
    const H = window.CinemaConfig.halls[hall];
    const sold = app.soldMap()[hall] || [];
    const soldSet = new Set(sold);
    const soldRate = Math.min(1, sold.length / (H.rows * H.cols));

    const data = [];
    for (let row = 1; row <= H.rows; row++) {
      for (let col = 1; col <= H.cols; col++) {
        data.push({ row, col, heat: seatHeat(row, col, H, app.heatDay, soldSet, soldRate) });
      }
    }
    return { data, H };
  }

  function draw() {
    const app = A();
    const canvas = app.heatCanvas;
    const ctx = app.hctx;
    if (!canvas || !ctx) return;

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const { data, H } = _heatData();
    // 借用主图的座位几何算位置
    const temp = data.map(d => ({ ...d, x: 0, y: 0, r: 0 }));
    CanvasRenderer.seatGeometry(temp, H, w, h - 30);

    // 先画一层座位底色（按热度）
    temp.forEach(s => {
      ctx.fillStyle = heatColor(s.heat);
      ctx.globalAlpha = 0.55 + s.heat * 0.4;
      CanvasRenderer.roundRect(ctx, s.x - s.r, s.y + 30 - s.r, s.r * 2, s.r * 2, Math.max(2, s.r * 0.35));
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 标题 + 当前查看的日期
    ctx.fillStyle = '#94a0b8';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    const isWeekend = app.heatDay >= 5;
    ctx.fillText(`${H.name} 热度分布 · ${dayNames[app.heatDay]}${isWeekend ? '（周末场，整体偏热）' : ''}`, w / 2, 18);
  }

  // 生成年内一周的日期选择按钮
  function buildWeek() {
    const app = A();
    const week = document.getElementById('week');
    if (!week) return;

    week.innerHTML = dayNames.map((d, i) =>
      `<button class="${i === app.heatDay ? 'active' : ''}" data-day="${i}">${d}</button>`
    ).join('');

    week.querySelectorAll('button').forEach(b =>
      b.onclick = () => {
        app.heatDay = +b.dataset.day;
        buildWeek();
        draw();
      }
    );
  }

  return { draw, buildWeek, seatHeat, heatColor };
})();
window.HeatmapEngine = HeatmapEngine;
