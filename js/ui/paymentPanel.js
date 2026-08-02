/* === 支付与订单面板 ===
   处理创建订单、支付弹窗、二维码、确认/取消支付、退票、订单列表。
*/

const PaymentPanel = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);

  function _requireLogin() {
    if (A().user()) return true;
    AuthPanel.openAuth();
    A().toast('请先登录');
    return false;
  }

  /** 返回指定影厅中已经被购买或预订的座位 */
  function _findUnavailableSeats(hallKey, seats) {
    const sold = new Set(A().soldMap()[hallKey] || []);
    return seats.filter(id => sold.has(id));
  }

  /** 占用座位；用于预订或支付成功时写入最新座位状态 */
  function _occupySeats(hallKey, seats) {
    const app = A();
    const sm = app.soldMap();
    sm[hallKey] = [...new Set([...(sm[hallKey] || []), ...seats])];
    app.write(app.STORE.sold, sm);
  }

  /** 释放已支付或已预订的座位 */
  function _releaseSeats(hallKey, seats) {
    const app = A();
    const releasing = new Set(seats);
    const sm = app.soldMap();
    sm[hallKey] = (sm[hallKey] || []).filter(id => !releasing.has(id));
    app.write(app.STORE.sold, sm);
  }

  /** 座位发生冲突后终止当前流程并刷新页面 */
  function _handleSeatConflict(hallKey, seats) {
    const app = A();
    const label = typeof RecommendEngine !== 'undefined'
      ? RecommendEngine.labelSeats(seats)
      : seats.join('、');
    app.pendingOrder = null;
    const modal = $('#payModal');
    if (modal) modal.classList.add('hidden');
    app.toast(`${label} 已被其他用户购买或预订，请重新选座`);
    CanvasRenderer.makeSeats();
    renderOrders();
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 购票 → 弹出支付界面 */
  function createOrder() {
    if (!_requireLogin() || !SeatData.selected().size) return;
    const hall = HallConfig.get();
    const app = A();
    app.pendingOrder = {
      hall: hall.key,
      hallName: hall.name,
      seats: [...SeatData.selected()],
      amount: SeatData.selected().size * window.CinemaConfig.pricePerSeat,
    };
    showPayModal();
  }

  /** 预订座位：直接生成已预订订单，不进入支付流程 */
  function reserveOrder() {
    if (!_requireLogin() || !SeatData.selected().size) return;
    const app = A();
    const hall = HallConfig.get();
    const seats = [...SeatData.selected()];
    const conflicts = _findUnavailableSeats(hall.key, seats);
    if (conflicts.length) {
      _handleSeatConflict(hall.key, conflicts);
      return;
    }

    const order = {
      id: 'SC' + Date.now().toString().slice(-9),
      user: app.user().name,
      hall: hall.key,
      hallName: hall.name,
      seats,
      status: '已预订',
      amount: seats.length * window.CinemaConfig.pricePerSeat,
      time: new Date().toLocaleString(),
    };

    // 预订成功后立即占座，避免其他用户重复选择。
    _occupySeats(hall.key, seats);
    const list = app.orders();
    list.unshift(order);
    app.write(app.STORE.orders, list);

    // 设置待支付订单，允许用户直接进入支付流程
    app.pendingOrder = {
      hall: hall.key,
      hallName: hall.name,
      seats,
      amount: order.amount,
      reserveIds: [order.id],
    };

    app.toast('预订成功，可立即支付或稍后在订单中心操作');
    EventBus.emit('order:changed');
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 显示支付弹窗 */
  function showPayModal() {
    const app = A();
    const o = app.pendingOrder;
    if (!o) return;
    app.payMethod = 'wechat';

    const label = RecommendEngine.labelSeats(o.seats);
    $('#payOrderSummary').innerHTML =
      `<div class="pay-summary">
         <b>${o.hallName}</b> · ${label}<br>
         座位数 <b>${o.seats.length}</b> 座 · 单价 <b>¥${window.CinemaConfig.pricePerSeat}</b><br>
         合计 <b style="font-size:18px">¥${o.amount}</b>
         <span style="color:var(--muted);margin-left:8px">扫码支付后完成购票</span>
       </div>`;
    $('#payAmount').textContent = o.amount;
    const payError = $('#payError');
    if (payError) payError.textContent = '';

    const pm = $('#payMethods');
    if (pm) {
      pm.querySelectorAll('.pay-method').forEach(el => el.classList.remove('active'));
      const defaultBtn = pm.querySelector('[data-pay="wechat"]');
      if (defaultBtn) defaultBtn.classList.add('active');
    }

    const modal = $('#payModal');
    if (modal) modal.classList.remove('hidden');
    renderQrCode('wechat');
  }

  /** 支付方式切换 */
  function selectPayMethod(method) {
    A().payMethod = method;
    const pm = $('#payMethods');
    if (pm) {
      pm.querySelectorAll('.pay-method').forEach(el => {
        el.classList.toggle('active', el.dataset.pay === method);
      });
    }
    renderQrCode(method);
  }

  /** 生成真实二维码（qrserver API） */
  function renderQrCode(method) {
    const box = document.getElementById('qrCodeBox');
    if (!box) return;
    const app = A();
    const names = { wechat: '微信支付', alipay: '支付宝', paypal: 'PayPal', unionpay: '银联云闪付', applepay: 'Apple Pay', card: '银行卡' };
    const amount = app.pendingOrder ? app.pendingOrder.amount : 0;
    const data = `https://www.tsinghua.edu.cn\n支付方式：${names[method] || method}\n金额：¥${amount}\n订单号：SC${Date.now().toString().slice(-9)}`;
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(data)}`;
    box.innerHTML = `<img src="${url}" width="160" height="160" alt="扫码支付" style="display:block;border-radius:8px">`;
  }

  /** 确认支付 */
  function confirmPayment() {
    const app = A();
    const o = app.pendingOrder;
    if (!o) return;

    // 预订转支付：座位已在预订时占用，无需重复校验
    // 直接购票：支付弹窗打开期间座位可能被其他用户抢先占用，需要校验
    if (!o.reserveIds || !o.reserveIds.length) {
      const conflicts = _findUnavailableSeats(o.hall, o.seats);
      if (conflicts.length) {
        _handleSeatConflict(o.hall, conflicts);
        return;
      }
    }

    const method = app.payMethod || 'wechat';
    const list = app.orders();

    if (o.reserveIds && o.reserveIds.length) {
      // 从预订转为支付：批量更新所有关联订单状态
      for (const rid of o.reserveIds) {
        const order = list.find(x => x.id === rid);
        if (order) {
          order.status = '已支付';
          order.payMethod = method;
        }
      }
    } else {
      const order = {
        id: 'SC' + Date.now().toString().slice(-9),
        user: app.user().name,
        hall: o.hall,
        hallName: o.hallName,
        seats: o.seats,
        status: '已支付',
        payMethod: method,
        amount: o.amount,
        time: new Date().toLocaleString(),
      };
      list.unshift(order);
    }
    app.write(app.STORE.orders, list);

    _occupySeats(o.hall, o.seats);

    const modal = $('#payModal');
    if (modal) modal.classList.add('hidden');
    app.pendingOrder = null;

    const payNames = { wechat: '微信支付', alipay: '支付宝', paypal: 'PayPal', unionpay: '银联云闪付', applepay: 'Apple Pay', card: '银行卡' };
    app.toast(`支付成功（${payNames[method] || method}）· 已支付`);
    EventBus.emit('order:changed');
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 取消支付 */
  function cancelPayment() {
    A().pendingOrder = null;
    const modal = $('#payModal');
    if (modal) modal.classList.add('hidden');
    A().toast('已取消支付');
  }

  /** 退票 */
  function refundOrder(id) {
    const app = A();
    const list = app.orders();
    const order = list.find(x => x.id === id);
    if (!order) return;

    _releaseSeats(order.hall, order.seats);
    order.status = '已退票';
    app.write(app.STORE.orders, list);

    app.toast('已退票');
    EventBus.emit('order:changed');
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 取消尚未支付的预订 */
  function cancelReservation(id) {
    const app = A();
    const list = app.orders();
    const order = list.find(x => x.id === id);
    if (!order || order.status !== '已预订') return;

    _releaseSeats(order.hall, order.seats);
    order.status = '已取消';
    app.write(app.STORE.orders, list);
    if (app.pendingOrder && app.pendingOrder.reserveIds && app.pendingOrder.reserveIds.includes(id)) app.pendingOrder = null;
    app.toast('预订已取消');
    EventBus.emit('order:changed');
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 渲染订单列表到 #orderList */
  function renderOrders() {
    const app = A();
    const u = app.user();
    const list = app.orders().filter(o => u && (u.role === 'admin' || o.user === u.name));
    const orderList = $('#orderList');
    if (!orderList) return;

    if (!list.length) {
      orderList.innerHTML = '<div class="sub">暂无订单，完成一次选座后订单会出现在这里。</div>';
    } else {
      orderList.innerHTML = list.map(o => {
        const isAdmin = u && u.role === 'admin';
        const statusStyle = o.status === '已支付'
          ? 'background:#1a2e29;color:#66e4aa'
          : o.status === '已预订'
            ? 'background:#102a42;color:#76c7ff'
            : 'background:#2a1a1a;color:#ff9ea5';
        const action = o.status === '已支付'
          ? `<button data-order="${o.id}" data-action="refund">退票</button>`
          : o.status === '已预订'
            ? `<button data-order="${o.id}" data-action="cancel">取消预订</button>`
            : '<span></span>';
        return `
        <div class="order">
          <div><b>${o.hallName}</b><div class="sub">${isAdmin ? `<span style="color:var(--cyan)">@${o.user}</span> ` : ''}${RecommendEngine.labelSeats(o.seats)}</div></div>
          <div>${o.time}</div>
          <div class="pill" style="${statusStyle}">${o.status}${o.payMethod ? ' · ' + ({wechat:'微信',alipay:'支付宝',paypal:'PayPal',unionpay:'云闪付',applepay:'Apple Pay',card:'银行卡'}[o.payMethod]||o.payMethod) : ''}</div>
          <div>¥${o.amount}</div>
          ${action}
        </div>
      `}).join('');

      orderList.querySelectorAll('button').forEach(b => {
        b.onclick = () => b.dataset.action === 'cancel'
          ? cancelReservation(b.dataset.order)
          : refundOrder(b.dataset.order);
      });
    }

    AdminPanel.render();
  }

  return { createOrder, reserveOrder, showPayModal, selectPayMethod, confirmPayment, cancelPayment, refundOrder, cancelReservation, renderOrders };
})();
window.PaymentPanel = PaymentPanel;
