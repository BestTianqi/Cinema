/* === main.js — 项目入口与模块协调 ===
   项目入口，负责：
   1. 初始化各模块
   2. 管理模块间事件通信
   3. 向外暴露全局 API 供 inline 脚本调用

   与 index.html 内联脚本的衔接：
   评分统一交由 ScoreEngine / ScorePanel，内联脚本只保留页面交互绑定。
*/

(() => {
  'use strict';

  // ==================== 影厅初始化 ====================
  const cfg = window.CinemaConfig;
  let currentHall = cfg.defaultHall;

  function initHall(hallKey) {
    currentHall = hallKey;
    HallConfig.switchHall(hallKey);
    SeatData.build(hallKey);
  }

  // ==================== 评分联动 ====================
  /** 当座位选择变化时重新评分 */
  function onSeatsChanged() {
    // 评分由 ScorePanel 自身的 seats:changed 监听器刷新；这里只同步订单步骤状态。
    const count = SeatData.selectedCount();
    const buyBtn = document.getElementById('buyBtn');
    const reserveBtn = document.getElementById('reserveBtn');
    const step3 = document.getElementById('step3');
    const step2 = document.getElementById('step2');

    if (buyBtn) buyBtn.disabled = count === 0;
    if (reserveBtn) reserveBtn.disabled = count === 0;
    if (step3) step3.classList.toggle('done', count > 0);
    if (step2) step2.classList.toggle('done', count > 0);
  }

  // ==================== 订单联动 ====================
  function onSeatClick(seatId, ctrlKey) {
    // 已售座位不可选
    const seat = SeatData.all().find(s => s.id === seatId);
    if (seat && seat.sold) return;

    if (ctrlKey) {
      SeatData.toggle(seatId);
    } else {
      SeatData.clearSelection();
      SeatData.toggle(seatId);
    }
    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  function onRecommend(seatIds) {
    SeatData.setRecommended(seatIds);
    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  function onClearSelection() {
    SeatData.clearSelection();
    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  // ==================== 全局事件挂载 ====================
  EventBus.on('seats:changed', onSeatsChanged);
  EventBus.on('hall:switched', (hallKey) => {
    initHall(hallKey);
    EventBus.emit('seats:changed');
  });

  // ==================== 初始启动 ====================
  initHall(cfg.defaultHall);
  PaymentPanel.renderOrders();

  // ==================== 暴露 API ====================
  // 供 index.html 内联脚本或控制台调用
  window.Cinema = {
    // 座位
    getSeats: () => SeatData.all(),
    getSelected: () => SeatData.selected(),
    getRecommended: () => SeatData.recommended(),
    toggleSeat: (id, ctrl) => onSeatClick(id, ctrl),
    clearSelection: onClearSelection,
    selectBatch: (ids) => { SeatData.selectBatch(ids); EventBus.emit('seats:changed'); },
    setRecommended: onRecommend,

    // 评分
    getScore: () => ScorePanel.get(),
    refreshScore: () => ScorePanel.refresh(),

    // 订单（统一使用最新版 PaymentPanel）
    reserveOrder: () => PaymentPanel.reserveOrder(),
    createOrder: () => PaymentPanel.createOrder(),
    renderOrders: () => PaymentPanel.renderOrders(),
    cancelReservation: (id) => PaymentPanel.cancelReservation(id),
    refundOrder: (id) => PaymentPanel.refundOrder(id),
    getOrders: () => window.CinemaApp.orders(),

    // 影厅
    switchHall: (key) => EventBus.emit('hall:switched', key),
    currentHall: () => HallConfig.get(),

    // 事件
    on: (evt, fn) => EventBus.on(evt, fn),
    emit: (evt, data) => EventBus.emit(evt, data),
  };

  console.log('[Cinema] 核心模块已就绪：评分引擎 + 订单中心 + 事件总线');
  console.log('[Cinema] 可用 API：window.Cinema  |  模块：ScoreEngine / ScorePanel / PaymentPanel / SeatData / EventBus');
})();
