/* === 座位状态管理（单一事实来源） ===
   所有座位状态在此集中管理，外部模块通过 EventBus 感知变化。
*/

const SeatData = (() => {
  let _seats = [];          // 座位数组 [{id, row, col, sold, x, y, r}]
  let _selected = new Set();   // 用户选中的座位 id
  let _recommended = new Set();// 系统推荐的座位 id

  /** 从 LocalStorage 读取已售座位 */
  function _soldMap() {
    const cfg = window.CinemaConfig.storageKeys;
    try { return JSON.parse(localStorage.getItem(cfg.sold)) ?? {}; }
    catch { return {}; }
  }

  /** 生成座位数据 */
  function build(hallKey) {
    const h = window.CinemaConfig.halls[hallKey];
    const sold = _soldMap()[hallKey] || [];
    const soldSet = new Set(sold);

    _seats = [];
    for (let row = 1; row <= h.rows; row++) {
      for (let col = 1; col <= h.cols; col++) {
        _seats.push({
          id: `${row}-${col}`,
          row,
          col,
          sold: soldSet.has(`${row}-${col}`),
          x: 0, y: 0, r: 0,   // Canvas 坐标（由 render 层填充）
        });
      }
    }
    _selected.clear();
    _recommended.clear();
  }

  /** 计算座位 Canvas 坐标 */
  function calcGeometry(canvasW, canvasH, hallKey) {
    const h = window.CinemaConfig.halls[hallKey];
    const margin = h.cols > 20 ? 34 : 56;
    const gap = (canvasW - margin * 2) / (h.cols - 1 || 1);
    const baseY = 48;
    const rowGap = (canvasH - 92) / (h.rows - 1 || 1);
    const size = Math.max(5, Math.min(13, gap * 0.32));
    const center = (h.cols + 1) / 2;

    _seats.forEach(s => {
      const curve = Math.pow((s.col - center) / (h.cols / 2), 2) * 24;
      s.x = margin + (s.col - 1) * gap;
      s.y = baseY + (s.row - 1) * rowGap + curve;
      s.r = size;
    });
  }

  /** 所有座位（只读副本） */
  function all() { return _seats; }

  /** 当前选中的 id */
  function selected() { return new Set(_selected); }

  /** 推荐座位 id */
  function recommended() { return new Set(_recommended); }

  /** 选中/取消单个座位 */
  function toggle(id) {
    if (_selected.has(id)) {
      _selected.delete(id);
      _recommended.delete(id);
    } else {
      _selected.add(id);
    }
  }

  /** 批量选中 */
  function selectBatch(ids) {
    ids.forEach(id => _selected.add(id));
  }

  /** 清空选择 */
  function clearSelection() {
    _selected.clear();
    _recommended.clear();
  }

  /** 设置推荐座位 */
  function setRecommended(ids) {
    _recommended = new Set(ids);
    _selected.clear();
    ids.forEach(id => _selected.add(id));
  }

  /** 已选座位数 */
  function selectedCount() { return _selected.size; }

  /** 已选座位排序列号字符串 */
  function labelSeats() {
    return [..._selected]
      .sort((a, b) => {
        const [r1, c1] = a.split('-').map(Number);
        const [r2, c2] = b.split('-').map(Number);
        return r1 - r2 || c1 - c2;
      })
      .map(x => { const [r, c] = x.split('-'); return `${r}排${c}座`; })
      .join('、');
  }

  /** 计算已选座位的平均行列 */
  function avgPosition() {
    if (_selected.size === 0) return { row: 0, col: 0 };
    const ss = _seats.filter(s => _selected.has(s.id));
    return {
      row: ss.reduce((a, s) => a + s.row, 0) / ss.length,
      col: ss.reduce((a, s) => a + s.col, 0) / ss.length,
    };
  }

  /** 统计每个已选座位周围已售座位数 */
  function countNearbySold(seatId, radius) {
    const seat = _seats.find(s => s.id === seatId);
    if (!seat) return 0;
    return _seats.filter(o =>
      o.sold &&
      Math.abs(o.row - seat.row) <= radius &&
      Math.abs(o.col - seat.col) <= radius
    ).length;
  }

  return {
    build, calcGeometry,
    all, selected, recommended,
    toggle, selectBatch, clearSelection, setRecommended,
    selectedCount, labelSeats,
    avgPosition, countNearbySold,
  };
})();
