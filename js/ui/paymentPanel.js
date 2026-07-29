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
    const order = {
      id: 'SC' + Date.now().toString().slice(-9),
      user: app.user().name,
      hall: hall.key,
      hallName: hall.name,
      seats: [...SeatData.selected()],
      status: '已预订',
      amount: SeatData.selected().size * window.CinemaConfig.pricePerSeat,
      time: new Date().toLocaleString(),
    };

    const list = app.orders();
    list.unshift(order);
    app.write(app.STORE.orders, list);
    app.toast('预订成功，可在订单中心取消预订');
    CanvasRenderer.makeSeats();
    renderOrders();
    AdminPanel.render();
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

    const method = app.payMethod || 'wechat';
    const order = {
      id: 'SC' + Date.now().toString().slice(-9),
      user: app.user().name,
      hall: o.hall,
      hallName: o.hallName,
      seats: o.seats,
      status: '已购票',
      payMethod: method,
      amount: o.amount,
      time: new Date().toLocaleString(),
    };

    const list = app.orders();
    list.unshift(order);
    app.write(app.STORE.orders, list);

    const sm = app.soldMap();
    sm[o.hall] = [...new Set([...(sm[o.hall] || []), ...o.seats])];
    app.write(app.STORE.sold, sm);

    const modal = $('#payModal');
    if (modal) modal.classList.add('hidden');
    app.pendingOrder = null;

    const payNames = { wechat: '微信支付', alipay: '支付宝', paypal: 'PayPal', unionpay: '银联云闪付', applepay: 'Apple Pay', card: '银行卡' };
    app.toast(`支付成功（${payNames[method] || method}）· 已购票`);
    CanvasRenderer.makeSeats();
    renderOrders();
    AdminPanel.render();
    // 通知其他标签页：有座位售出了（多人在线同步）
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

    const sm = app.soldMap();
    sm[order.hall] = (sm[order.hall] || []).filter(x => !order.seats.includes(x));
    app.write(app.STORE.sold, sm);
    order.status = '已退票';
    app.write(app.STORE.orders, list);

    app.toast('已退票');
    CanvasRenderer.makeSeats();
    renderOrders();
    AdminPanel.render();
    // 退票后座位释放，同步给其他标签页
    if (typeof RealtimeSync !== 'undefined') RealtimeSync.broadcastSold();
  }

  /** 取消尚未支付的预订 */
  function cancelReservation(id) {
    const app = A();
    const list = app.orders();
    const order = list.find(x => x.id === id);
    if (!order || order.status !== '已预订') return;

    order.status = '已取消';
    app.write(app.STORE.orders, list);
    app.toast('预订已取消');
    renderOrders();
    AdminPanel.render();
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
        const statusStyle = o.status === '已购票'
          ? 'background:#1a2e29;color:#66e4aa'
          : o.status === '已预订'
            ? 'background:#102a42;color:#76c7ff'
            : 'background:#2a1a1a;color:#ff9ea5';
        const action = o.status === '已购票'
          ? `<button data-order="${o.id}" data-action="refund">退票</button>`
          : o.status === '已预订'
            ? `<button data-order="${o.id}" data-action="cancel">取消预订</button>`
            : '<span></span>';
        return `
        <div class="order">
          <div><b>${o.hallName}</b><div class="sub">${RecommendEngine.labelSeats(o.seats)}</div></div>
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

  return { createOrder, reserveOrder, showPayModal, selectPayMethod, renderQrCode, confirmPayment, cancelPayment, refundOrder, cancelReservation, renderOrders };
})();
window.PaymentPanel = PaymentPanel;
