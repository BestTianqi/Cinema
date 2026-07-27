/* === 无障碍控制面板：成员C ===
   负责大字体、高对比度、色盲友好和语音提示的状态同步。
*/

const AccessibilityPanel = (() => {
  const A = () => window.CinemaApp;
  const options = [
    { id: 'largeText', className: 'large-text', label: '大字体模式' },
    { id: 'contrast', className: 'high-contrast', label: '高对比度模式' },
    { id: 'colorblind', className: 'colorblind', label: '色盲友好模式' },
  ];

  function init() {
    const app = A();
    const accessBtn = app.$('#accessBtn');
    const panel = app.$('#accessPanel');
    const careBtn = app.$('#careMode');

    if (accessBtn && panel) {
      accessBtn.onclick = () => {
        const isHidden = panel.classList.toggle('hidden');
        accessBtn.setAttribute('aria-expanded', String(!isHidden));
        if (!isHidden) app.announce('辅助功能设置已打开');
      };
      accessBtn.setAttribute('aria-controls', 'accessPanel');
      accessBtn.setAttribute('aria-expanded', String(panel && !panel.classList.contains('hidden')));
    }

    const acc = app.read(app.STORE.access, {});
    options.forEach(opt => bindClassOption(opt, acc));
    bindVoiceOption(acc);
    syncCareModeState();

    if (careBtn) {
      careBtn.onclick = () => enableCareMode();
    }
  }

  function bindClassOption(opt, acc) {
    const app = A();
    const el = app.$(`#${opt.id}`);
    if (!el) return;

    el.checked = !!acc[opt.id];
    applyClass(opt.className, el.checked);

    el.onchange = () => {
      const next = app.read(app.STORE.access, {});
      next[opt.id] = el.checked;
      app.write(app.STORE.access, next);
      applyClass(opt.className, el.checked);
      if (typeof CanvasRenderer !== 'undefined') CanvasRenderer.resize();
      app.toast(`${opt.label}${el.checked ? '已开启' : '已关闭'}`);
      syncCareModeState();
    };
  }

  function bindVoiceOption(acc) {
    const app = A();
    const el = app.$('#voice');
    if (!el) return;

    el.checked = !!acc.voice;
    el.onchange = () => {
      const next = app.read(app.STORE.access, {});
      next.voice = el.checked;
      app.write(app.STORE.access, next);
      app.toast(`语音提示${el.checked ? '已开启' : '已关闭'}`);
      syncCareModeState();
    };
  }

  function enableCareMode() {
    const app = A();
    const next = app.read(app.STORE.access, {});
    next.largeText = true;
    next.contrast = true;
    next.voice = true;
    app.write(app.STORE.access, next);

    options.forEach(opt => {
      const el = app.$(`#${opt.id}`);
      const enabled = !!next[opt.id];
      if (el) el.checked = enabled;
      applyClass(opt.className, enabled);
    });

    const voiceEl = app.$('#voice');
    if (voiceEl) voiceEl.checked = true;
    if (typeof CanvasRenderer !== 'undefined') CanvasRenderer.resize();
    syncCareModeState();
    app.toast('关怀模式已开启，已放大文字并开启高对比度和语音播报');
  }

  function syncCareModeState() {
    const app = A();
    const careBtn = app.$('#careMode');
    if (!careBtn) return;
    const acc = app.read(app.STORE.access, {});
    const enabled = !!acc.largeText && !!acc.contrast && !!acc.voice;
    careBtn.classList.toggle('active', enabled);
    careBtn.setAttribute('aria-pressed', String(enabled));
  }

  function applyClass(className, enabled) {
    document.body.classList.toggle(className, enabled);
  }

  return { init, enableCareMode };
})();

window.AccessibilityPanel = AccessibilityPanel;
