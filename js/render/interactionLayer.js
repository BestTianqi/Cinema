/* === 交互层：指针/触摸事件处理 ===
   处理座位点击（单选/多选）、拖拽框选、画布平移、滚轮缩放。
*/

const InteractionLayer = (() => {
  const A = () => window.CinemaApp;

  function init(canvas) {
    if (!canvas) return;

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      const p = point(e);
      const s = hit(p);
      const app = A();

      if (app.dragSelect && !s) {
        app.pointer = { box: true, start: p, now: p };
      } else if (e.button === 1 || (!s && !app.dragSelect)) {
        app.pointer = {
          pan: true,
          start:  { x: e.clientX, y: e.clientY },
          origin: { x: app.offsetX,  y: app.offsetY },
        };
      } else if (s && s.sold) {
        app.toast('该座位已售出，请选择其他座位');
      } else if (s && typeof RealtimeSync !== 'undefined' &&
                 RealtimeSync.peerLockedSeats(HallConfig.get().key).has(s.id)) {
        // 别的标签页正在选这个座，避免冲突
        app.toast('该座位正被其他用户选中');
      } else if (s) {
        const wasSelected = SeatData.selected().has(s.id);
        if (!e.ctrlKey && !e.metaKey) SeatData.clearSelection();
        SeatData.toggle(s.id);
        EventBus.emit('seats:changed');
        EventBus.emit('canvas:redraw');
        const label = `${s.row}排${s.col}座`;
        const count = SeatData.selectedCount();
        const action = wasSelected ? '已取消' : '已选择';
        app.toast(`${action}${label}，当前共选择 ${count} 个座位`);
      }
    });

    canvas.addEventListener('pointermove', e => {
      const app = A();
      if (!app.pointer) return;
      if (app.pointer.box) { app.pointer.now = point(e); }
      if (app.pointer.pan) {
        app.offsetX = app.pointer.origin.x + e.clientX - app.pointer.start.x;
        app.offsetY = app.pointer.origin.y + e.clientY - app.pointer.start.y;
      }
      EventBus.emit('canvas:redraw');
    });

    canvas.addEventListener('pointerup', () => {
      const app = A();
      const seats = SeatData.all();
      if (app.pointer && app.pointer.box) {
        const b = box(app.pointer.start, app.pointer.now);
        const ids = seats
          .filter(s => !s.sold && s.x >= b.x && s.x <= b.x + b.w && s.y >= b.y && s.y <= b.y + b.h)
          .map(s => s.id);
        if (ids.length) {
          SeatData.selectBatch(ids);
          EventBus.emit('seats:changed');
          A().toast(`已框选 ${ids.length} 个可用座位，当前共选择 ${SeatData.selectedCount()} 个座位`);
        } else {
          A().toast('框选区域内没有可选座位');
        }
      }
      app.pointer = null;
      EventBus.emit('canvas:redraw');
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const app = A();
      app.scale = Math.max(0.65, Math.min(2.1, app.scale + (e.deltaY < 0 ? 0.1 : -0.1)));
      EventBus.emit('canvas:redraw');
    }, { passive: false });
  }

  /** 鼠标/触摸坐标 → Canvas 逻辑坐标 */
  function point(e) {
    const app = A();
    const c = app.canvas;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - app.offsetX) / app.scale,
      y: (e.clientY - rect.top  - app.offsetY) / app.scale,
    };
  }

  /** 碰撞检测 */
  function hit(p) {
    return SeatData.all().find(s =>
      Math.abs(s.x - p.x) <= s.r + 3 && Math.abs(s.y - p.y) <= s.r + 3
    );
  }

  /** 矩形坐标归一化 */
  function box(a, b) {
    return {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y),
    };
  }

  return { init, point, hit, box };
})();
window.InteractionLayer = InteractionLayer;
