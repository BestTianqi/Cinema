/* === 认证面板：登录 / 注册 === */

const AuthPanel = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);

  function openAuth() {
    const app = A();
    const modal = $('#authModal');
    if (modal) modal.classList.remove('hidden');
    syncAuth();
  }

  function syncAuth() {
    const app = A();
    const mode = app.authMode;

    const loginTab = $('#loginTab');
    const registerTab = $('#registerTab');
    const confirmLabel = $('#confirmLabel');
    const authConfirm = $('#authConfirm');

    if (loginTab) loginTab.classList.toggle('active', mode === 'login');
    if (registerTab) registerTab.classList.toggle('active', mode === 'register');
    if (confirmLabel) confirmLabel.style.display = mode === 'register' ? '' : 'none';
    if (authConfirm) authConfirm.style.display = mode === 'register' ? '' : 'none';
    if ($('#authError')) $('#authError').textContent = '';
    if ($('#authSubmit')) $('#authSubmit').textContent = mode === 'login' ? '登录' : '注册';
  }

  function submitAuth() {
    const app = A();
    const mode = app.authMode;
    const uname = $('#authUser') ? $('#authUser').value.trim() : '';
    const pass  = $('#authPass') ? $('#authPass').value.trim() : '';
    const confirm = $('#authConfirm') ? $('#authConfirm').value.trim() : '';

    if (!uname || !pass) { if ($('#authError')) $('#authError').textContent = '请填写完整信息'; return; }
    if (mode === 'register' && pass !== confirm) { if ($('#authError')) $('#authError').textContent = '两次密码不一致'; return; }

    const users = app.read(app.STORE.users, {});
    if (mode === 'login') {
      if (!users[uname] || users[uname].password !== pass) {
        if ($('#authError')) $('#authError').textContent = '用户名或密码错误';
        return;
      }
    } else {
      if (users[uname]) { if ($('#authError')) $('#authError').textContent = '用户名已存在'; return; }
      users[uname] = { password: pass, role: 'user', member: true };
      app.write(app.STORE.users, users);
    }

    app.write(app.STORE.session, { name: uname, role: users[uname].role });
    const modal = $('#authModal');
    if (modal) modal.classList.add('hidden');
    syncAccount();
    app.toast(mode === 'login' ? '登录成功' : '注册成功');
  }

  function syncAccount() {
    const app = A();
    const u = app.user();
    const nameEl = $('#accountName');
    const roleEl = $('#accountRole');
    const avatar = $('#avatar');
    const logoutBtn = $('#logoutBtn');
    const adminNav = $('#adminNav');

    if (u) {
      if (nameEl) nameEl.textContent = u.name;
      if (roleEl) roleEl.textContent = u.role === 'admin' ? '管理员' : '普通用户';
      if (avatar) avatar.textContent = u.name[0].toUpperCase();
      if (logoutBtn) { logoutBtn.textContent = '退出'; logoutBtn.classList.remove('hidden'); }
      if (adminNav) adminNav.classList.toggle('hidden', u.role !== 'admin');
    } else {
      if (nameEl) nameEl.textContent = '访客';
      if (roleEl) roleEl.textContent = '请登录';
      if (avatar) avatar.textContent = '访';
      if (logoutBtn) { logoutBtn.textContent = '登录'; logoutBtn.classList.remove('hidden'); }
      if (adminNav) adminNav.classList.add('hidden');
    }

    if (typeof EventBus !== 'undefined') EventBus.emit('auth:changed');
  }

  return { openAuth, syncAuth, submitAuth, syncAccount };
})();
window.AuthPanel = AuthPanel;
