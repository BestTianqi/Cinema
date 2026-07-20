/* === 订单数据持久化（LocalStorage CRUD） === */

const OrderStorage = (() => {
  const _keys = () => window.CinemaConfig.storageKeys;

  // ---- 底层读写 ----
  function _read(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function _write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.error('[OrderStorage] write failed:', e); return false; }
  }

  // ---- 订单 CRUD ----
  function allOrders() {
    return _read(_keys().orders, []);
  }

  function create({ userId, hall, hallName, seatIds, status, payMethod = '' }) {
    const order = {
      id: 'SC' + Date.now().toString().slice(-9),
      user: userId,
      hall,
      hallName,
      seats: [...seatIds],
      status,           // "已预订" | "已购票"
      payMethod,
      amount: seatIds.length * window.CinemaConfig.pricePerSeat,
      time: new Date().toLocaleString(),
    };
    const list = allOrders();
    list.unshift(order);
    _write(_keys().orders, list);

    // 如果购票，标记座位为已售
    if (status === '已购票') _markSold(hall, seatIds);
    return order;
  }

  function cancel(orderId) {
    const list = allOrders();
    const order = list.find(o => o.id === orderId);
    if (!order) return null;

    if (order.status === '已购票') {
      // 退票 → 释放座位
      _releaseSold(order.hall, order.seats);
      order.status = '已退票';
    } else {
      order.status = '已取消';
    }
    _write(_keys().orders, list);
    return order;
  }

  function filterByUser(userName, role) {
    const list = allOrders();
    return role === 'admin' ? list : list.filter(o => o.user === userName);
  }

  // ---- 已售座位管理 ----
  function _soldMap() { return _read(_keys().sold, {}); }

  function allSold() {
    const sm = _soldMap();
    return Object.values(sm).reduce((n, arr) => n + arr.length, 0);
  }

  function soldForHall(hallKey) {
    return _soldMap()[hallKey] || [];
  }

  function _markSold(hallKey, seatIds) {
    const sm = _soldMap();
    sm[hallKey] = [...new Set([...(sm[hallKey] || []), ...seatIds])];
    _write(_keys().sold, sm);
  }

  function _releaseSold(hallKey, seatIds) {
    const sm = _soldMap();
    const current = sm[hallKey] || [];
    const removeSet = new Set(seatIds);
    sm[hallKey] = current.filter(id => !removeSet.has(id));
    _write(_keys().sold, sm);
  }

  /** 清空所有订单和售座数据 */
  function resetAll() {
    _write(_keys().orders, []);
    _write(_keys().sold, {});
  }

  /** 统计有效订单数 */
  function activeCount() {
    return allOrders().filter(o => !['已取消', '已退票'].includes(o.status)).length;
  }

  return {
    allOrders, create, cancel, filterByUser,
    allSold, soldForHall,
    resetAll, activeCount,
  };
})();
