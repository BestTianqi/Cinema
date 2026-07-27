/* === 认证面板：登录 / 注册 / 忘记密码 === */

const AuthPanel = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);

  const DEFAULT_CODE = '114514';

  function openAuth() {
    const app = A();
    app.authMode = 'login';
    const modal = $('#authModal');
    if (modal) modal.classList.remove('hidden');
    syncAuth();
  }

  function syncAuth() {
    const app = A();
    const mode = app.authMode;

    // 选项卡
    const tabs = $('#authTabs');
    const loginTab = $('#loginTab');
    const registerTab = $('#registerTab');
    if (tabs) tabs.classList.toggle('hidden', mode === 'forgot');
    if (loginTab) loginTab.classList.toggle('active', mode === 'login');
    if (registerTab) registerTab.classList.toggle('active', mode === 'register');

    // 标题区
    const eyebrow = $('#authEyebrow');
    const title = $('#authTitle');
    const subtitle = $('#authSubtitle');
    if (eyebrow) eyebrow.textContent = mode === 'forgot' ? 'PASSWORD RECOVERY' : 'WELCOME TO SMARTCINEMA';
    if (title) title.textContent = mode === 'forgot' ? '找回密码' : '登录后开始智能选座';
    if (subtitle) subtitle.textContent = mode === 'forgot' ? '通过注册邮箱重置密码' : '新用户注册即可获得会员资格';

    // 字段显示控制
    const emailLabel = $('#emailLabel');
    const emailInput = $('#authEmail');
    const userLabel = $('#userLabel');
    const userInput = $('#authUser');
    const passLabel = $('#passLabel');
    const passInput = $('#authPass');
    const confirmLabel = $('#confirmLabel');
    const confirmInput = $('#authConfirm');
    const forgotSection = $('#forgotSection');

    const show = (el, visible) => { if (el) el.classList.toggle('hidden', !visible); };

    show(emailLabel, mode === 'register' || mode === 'forgot');
    show(emailInput, mode === 'register' || mode === 'forgot');
    show(userLabel, mode !== 'forgot');
    show(userInput, mode !== 'forgot');
    show(passLabel, true);
    show(passInput, true);
    show(confirmLabel, mode === 'register' || mode === 'forgot');
    show(confirmInput, mode === 'register' || mode === 'forgot');
    show(forgotSection, mode === 'forgot');

    // 密码/确认密码标签文案
    if (passLabel) passLabel.textContent = mode === 'forgot' ? '新密码' : '密码';
    if (confirmLabel) confirmLabel.textContent = mode === 'forgot' ? '确认新密码' : '确认密码';

    // 忘记密码 / 返回链接
    const forgotLink = $('#forgotLink');
    const backLink = $('#backToLogin');
    show(forgotLink, mode === 'login');
    show(backLink, mode === 'forgot');

    // 提示
    const hint = $('#authHint');
    show(hint, mode !== 'forgot');

    // 提交按钮
    const submit = $('#authSubmit');
    if (submit) submit.textContent = mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码';

    // 清空错误和字段
    if ($('#authError')) $('#authError').textContent = '';
  }

  function submitAuth() {
    const app = A();
    const mode = app.authMode;

    if (mode === 'login') return _doLogin();
    if (mode === 'register') return _doRegister();
    if (mode === 'forgot') return _doResetPassword();
  }

  /* ========== 登录 ========== */
  function _doLogin() {
    const app = A();
    const uname = $('#authUser') ? $('#authUser').value.trim() : '';
    const pass  = $('#authPass') ? $('#authPass').value.trim() : '';
    if (!uname || !pass) { _err('请填写用户名和密码'); return; }

    const users = app.read(app.STORE.users, {});
    if (!users[uname] || users[uname].password !== pass) {
      _err('用户名或密码错误');
      return;
    }

    app.write(app.STORE.session, { name: uname, role: users[uname].role });
    _close();
    syncAccount();
    app.toast('登录成功');
  }

  /* ========== 注册 ========== */
  function _doRegister() {
    const app = A();
    const uname = $('#authUser') ? $('#authUser').value.trim() : '';
    const email = $('#authEmail') ? $('#authEmail').value.trim() : '';
    const pass  = $('#authPass') ? $('#authPass').value.trim() : '';
    const confirm = $('#authConfirm') ? $('#authConfirm').value.trim() : '';

    if (!uname || !email || !pass) { _err('请填写完整信息（用户名、邮箱、密码）'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _err('邮箱格式不正确'); return; }
    if (pass.length < 4) { _err('密码至少4位'); return; }
    if (pass !== confirm) { _err('两次密码不一致'); return; }

    const users = app.read(app.STORE.users, {});
    if (users[uname]) { _err('用户名已存在'); return; }

    users[uname] = { password: pass, role: 'user', member: true, email };
    app.write(app.STORE.users, users);
    app.write(app.STORE.session, { name: uname, role: 'user' });
    _close();
    syncAccount();
    app.toast('注册成功，已自动登录');
  }

  /* ========== 忘记密码 → 重置 ========== */
  function _doResetPassword() {
    const app = A();
    const email = $('#authEmail') ? $('#authEmail').value.trim() : '';
    const code  = $('#authCode') ? $('#authCode').value.trim() : '';
    const pass  = $('#authPass') ? $('#authPass').value.trim() : '';
    const confirm = $('#authConfirm') ? $('#authConfirm').value.trim() : '';

    if (!email || !code || !pass) { _err('请填写完整信息'); return; }
    if (code !== DEFAULT_CODE) { _err('验证码错误，默认为 114514'); return; }
    if (pass.length < 4) { _err('新密码至少4位'); return; }
    if (pass !== confirm) { _err('两次密码不一致'); return; }

    const users = app.read(app.STORE.users, {});
    const found = Object.entries(users).find(([, u]) => u.email === email);
    if (!found) { _err('该邮箱未注册'); return; }

    found[1].password = pass;
    app.write(app.STORE.users, users);
    app.authMode = 'login';
    syncAuth();
    app.toast('密码已重置，请登录');
  }

  /* ========== 发送验证码 ========== */
  function sendCode() {
    const app = A();
    const email = $('#authEmail') ? $('#authEmail').value.trim() : '';
    if (!email) { _err('请先输入邮箱'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _err('邮箱格式不正确'); return; }

    const users = app.read(app.STORE.users, {});
    const found = Object.entries(users).find(([, u]) => u.email === email);
    if (!found) { _err('该邮箱未注册'); return; }

    // 显示验证码区域
    const codeInput = $('#authCode');
    if (codeInput) { codeInput.value = ''; codeInput.focus(); }

    const sendBtn = $('#sendCodeBtn');
    if (sendBtn) { sendBtn.textContent = '验证码已发送（默认 114514）'; sendBtn.disabled = true; sendBtn.style.opacity = '0.6'; }

    if ($('#authError')) $('#authError').textContent = '';
    app.toast(`验证码已发送至 ${email}`);
  }

  /* ========== 账户信息同步 ========== */
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

  /* ========== 工具 ========== */
  function _err(msg) { const el = $('#authError'); if (el) el.textContent = msg; }
  function _close() { const modal = $('#authModal'); if (modal) modal.classList.add('hidden'); }

  return { openAuth, syncAuth, submitAuth, sendCode, syncAccount };
})();
window.AuthPanel = AuthPanel;
