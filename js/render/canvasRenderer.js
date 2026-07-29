/* Canvas 座位图渲染
   处理 DPR 缩放、座位坐标计算、银幕/过道/排号标注、座位绘制。
   状态从 SeatData / HallConfig / CinemaApp 取。
*/

const CanvasRenderer = (() => {
  const A = () => window.CinemaApp;
  const getCss = x => getComputedStyle(document.body).getPropertyValue(x).trim();
  const isLargeText = () => document.body.classList.contains('large-text');

  // DPR 自适应 + 重绘座位图 & 热度图
  function resize() {
    const d = devicePixelRatio || 1;
    const app = A();

    // 座位 Canvas
    const seatCanvas = app.canvas;
    const ctx = app.ctx;
    if (seatCanvas && ctx) {
      const r = seatCanvas.getBoundingClientRect();
      seatCanvas.width  = r.width * d;
      seatCanvas.height = r.height * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      drawSeats();
    }

    // 热度 Canvas
    const hCanvas = app.heatCanvas;
    const hctx = app.hctx;
    if (hCanvas && hctx) {
      const hr = hCanvas.getBoundingClientRect();
      hCanvas.width  = hr.width * d;
      hCanvas.height = hr.height * d;
      hctx.setTransform(d, 0, 0, d, 0, 0);
      if (typeof HeatmapEngine !== 'undefined') HeatmapEngine.draw();
    }
  }

  // 重新生成座位数组（基于 HallConfig + LocalStorage 已售数据）
  function makeSeats() {
    const hall = HallConfig.get();

    // 通过 SeatData 重建（保持单一事实来源，已售数据由 SeatData 内部读取）
    SeatData.build(hall.key);
    SeatData.clearSelection();

    // 触发更新
    if (typeof updateOrder === 'function') updateOrder();
    if (typeof EventBus !== 'undefined') EventBus.emit('seats:changed');
  }

  // 算每个座位在 Canvas 上的坐标。
  // 弧形排列：越靠两侧的座位越往前移（像真实影院以银幕为圆心呈弧形），
  // 弧度由 hall.curve 控制，标准厅 12，IMAX 厅 30（弯得更明显）。
  function seatGeometry(seatArr, H, w, h) {
    const margin = w < 560 ? 42 : 60;
    const baseY = 48;
    const rowGap = (h - 96) / (H.rows - 1 || 1);
    const aisleUnits = 1.35;
    const groups = H.groups || [H.cols];
    const curve = H.curve || 12;
    const boundaries = [];
    groups.slice(0, -1).reduce((sum, size) => {
      boundaries.push(sum + size);
      return sum + size;
    }, 0);
    const slots = H.cols - 1 + boundaries.length * aisleUnits;
    // 列数越多整体越窄一点，留出两边排号空间
    const widthScale = H.cols <= 10 ? 0.68 : H.cols <= 20 ? 0.82 : 0.94;
    const gap = ((w - margin * 2) * widthScale) / (slots || 1);
    seatArr.forEach(s => {
      const passedAisles = boundaries.filter(b => s.col > b).length;
      const localX = (s.col - 1 + passedAisles * aisleUnits - slots / 2) * gap;
      const normalizedX = localX / ((w - margin * 2) / 2 || 1);
      s.x = w / 2 + localX;
      // 弧形：两侧座位往前抬，幅度随 curve 变化
      s.y = baseY + (s.row - 1) * rowGap - Math.pow(normalizedX, 2) * curve;
      const baseRadius = Math.max(5, Math.min(12, gap * 0.36, rowGap * 0.3));
      s.r = isLargeText() ? Math.min(baseRadius + 2, 15) : baseRadius;
    });
    return { boundaries };
  }

  // 绘制中轴线 + 过道虚线 + 两侧排号
  function drawHallGuides(meta, H, w, h) {
    const ctx = A().ctx;
    if (!ctx) return;
    const seats = SeatData.all();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = '#7f8da33f';

    ctx.beginPath();
    ctx.moveTo(w / 2, 18);
    ctx.lineTo(w / 2, h - 26);
    ctx.stroke();

    meta.boundaries.forEach(boundary => {
      const left = seats.find(s => s.row === Math.ceil(H.rows / 2) && s.col === boundary);
      const right = seats.find(s => s.row === Math.ceil(H.rows / 2) && s.col === boundary + 1);
      if (!left || !right) return;
      const aisleX = (left.x + right.x) / 2;
      ctx.beginPath();
      ctx.moveTo(aisleX, 28);
      ctx.lineTo(aisleX, h - 24);
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.fillStyle = '#65738c';
    ctx.font = `${isLargeText() ? 15 : 10}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 1; row <= H.rows; row++) {
      const rowSeats = seats.filter(s => s.row === row);
      if (!rowSeats.length) continue;
      ctx.fillText(`${row}排`, 20, rowSeats[0].y);
      ctx.fillText(`${row}排`, w - 20, rowSeats[rowSeats.length - 1].y);
    }
    ctx.restore();
  }

  // 绘制座位图主循环
  function drawSeats() {
    const app = A();
    const ctx = app.ctx;
    const canvas = app.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(app.offsetX, app.offsetY);
    ctx.scale(app.scale, app.scale);

    const hall = HallConfig.get();
    const seats = SeatData.all();
    const selected = SeatData.selected();
    const recommended = SeatData.recommended();
    // 别的标签页正在选的座位（多人在线）
    const peerLocked = (typeof RealtimeSync !== 'undefined') ? RealtimeSync.peerLockedSeats(hall.key) : new Set();
    const geometry = seatGeometry(seats, hall, w, h);
    drawHallGuides(geometry, hall, w, h);
    ctx.font = `${isLargeText() ? (hall.cols > 20 ? 11 : 13) : (hall.cols > 20 ? 7 : 9)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    seats.forEach(s => {
      const isRecommended = recommended.has(s.id);
      const isSelected = selected.has(s.id);
      const isPeerLocked = peerLocked.has(s.id);
      let c;
      // 推荐座位也属于已选座位，必须先于 selected 判断，否则推荐紫色不会出现。
      if (s.sold)                  c = getCss('--red');
      else if (isRecommended)     c = getCss('--purple');
      else if (isSelected)        c = getCss('--yellow');
      else if (isPeerLocked)      c = '#ff8a3d';   // 他人正在选
      else                         c = getCss('--green');

      ctx.save();
      ctx.fillStyle = c;
      ctx.globalAlpha = s.sold ? 0.82 : 1;
      if (isRecommended) {
        ctx.shadowColor = c;
        ctx.shadowBlur = 9;
      }
      roundRect(ctx, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, Math.max(2, s.r * 0.35));
      ctx.fill();

      // 除颜色外再用描边区分，保证高对比度和色盲模式下也容易辨认。
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (s.sold || isRecommended || isSelected || isPeerLocked) {
        ctx.strokeStyle = s.sold ? '#d7dce5'
          : isRecommended ? '#ffffff'
          : isSelected ? '#7a4b00'
          : '#ffffff';
        ctx.lineWidth = isRecommended ? 2.2 : 1.4;
        roundRect(ctx, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, Math.max(2, s.r * 0.35));
        ctx.stroke();
      }

      if (s.r > 8) {
        ctx.fillStyle = (s.sold || isRecommended || isPeerLocked) ? '#fff' : '#071017';
        ctx.fillText(s.sold ? '×' : isRecommended ? '★' : s.col, s.x, s.y + 0.5);
      }
      ctx.restore();
    });

    ctx.globalAlpha = 1;

    // 拖拽框选矩形
    const ptr = app.pointer;
    if (ptr && ptr.box) {
      ctx.strokeStyle = getCss('--cyan');
      ctx.fillStyle   = '#65e7ff20';
      ctx.lineWidth   = 1.5;
      const b = InteractionLayer.box(ptr.start, ptr.now);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    ctx.restore();
  }

  // 兼容无 roundRect 的浏览器
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); } else { c.rect(x, y, w, h); }
  }

  return { resize, makeSeats, seatGeometry, drawSeats, roundRect, getCss };
})();
window.CanvasRenderer = CanvasRenderer;
