/* === 订单面板 UI ===
   处理选座展示、预订/购票/取消操作、订单列表渲染。
*/

const OrderPanel = (() => {
  function _el(id) { return document.getElementById(id); }

  /** 获取当前登录用户信息 */
  function _session() {
    const key = window.CinemaConfig.storageKeys.session;
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }

  /** 刷新侧栏：已选列表 + 价格 */
  function refreshSelection() {
    const count = SeatData.selectedCount();
    const listEl = _el('selectedList');
    const priceEl = _el('totalPrice');

    if (listEl) {
      listEl.textContent = count > 0 ? SeatData.labelSeats() : '尚未选择座位';
    }
    if (priceEl) {
      priceEl.textContent = count * window.CinemaConfig.pricePerSeat;
    }
  }

  /** 提交订单 */
  function submitOrder(status) {
    const session = _session();
    if (!session) return false;

    const selected = [...SeatData.selected()];
    if (selected.length === 0) return false;

    const hall = HallConfig.get();
    const order = OrderStorage.create({
      userId: session.name,
      hall: hall.key,
      hallName: hall.name,
      seatIds: selected,
      status,
    });

    // 如果购票，重载座位以标记已售
    if (status === '已购票') {
      SeatData.build(hall.key);
    }

    SeatData.clearSelection();
    EventBus.emit('order:created', order);
    EventBus.emit('seats:changed');
    return order;
  }

  /** 取消订单 */
  function cancelOrder(orderId) {
    const result = OrderStorage.cancel(orderId);
    if (!result) return;

    // 座位状态需要重载
    if (result.status === '已退票' || result.status === '已取消') {
      SeatData.build(HallConfig.get().key);
    }
    EventBus.emit('order:cancelled', result);
    EventBus.emit('seats:changed');
  }

  /** 渲染订单列表到 #orderList */
  function renderOrderList() {
    const session = _session();
    const listEl = _el('orderList');
    if (!listEl) return;

    const orders = OrderStorage.filterByUser(
      session?.name || '',
      session?.role || 'user'
    );

    if (orders.length === 0) {
      listEl.innerHTML = '<div class="sub">暂无订单，完成一次选座后订单会出现在这里。</div>';
      return;
    }

    listEl.innerHTML = orders.map(o => {
      const label = o.seats
        .sort((a, b) => { const [x, y] = a.split('-').map(Number); const [m, n] = b.split('-').map(Number); return x - m || y - n; })
        .map(x => { const [r, c] = x.split('-'); return `${r}排${c}座`; })
        .join('、');
      const canCancel = ['已预订', '已购票'].includes(o.status);

      return `<div class="order">
        <div><b>${o.hallName}</b><div class="sub">${label}</div></div>
        <div>${o.time}</div>
        <div class="pill">${o.status}</div>
        <div>¥${o.amount}</div>
        ${canCancel ? `<button data-order-id="${o.id}">${o.status === '已购票' ? '退票' : '取消预订'}</button>` : '<span></span>'}
      </div>`;
    });

    // 绑定取消按钮
    listEl.querySelectorAll('button[data-order-id]').forEach(btn => {
      btn.addEventListener('click', () => cancelOrder(btn.dataset.orderId));
    });
  }

  return {
    refreshSelection,
    submitOrder,
    cancelOrder,
    renderOrderList,
  };
})();
