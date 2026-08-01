/* === 智能推荐引擎 ===
   三阶段搜索：同排连续 → 相邻排拼合 → 贪心兜底。
   评分公式：观影体验评分均值 − 年龄惩罚 + 推荐策略加成。
*/

const RecommendEngine = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /** 年龄 → 类别 teen/adult/senior */
  function classifyAge(age) {
    const n = Number(age);
    if (!n || n <= 0) return 'adult';
    if (n < 15) return 'teen';
    if (n >= 60) return 'senior';
    return 'adult';
  }

  /** 座位排序列号文本 */
  function labelSeats(ids) {
    if (!ids || !ids.length) return '--';
    return [...ids]
      .sort((a, b) => {
        const [r1, c1] = a.split('-').map(Number);
        const [r2, c2] = b.split('-').map(Number);
        return r1 - r2 || c1 - c2;
      })
      .map(x => { const [r, c] = x.split('-'); return `${r}排${c}座`; })
      .join('、');
  }

  function recommend() {
    const app = A();
    if (!app.user()) { app.toast('请先登录'); return; }

    const rows = $$('#memberList .member-row');
    if (!rows.length) { app.toast('请先选择票型'); return; }

    const members = rows.map((r, i) => {
      const ageInput = r.querySelector('.member-age');
      const nameInput = r.querySelector('.member-name');
      return {
        name: nameInput?.value?.trim() || `成员${i + 1}`,
        age: Number(ageInput?.value) || 0,
        category: classifyAge(ageInput?.value),
      };
    });
    const count = members.length;
    const ages = members.map(m => m.category);

    const hall = HallConfig.get();
    const H = hall;
    if (count > H.cols * H.rows) {
      _showNoResult('当前放映厅的座位总数不足，请减少人数或更换影厅。');
      app.toast('暂无合适座位');
      return;
    }

    const seats = SeatData.all();
    const hasTeen = ages.some(a => a === 'teen');
    const hasSenior = ages.some(a => a === 'senior');
    const ticket = app.ticket;

    const _score = (seatList) => {
      if (!seatList.length) return 0;
      const perSeat = seatList.map(s => ScoreEngine.scoreSeat(s, H.rows, H.cols, seats));
      const baseAvg = perSeat.reduce((a, x) => a + x.total, 0) / perSeat.length;
      const agePenalty = seatList.reduce((pen, s) =>
        pen + (hasTeen && s.row <= 3 ? 30 : 0) + (hasSenior && s.row >= H.rows - 2 ? 30 : 0), 0);
      const sections = new Set(seatList.map(s => {
        let c = 0;
        for (let i = 0; i < H.groups.length; i++) { c += H.groups[i]; if (s.col <= c) return i; }
        return H.groups.length - 1;
      }));
      const aislePenalty = sections.size > 1 ? 3 : 0;
      const avgRow = seatList.reduce((a, s) => a + s.row, 0) / seatList.length;
      const coupleBonus = (ticket === 'couple' || ticket === 'family') ? Math.round(Math.sqrt(Math.max(0, avgRow - H.rows * 0.5)) * 7) : 0;
      return +(baseAvg - agePenalty - aislePenalty + coupleBonus).toFixed(1);
    };

    const allAvailable = seats.filter(s => !s.sold);
    if (allAvailable.length < count) {
      _showNoResult(`当前放映厅只剩 ${allAvailable.length} 个未售座位，无法安排 ${count} 人。`);
      app.toast('暂无合适座位');
      return;
    }

    let candidates = [];

    // 阶段1：同排连续
    for (let r = 1; r <= H.rows; r++) {
      for (let st = 1; st <= H.cols - count + 1; st++) {
        const group = [];
        for (let c = st; c < st + count; c++) group.push(seats.find(s => s.row === r && s.col === c));
        if (group.every(s => s && !s.sold)) {
          candidates.push({ group, score: _score(group) + 50, type: 'same-row' });
        }
      }
    }

    // 阶段2：相邻排拼合（两排）
    if (count >= 2 && count <= H.cols * 2) {
      for (let r = 1; r < H.rows; r++) {
        for (let split = 1; split < count; split++) {
          const cntA = split, cntB = count - split;
          if (cntA > H.cols || cntB > H.cols) continue;
          for (let stA = 1; stA <= H.cols - cntA + 1; stA++) {
            const groupA = [];
            for (let c = stA; c < stA + cntA; c++) groupA.push(seats.find(s => s.row === r && s.col === c));
            if (!groupA.every(s => s && !s.sold)) continue;
            const colRangeA = [stA, stA + cntA - 1];
            for (let stB = 1; stB <= H.cols - cntB + 1; stB++) {
              const colRangeB = [stB, stB + cntB - 1];
              const overlap = Math.max(0, Math.min(colRangeA[1], colRangeB[1]) - Math.max(colRangeA[0], colRangeB[0]) + 1);
              const gap = overlap > 0 ? 0 : Math.min(Math.abs(colRangeA[1] - colRangeB[0]), Math.abs(colRangeB[1] - colRangeA[0]));
              if (gap > 1) continue;
              const groupB = [];
              for (let c = stB; c < stB + cntB; c++) groupB.push(seats.find(s => s.row === r + 1 && s.col === c));
              if (!groupB.every(s => s && !s.sold)) continue;
              candidates.push({ group: [...groupA, ...groupB], score: _score([...groupA, ...groupB]) + (overlap > 0 ? 8 : 3), type: 'multi-row' });
            }
          }
        }
      }
    }

    // 阶段3：贪心兜底
    if (!candidates.length) {
      const scored = allAvailable.map(s => ({ seat: s, score: _score([s]) }));
      scored.sort((a, b) => b.score - a.score);
      const group = scored.slice(0, count).map(x => x.seat);
      candidates.push({ group, score: _score(group) - 10, type: 'scattered' });
    }

    candidates.sort((a, b) => b.score - a.score);
    app._topCandidates = candidates.slice(0, 3);

    _renderOptions(app._topCandidates);
    _switchOption(0);

    const best = app._topCandidates[0];
    app.toast(best.type === 'same-row' ? '智能推荐完成' : best.type === 'multi-row' ? '已推荐前后排组合方案' : '暂无连续座位，已就近推荐');
  }

  // 推荐失败时统一清除上一次结果，避免旧座位继续显示为本次推荐。
  function _showNoResult(reason) {
    const app = A();
    app._topCandidates = [];
    SeatData.setRecommended([]);
    _renderOptions([]);

    const titleEl = $('#recommendTitle');
    const reasonEl = $('#recommendReason');
    if (titleEl) titleEl.textContent = '暂无合适座位';
    if (reasonEl) reasonEl.textContent = reason || '当前放映厅没有满足条件的未售座位。';

    const step2 = $('#step2');
    if (step2) step2.classList.remove('done');
    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  function _renderOptions(candidates) {
    const list = $('#optionList');
    const box = $('#recommendBox');
    if (box) box.classList.remove('hidden');
    if (!list) return;

    if (candidates.length <= 1) { list.classList.add('hidden'); return; }
    list.classList.remove('hidden');

    const typeLabels = { 'same-row': '同排连续', 'multi-row': '前后排组合', 'scattered': '就近优选' };

    for (let i = 0; i < 3; i++) {
      const card = $(`#opt${i + 1}`);
      if (!card) continue;
      if (i < candidates.length) {
        card.classList.remove('hidden');
        $(`#optSeats${i + 1}`).textContent = labelSeats(candidates[i].group.map(s => s.id));
        $(`#optDesc${i + 1}`).textContent = `${typeLabels[candidates[i].type] || ''} · ${candidates[i].score.toFixed(1)}分`;
      } else {
        card.classList.add('hidden');
      }
    }
  }

  function _switchOption(idx) {
    const app = A();
    const candidates = app._topCandidates;
    if (!candidates[idx]) return;

    const candidate = candidates[idx];
    SeatData.setRecommended(candidate.group.map(s => s.id));

    for (let i = 0; i < 3; i++) {
      const card = $(`#opt${i + 1}`);
      if (card) card.classList.toggle('active', i === idx);
    }

    const seatLabel = labelSeats(candidate.group.map(s => s.id));
    const titleEl = $('#recommendTitle');
    if (titleEl) titleEl.textContent = `已推荐 ${seatLabel}`;

    const rows = $$('#memberList .member-row');
    const ages = rows.map(r => classifyAge(r.querySelector('.member-age')?.value));
    const genre = $('#movieGenre') ? $('#movieGenre').value : 'action';
    const genreNames = { action: '动作片', romance: '爱情片', horror: '恐怖片', animation: '动画片', scifi: '科幻片', drama: '文艺片', documentary: '纪录片' };
    let rule = `「${genreNames[genre] || genre}」`;
    if (ages.some(a => a === 'teen'))   rule += ' · 优先避开前三排';
    if (ages.some(a => a === 'senior')) rule += ' · 优先避开后三排';

    const typeLabel = candidate.type === 'same-row'
      ? '同排连续就座，中心视角更自然'
      : candidate.type === 'multi-row'
        ? '前后排就近组合，座位紧密相邻'
        : '已从最优空位中为您挑选，座位可能较分散';

    const reasonEl = $('#recommendReason');
    if (reasonEl) reasonEl.textContent = `推荐理由：${rule}。${typeLabel}。您仍可在左侧手动调整。`;

    const step2 = $('#step2');
    if (step2) step2.classList.add('done');

    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  function switchTo(idx) { _switchOption(idx); }
  function topCandidates() { return A()._topCandidates; }

  return { recommend, labelSeats, switchTo, topCandidates };
})();
window.RecommendEngine = RecommendEngine;
