/* 多标签页实时座位同步（模拟 WebSocket 多人在线）

   这个项目是纯前端、没有后端，所以用浏览器的 BroadcastChannel API
   来模拟"多人同时选座"的实时效果。开两个浏览器标签页（各登录不同账号），
   一个标签页选座、购票，另一个标签页的画面会实时跟着变。

   BroadcastChannel 只能在同源页面之间通信，正好够用来模拟多人在线场景。
   如果以后接了真正的 WebSocket 服务器，只要把 _send/_recv 换成 ws 收发即可，
   上层的同步逻辑不用动。

   同步三类事件：
     lock    —— 某用户正在选某些座位（别人看到该座被占着，避免冲突）
     unlock  —— 取消选中，释放占用
     sold    —— 购票成功，座位真正售出（所有人画布标红）
     presence —— 在线人数心跳（谁在线、几个标签页开着）
*/

const RealtimeSync = (() => {
  const A = () => window.CinemaApp;
  const CHANNEL = 'cinema-seats';
  const PRESENCE_INTERVAL = 3000;   // 3 秒发一次在线心跳
  const PRESENCE_TIMEOUT  = 7000;   // 7 秒没收到心跳视为离线

  let channel = null;
  let clientId = null;
  let peers = {};        // { clientId: { name, hall, lastSeen } }
  let presenceTimer = null;

  // 当前用户信息（没登录就用"访客"）
  function _me() {
    const u = A().user();
    return {
      id: clientId,
      name: u ? u.name : '访客',
      role: u ? u.role : 'guest',
    };
  }

  // 发消息（BroadcastChannel 版）
  function _send(type, payload) {
    if (!channel) return;
    try {
      channel.postMessage({ type, from: clientId, payload, t: Date.now() });
    } catch (e) {
      // 通道偶尔会抛错（比如页面正在关闭），忽略即可
    }
  }

  // 收到别的标签页发来的消息
  function _onMessage(e) {
    const msg = e.data;
    if (!msg || msg.from === clientId) return;   // 忽略自己发的

    switch (msg.type) {
      case 'lock':
        _applyLock(msg.from, msg.payload);
        break;
      case 'unlock':
        _applyUnlock(msg.from, msg.payload);
        break;
      case 'sold':
        _applySold(msg.payload);
        break;
      case 'presence':
        _applyPresence(msg.from, msg.payload);
        break;
      case 'bye':
        delete peers[msg.from];
        _renderPresence();
        break;
    }
  }

  // 别人在选某些座位 → 在本地把这些座标记为"被占用"
  function _applyLock(fromClientId, payload) {
    peers[fromClientId] = peers[fromClientId] || {};
    peers[fromClientId].seats = payload.seats || [];
    peers[fromClientId].hall = payload.hall;
    peers[fromClientId].name = payload.name;
    peers[fromClientId].lastSeen = Date.now();
    if (typeof EventBus !== 'undefined') EventBus.emit('canvas:redraw');
    _renderLockHint();
  }

  function _applyUnlock(fromClientId, payload) {
    if (peers[fromClientId]) {
      peers[fromClientId].seats = [];
      peers[fromClientId].hall = payload.hall;
    }
    if (typeof EventBus !== 'undefined') EventBus.emit('canvas:redraw');
    _renderLockHint();
  }

  // 别人购票成功 → 本地重新读已售数据并刷新画布
  function _applySold(payload) {
    // 已售数据存在 LocalStorage，同源标签页共享，重新构建座位即可看到
    if (typeof CanvasRenderer !== 'undefined') {
      CanvasRenderer.makeSeats();
      CanvasRenderer.drawSeats();
    }
    if (typeof PaymentPanel !== 'undefined') PaymentPanel.renderOrders();
    const who = payload && payload.name ? `${payload.name} ` : '';
    A().toast(`${who}刚购买了座位，已为您同步`);
  }

  // 在线心跳
  function _applyPresence(fromClientId, payload) {
    peers[fromClientId] = Object.assign(peers[fromClientId] || {}, payload, { lastSeen: Date.now() });
    _renderPresence();
  }

  // 把别人正在选的座位合并成一个 Set，供画布渲染时区分
  function peerLockedSeats(hallKey) {
    const set = new Set();
    Object.values(peers).forEach(p => {
      if (p.hall === hallKey && Array.isArray(p.seats)) {
        p.seats.forEach(id => set.add(id));
      }
    });
    return set;
  }

  // 在线人数指示（含自己）
  function onlineCount() {
    return Object.keys(peers).filter(id => Date.now() - peers[id].lastSeen < PRESENCE_TIMEOUT).length + 1;
  }

  // 刷新右上角在线人数 UI
  function _renderPresence() {
    const el = document.getElementById('onlineCount');
    if (el) el.textContent = onlineCount();
  }

  // 别人正在选座时，给个轻提示
  function _renderLockHint() {
    const hall = typeof HallConfig !== 'undefined' ? HallConfig.get().key : null;
    const lockingPeers = Object.values(peers).filter(p => p.hall === hall && p.seats && p.seats.length);
    const el = document.getElementById('syncHint');
    if (el) {
      if (lockingPeers.length) {
        const names = lockingPeers.map(p => p.name).join('、');
        el.textContent = `${names} 正在选座`;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  }

  // ====== 对外暴露的动作 ======

  // 本地用户选了/取消了座位，广播给别人
  function broadcastLock(seatIds) {
    const hall = typeof HallConfig !== 'undefined' ? HallConfig.get().key : null;
    if (seatIds && seatIds.length) {
      _send('lock', { seats: [...seatIds], hall, name: _me().name });
    } else {
      _send('unlock', { hall });
    }
  }

  // 本地购票成功，广播"已售"
  function broadcastSold() {
    _send('sold', { name: _me().name });
  }

  function init() {
    if (typeof BroadcastChannel === 'undefined') {
      // 浏览器不支持（很老的版本），静默降级，不影响单标签页使用
      console.warn('[RealtimeSync] 当前浏览器不支持 BroadcastChannel，多人同步不可用');
      return;
    }
    clientId = 'c' + Math.random().toString(36).slice(2, 10);
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = _onMessage;

    // 先广播一次自己上线，并启动心跳
    _send('presence', { name: _me().name, role: _me().role });
    presenceTimer = setInterval(() => {
      _send('presence', { name: _me().name, role: _me().role });
      // 顺便清掉超时的 peer
      const now = Date.now();
      let changed = false;
      Object.keys(peers).forEach(id => {
        if (now - peers[id].lastSeen > PRESENCE_TIMEOUT) { delete peers[id]; changed = true; }
      });
      if (changed) _renderPresence();
    }, PRESENCE_INTERVAL);

    // 页面关闭时通知别人
    window.addEventListener('beforeunload', () => _send('bye', {}));
  }

  return { init, broadcastLock, broadcastSold, peerLockedSeats, onlineCount };
})();
window.RealtimeSync = RealtimeSync;
