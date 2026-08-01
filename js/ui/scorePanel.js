/* === 评分面板 UI ===
   负责 DOM 更新：圆形进度环、分项得分、等级评定。
   监听 EventBus 的 "seats:changed" 事件来触发重新计算。
*/

const ScorePanel = (() => {
  let _currentScore = null;

  function _el(id) { return document.getElementById(id); }

  /** 核心：计算并刷新评分面板 */
  function refresh() {
    const selected = SeatData.selected();
    const seats = SeatData.all();
    const hall = HallConfig.get();
    const result = ScoreEngine.scoreSelection([...selected], seats, hall.rows, hall.cols);
    _currentScore = result;
    _render(result);
  }

  function _render(result) {
    const ring = _el('scoreRing');
    const value = _el('scoreValue');
    const detail = _el('scoreDetail');

    if (!result) {
      if (value) value.textContent = '--';
      if (ring) ring.style.setProperty('--pct', '0%');
      if (detail) detail.textContent = '选择座位后，将从视角、距离和周围空位三个维度计算体验评分。';
      return;
    }

    const { total, grade, aggregate: a } = result;
    const emoji = grade === '极佳' ? '✦' : grade === '优秀' ? '◆' : '◇';
    const labelHtml = [
      `<b style="color:var(--cyan);font-size:14px">${emoji} ${grade}</b>`,
      `<span style="font-size:11px;color:var(--muted)">`,
      `视角 ${a.angleScore} · 距离 ${a.distanceScore} · 空位 ${a.vacancyScore}`,
      `</span>`,
    ].join('<br>');

    if (value) value.textContent = total;
    if (ring) ring.style.setProperty('--pct', total + '%');
    if (detail) detail.innerHTML = labelHtml;
  }

  /** 获取当前结果供外部查询 */
  function get() { return _currentScore; }

  // 监听座位变化
  EventBus.on('seats:changed', () => refresh());

  return { refresh, get };
})();
