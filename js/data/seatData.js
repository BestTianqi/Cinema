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

  function all() { return _seats; }
  function selected() { return new Set(_selected); }
  function recommended() { return new Set(_recommended); }

  function toggle(id) {
    if (_selected.has(id)) { _selected.delete(id); _recommended.delete(id); }
    else { _selected.add(id); }
  }
  function selectBatch(ids) { ids.forEach(id => _selected.add(id)); }
  function clearSelection() { _selected.clear(); _recommended.clear(); }
  function setRecommended(ids) {
    _recommended = new Set(ids);
    _selected.clear();
    ids.forEach(id => _selected.add(id));
  }
  function selectedCount() { return _selected.size; }

  return { build, all, selected, recommended, toggle, selectBatch, clearSelection, setRecommended, selectedCount };
})();
