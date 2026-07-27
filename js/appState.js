/* === 共享应用状态 + 工具函数 ===
   所有模块通过 window.CinemaApp 访问共享状态。
*/

window.CinemaApp = (() => {
  const STORE = { users: 'sc_users', session: 'sc_session', orders: 'sc_orders', sold: 'sc_sold', access: 'sc_access' };
  const read  = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  if (!read(STORE.users, null)) {
    write(STORE.users, { admin: { password: 'admin123', role: 'admin', member: true, email: 'admin@cinema.com' } });
  }

  // DOM 快捷方法
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // 用户/订单/已售 访问器
  const user    = () => read(STORE.session, null);
  const orders  = () => read(STORE.orders, []);
  const soldMap = () => read(STORE.sold, {});

  // Toast + 语音
  function toast(t) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = t;
    el.classList.add('show');
    voice(t);
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function voice(t) {
    if ($('#voice') && $('#voice').checked && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(t));
    }
  }

  // Canvas 引用（延迟初始化，DOM 就绪后赋值）
  let canvas = null, ctx = null, heatCanvas = null, hctx = null;

  function initCanvas() {
    canvas = $('#seatCanvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    heatCanvas = $('#heatCanvas');
    hctx = heatCanvas ? heatCanvas.getContext('2d') : null;
  }

  return {
    // 状态
    ticket: 'personal',
    scale: 1, offsetX: 0, offsetY: 0,
    dragSelect: false, pointer: null,
    authMode: 'login',
    heatHall: 'small', heatDay: 0,
    _topCandidates: [],
    payMethod: 'wechat', pendingOrder: null,

    // 工具
    $, $$, STORE, read, write,
    user, orders, soldMap,
    toast, voice,

    // Canvas
    get canvas() { return canvas; },
    get ctx() { return ctx; },
    get heatCanvas() { return heatCanvas; },
    get hctx() { return hctx; },
    initCanvas,
  };
})();
