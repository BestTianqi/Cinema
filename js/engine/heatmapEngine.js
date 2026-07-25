/* === 热度地图引擎 ===
   Canvas 热度图层，基于用户选座行为累积的数据渲染热力分布。
   红=热门，黄=一般，绿=冷门。
*/

const HeatmapEngine = (() => {
  const A = () => window.CinemaApp;

  /** 热度数据（模拟：基于座位位置 + 星期 + 已售率生成伪热力值） */
  function _heatData() {
    const app = A();
    const hall = app.heatHall;
    const H = window.CinemaConfig.halls[hall];
    const sold = app.soldMap()[hall] || [];
    const soldSet = new Set(sold);
    const soldRate = Math.min(1, sold.length / (H.rows * H.cols));
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const dayFactor = 0.5 + app.heatDay * 0.08;

    const data = [];
    for (let row = 1; row <= H.rows; row++) {
      for (let col = 1; col <= H.cols; col++) {
        const centerCol = (H.cols + 1) / 2;
        const centerRow = H.rows * 0.5;
        const distToCenter = Math.sqrt(Math.pow(col - centerCol, 2) + Math.pow(row - centerRow, 2));
        const centerScore = Math.max(0, 1 - distToCenter / Math.max(H.cols, H.rows));
        const soldBonus = soldSet.has(`${row}-${col}`) ? 0.4 : 0;
        const heat = Math.min(1, (centerScore * 0.5 + dayFactor * 0.3 + soldRate * 0.3 + soldBonus));
        data.push({ row, col, heat });
      }
    }
    return { data, H, dayNames };
  }

  function draw() {
    const app = A();
    const canvas = app.heatCanvas;
    const ctx = app.hctx;
    if (!canvas || !ctx) return;

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const { data, H, dayNames } = _heatData();
    const temp = data.map(d => ({ ...d, sold: false, x: 0, y: 0, r: 0 }));
    CanvasRenderer.seatGeometry(temp, H, w, h - 30);

    temp.forEach(s => {
      const t = s.heat;
      // 红(热) → 黄(中) → 绿(冷) 渐变
      const r = Math.round(220 + t * 35);
      const g = Math.round(50 + t * 130);
      const b = Math.round(40 + (1 - t) * 30);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.globalAlpha = 0.5 + t * 0.45;
      CanvasRenderer.roundRect(ctx, s.x - s.r, s.y + 30 - s.r, s.r * 2, s.r * 2, 3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 标注
    ctx.fillStyle = '#94a0b8';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${H.name}热度分布 — ${dayNames[app.heatDay]}`, w / 2, 18);
  }

  function buildWeek() {
    const app = A();
    const week = document.getElementById('week');
    if (!week) return;

    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
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

  return { draw, buildWeek };
})();
window.HeatmapEngine = HeatmapEngine;
