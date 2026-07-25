/* === 管理后台面板 === */

const AdminPanel = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);

  let _currentPreset = null;

  function render() {
    const app = A();
    const u = app.user();
    if (!u || u.role !== 'admin') return;

    const users = app.read(app.STORE.users, {});
    const orders = app.orders();
    const soldTotal = Object.values(app.soldMap()).reduce((n, arr) => n + arr.length, 0);

    const statUsers = $('#statUsers');
    const statOrders = $('#statOrders');
    const statSold = $('#statSold');
    if (statUsers) statUsers.textContent = Object.keys(users).length;
    if (statOrders) statOrders.textContent = orders.length;
    if (statSold) statSold.textContent = soldTotal;

    // 订单列表
    const adminOrders = $('#adminOrders');
    if (adminOrders) {
      if (orders.length === 0) {
        adminOrders.innerHTML = '<tr><td colspan="6" class="sub">暂无订单</td></tr>';
      } else {
        adminOrders.innerHTML = orders.map(o => {
          const label = typeof RecommendEngine !== 'undefined' ? RecommendEngine.labelSeats(o.seats) : '';
          return `<tr><td>${o.id}</td><td>${o.user}</td><td>${o.hallName}</td><td>${label}</td><td>${o.status}</td><td>¥${o.amount}</td></tr>`;
        }).join('');
      }
    }

    // 用户列表
    const adminUsers = $('#adminUsers');
    if (adminUsers) {
      const userList = Object.entries(users).filter(([name]) => name);
      if (userList.length) {
        adminUsers.innerHTML = userList
          .sort((a, b) => a[0].localeCompare(b[0], 'zh'))
          .map(([name, info]) => {
            const initial = name.slice(0, 1).toUpperCase();
            const avatarBg = info.role === 'admin'
              ? 'linear-gradient(135deg,var(--cyan),var(--blue))'
              : 'linear-gradient(135deg,var(--purple),#555)';
            const orderCount = orders.filter(o => o.user === name && o.status === '已购票').length;
            return `<tr>
              <td><div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};display:grid;place-items:center;font-weight:700;font-size:13px;color:#fff">${initial}</div></td>
              <td><b>${name}</b><div class="sub">${orderCount} 笔有效订单</div></td>
              <td>${info.role === 'admin' ? '<span style="color:var(--cyan);font-weight:700">管理员</span>' : '<span style="color:#aab5c9">普通会员</span>'}</td>
              <td>${info.member ? '<span style="color:var(--green)">已激活</span>' : '<span style="color:var(--muted)">未激活</span>'}</td>
              <td>—</td>
            </tr>`;
          }).join('');
      } else {
        adminUsers.innerHTML = '<tr><td colspan="5" class="sub">暂无注册用户</td></tr>';
      }
    }

    _updatePresetUI();
  }

  /** 为指定影厅生成伪随机售票数据 */
  function _generatePresetForHall(mode, H, hallKey) {
    const total = H.cols * H.rows;
    const soldIds = [];
    const centerCol = (H.cols + 1) / 2;
    const midRow = Math.ceil(H.rows / 2);

    const seeds = { weekend: 42, packed: 77, weekday: 13 };
    let seed = (seeds[mode] || 42) + H.cols * 100 + H.rows * 7 + (hallKey.charCodeAt(0) || 0) * 31;
    const rng = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };

    const target = mode === 'weekend' ? Math.floor(total * 0.32) :
                   mode === 'packed'  ? Math.floor(total * 0.48) :
                                        Math.floor(total * 0.20);

    const scored = [];
    for (let row = 1; row <= H.rows; row++) {
      for (let col = 1; col <= H.cols; col++) {
        const centerBonus = 1 - Math.abs(col - centerCol) / (H.cols / 2) * 0.7;
        const rowBonus    = 1 - Math.abs(row - midRow) / (H.rows / 2) * 0.5;
        const priority    = mode === 'weekend' ? centerBonus * 0.7 + rowBonus * 0.3 + rng() * 0.3 :
                            mode === 'packed'  ? centerBonus * 0.8 + rowBonus * 0.4 + rng() * 0.2 :
                                                  rng();
        scored.push({ id: `${row}-${col}`, priority });
      }
    }

    scored.sort((a, b) => b.priority - a.priority);
    for (let i = 0; i < target; i++) soldIds.push(scored[i].id);
    return soldIds;
  }

  function _applyPreset(mode) {
    const app = A();
    if (mode === 'clear' || mode === 'empty') {
      app.write(app.STORE.sold, {});
      _currentPreset = null;
    } else {
      const sm = {};
      const halls = window.CinemaConfig.halls;
      Object.entries(halls).forEach(([key, H]) => {
        sm[key] = _generatePresetForHall(mode, H, key);
      });
      app.write(app.STORE.sold, sm);
      _currentPreset = mode;
    }
    _updatePresetUI();
    CanvasRenderer.makeSeats();
    CanvasRenderer.drawSeats();
    EventBus.emit('order:changed');
    app.toast(mode === 'clear' ? '已清空所有售票数据' : `已应用"${mode}"模拟售票数据`);
  }

  function _updatePresetUI() {
    const app = A();
    const halls = window.CinemaConfig.halls;
    const labels = { weekend: '周末黄金场', weekday: '工作日冷场', packed: '满场拥挤' };

    // 高亮当前预设卡片
    document.querySelectorAll('#view-admin .preset-card').forEach(c =>
      c.classList.toggle('applied', c.id === 'preset-' + _currentPreset)
    );

    // 信息栏
    const sm = app.soldMap();
    const totalSold = Object.values(sm).reduce((n, arr) => n + arr.length, 0);
    const totalAll = Object.values(halls).reduce((n, H) => n + H.cols * H.rows, 0);
    const label = _currentPreset ? labels[_currentPreset] : '无预设';
    const el = document.getElementById('presetLabel');
    if (el) el.textContent = label;
    const soldEl = document.getElementById('presetSoldCount');
    if (soldEl) soldEl.textContent = totalSold;
    const totalEl = document.getElementById('presetTotalCount');
    if (totalEl) totalEl.textContent = totalAll;
  }

  return { render, _applyPreset, _updatePresetUI };
})();
window.AdminPanel = AdminPanel;
