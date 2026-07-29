/* 智能推荐引擎
   按作业模块1的要求实现排座：
     年龄分三档 —— 少年(<15) / 成年(15~59) / 老年(≥60)
     排座规则 —— 少年不坐前3排、老人不坐后3排、成年人随便坐
     票型 —— 个人单座；情侣中间连续双座；家庭中后排连续；团体必须同一排连续
   找不到满足条件的座位时不硬塞，直接提示用户换厅或改人数。
*/

const RecommendEngine = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // 年龄转类别（作业里的阈值：15岁以下少年，60岁以上老人）
  function classifyAge(age) {
    const n = Number(age);
    if (!n || n <= 0) return 'adult';   // 没填年龄就当成年
    if (n < 15) return 'teen';
    if (n >= 60) return 'senior';
    return 'adult';
  }

  // 某个座位对这个类别的观众是否违规
  function violatesRule(seat, category, totalRows) {
    if (category === 'teen' && seat.row <= 3) return true;              // 少年不坐前3排
    if (category === 'senior' && seat.row >= totalRows - 2) return true; // 老人不坐后3排
    return false;
  }

  // 一组座位里有没有人违规（组内有少年就整组不落前3排，有老人就不落后3排）
  function groupViolates(group, categories, totalRows) {
    for (let i = 0; i < group.length; i++) {
      if (i < categories.length && violatesRule(group[i], categories[i], totalRows)) return true;
    }
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    if (hasTeen && group.some(s => s.row <= 3)) return true;
    if (hasSenior && group.some(s => s.row >= totalRows - 2)) return true;
    return false;
  }

  // 座位号转成"X排Y座"的展示文字
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

  /* ---------- 单组座位综合评分 ---------- */
  function scoreGroup(group, hall, allSeats, ticket, categories) {
    if (!group.length) return -Infinity;

    // 基础观影体验评分均值
    const perSeat = group.map(s => ScoreEngine.scoreSeat(s, hall.rows, hall.cols, allSeats));
    const baseAvg = perSeat.reduce((a, x) => a + x.total, 0) / perSeat.length;

    // 票型加成
    let bonus = 0;
    const centerCol = (hall.cols + 1) / 2;
    const avgCol = group.reduce((a, s) => a + s.col, 0) / group.length;
    const avgRow = group.reduce((a, s) => a + s.row, 0) / group.length;

    if (ticket === 'couple') {
      // 情侣越靠中轴线越好
      bonus += Math.round((1 - Math.abs(avgCol - centerCol) / (hall.cols / 2)) * 25);
    } else if (ticket === 'family') {
      // 家庭偏好中后排
      const midRow = hall.rows * 0.5;
      if (avgRow >= midRow && avgRow <= hall.rows * 0.75) bonus += 18;
    } else if (ticket === 'group') {
      // 团体也尽量居中
      bonus += Math.round((1 - Math.abs(avgCol - centerCol) / (hall.cols / 2)) * 15);
    }
    // 个人票不额外加成，直接看体验分

    return Math.round(baseAvg + bonus);
  }

  // 找出所有"同排连续 count 个空位"的组合，并按硬规则过滤
  function sameRowRuns(allSeats, hall, count, categories) {
    const runs = [];
    for (let r = 1; r <= hall.rows; r++) {
      for (let st = 1; st <= hall.cols - count + 1; st++) {
        const group = [];
        for (let c = st; c < st + count; c++) {
          group.push(allSeats.find(s => s.row === r && s.col === c));
        }
        if (group.every(s => s && !s.sold)) {
          // 硬规则过滤：组所在排不得落在少年/老人禁区
          if (groupViolates(group, categories, hall.rows)) continue;
          runs.push(group);
        }
      }
    }
    return runs;
  }

  // 主推荐流程
  function recommend() {
    const app = A();
    if (!app.user()) { app.toast('请先登录'); return; }

    // 读表单里的成员信息（姓名+年龄）
    const rows = $$('#memberList .member-row');
    if (!rows.length) { app.toast('请先选择票型'); return; }

    const members = rows.map(r => {
      const nameInput = r.querySelector('.member-name');
      const ageInput  = r.querySelector('.member-age');
      return {
        name: (nameInput?.value || '').trim() || '匿名',
        age: Number(ageInput?.value) || 0,
        category: classifyAge(ageInput?.value),
      };
    });
    const count = members.length;
    const categories = members.map(m => m.category);

    const hall = HallConfig.get();
    const H = hall;
    if (count > H.cols * H.rows) {
      _showNoResult('当前影厅的座位总数不足，请减少人数或更换影厅。');
      app.toast('暂无合适的座位');
      return;
    }

    const seats = SeatData.all();
    const allAvailable = seats.filter(s => !s.sold);
    if (allAvailable.length < count) {
      _showNoResult(`当前影厅只剩 ${allAvailable.length} 个未售座位，无法安排 ${count} 人。`);
      app.toast('暂无合适的座位');
      return;
    }

    const ticket = app.ticket;
    let candidates = [];

    if (count === 1) {
      // 一个人：单座，先按硬规则过滤再按体验分排序
      const valid = allAvailable.filter(s => !violatesRule(s, categories[0], H.rows));
      valid.sort((a, b) =>
        scoreGroup([b], H, seats, ticket, categories) - scoreGroup([a], H, seats, ticket, categories));
      candidates = valid.slice(0, 3).map(g => ({ group: [g], type: 'single', score: scoreGroup([g], H, seats, ticket, categories) }));
    } else {
      // 多人：必须同排连续（作业要求团体/家庭/情侣都得连着坐）
      const runs = sameRowRuns(seats, H, count, categories);
      if (runs.length === 0) {
        // 没有满足条件的连续座位，不硬塞散座
        const reason = _noRunReason(ticket, categories, H, count);
        _showNoResult(reason);
        app.toast('暂无合适的座位');
        return;
      }
      candidates = runs
        .map(g => ({ group: g, type: 'same-row', score: scoreGroup(g, H, seats, ticket, categories) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }

    app._topCandidates = candidates;
    _renderOptions(candidates);
    _switchOption(0);

    app.toast(_resultToast(ticket, categories, candidates[0], H));
  }

  // 统一处理“无可推荐座位”，同时清除上一次的推荐，避免旧结果残留。
  function _showNoResult(reason) {
    const app = A();
    app._topCandidates = [];
    _renderOptions([]);
    SeatData.setRecommended([]);

    const titleEl = $('#recommendTitle');
    const reasonEl = $('#recommendReason');
    if (titleEl) titleEl.textContent = '暂无合适的座位';
    if (reasonEl) reasonEl.textContent = reason || '当前影厅没有满足条件的未售座位。';

    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  // 找不到连续座位时的提示文案
  function _noRunReason(ticket, categories, H, count) {
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    let msg = `${H.name}没有连续 ${count} 个空位`;
    if (hasTeen) msg += '（还要避开前3排）';
    if (hasSenior) msg += '（还要避开后3排）';
    msg += '，换个更大的厅或者减少人数试试';
    return msg;
  }

  // 推荐完成后的 toast 文案
  function _resultToast(ticket, categories, best, H) {
    if (!best) return '暂无合适的座位';
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    if (ticket === 'group') {
      return hasTeen || hasSenior ? '已安排同排连座，并照顾了老人/少年的排数' : '已安排同排连座';
    }
    if (ticket === 'couple') return '中间区域连续双座';
    if (ticket === 'family') return '中后排连续座位';
    if (hasTeen) return '已避开前3排';
    if (hasSenior) return '已避开后3排';
    return '推荐完成';
  }

  // 渲染右侧的备选方案卡片（最多3个）
  function _renderOptions(candidates) {
    const list = $('#optionList');
    const box = $('#recommendBox');
    if (box) box.classList.remove('hidden');
    if (!list) return;

    if (candidates.length <= 1) { list.classList.add('hidden'); return; }
    list.classList.remove('hidden');

    for (let i = 0; i < 3; i++) {
      const card = $(`#opt${i + 1}`);
      if (!card) continue;
      if (i < candidates.length) {
        card.classList.remove('hidden');
        $(`#optSeats${i + 1}`).textContent = labelSeats(candidates[i].group.map(s => s.id));
        const typeMap = { 'single': '单座', 'same-row': '同排连续' };
        $(`#optDesc${i + 1}`).textContent = `${typeMap[candidates[i].type] || ''} · ${candidates[i].score}分`;
      } else {
        card.classList.add('hidden');
      }
    }
  }

  // 切换到第 idx 个方案，并刷新画布和理由
  function _switchOption(idx) {
    const app = A();
    const candidates = app._topCandidates || [];

    // idx < 0 表示没找到合适座位，清空推荐区
    if (idx < 0 || !candidates[idx]) {
      _showNoResult('当前影厅没有满足排座规则的未售座位，请更换影厅或调整人数。');
      return;
    }

    const candidate = candidates[idx];
    const liveSeats = new Map(SeatData.all().map(s => [s.id, s]));
    const stillAvailable = candidate.group.every(s => {
      const current = liveSeats.get(s.id);
      return current && !current.sold;
    });
    if (!stillAvailable) {
      _showNoResult('该方案中的座位刚刚已售出，请重新点击智能推荐。');
      app.toast('推荐座位已售出，请重新推荐');
      return;
    }
    SeatData.setRecommended(candidate.group.map(s => s.id));

    for (let i = 0; i < 3; i++) {
      const card = $(`#opt${i + 1}`);
      if (card) card.classList.toggle('active', i === idx);
    }

    const seatLabel = labelSeats(candidate.group.map(s => s.id));
    const titleEl = $('#recommendTitle');
    if (titleEl) titleEl.textContent = `推荐 ${seatLabel}`;

    const reasonEl = $('#recommendReason');
    if (reasonEl) reasonEl.innerHTML = _buildReason(candidate, app);

    const step2 = $('#step2');
    if (step2) step2.classList.add('done');

    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  // 拼推荐理由，会说明排数选择的依据
  function _buildReason(candidate, app) {
    const rows = $$('#memberList .member-row');
    const members = rows.map(r => {
      const nameInput = r.querySelector('.member-name');
      const ageInput  = r.querySelector('.member-age');
      return {
        name: (nameInput?.value || '').trim() || '匿名',
        category: classifyAge(ageInput?.value),
      };
    });
    const ticket = app.ticket;
    const H = HallConfig.get();
    const seatRows = [...new Set(candidate.group.map(s => s.row))];
    const avgRow = candidate.group.reduce((a, s) => a + s.row, 0) / candidate.group.length;
    const avgCol = candidate.group.reduce((a, s) => a + s.col, 0) / candidate.group.length;
    const centerCol = (H.cols + 1) / 2;

    const lines = [];

    // 票型对应的排座说明
    if (ticket === 'couple') {
      const offCenter = Math.abs(avgCol - centerCol);
      lines.push(`<b>情侣票</b>：同排连续双座，${offCenter < H.cols * 0.15 ? '在中轴线附近，视角比较正' : '尽量靠中间'}`);
    } else if (ticket === 'family') {
      lines.push(`<b>家庭票</b>：第 ${Math.round(avgRow)} 排连续 ${candidate.group.length} 座（中后排，距离适中）`);
    } else if (ticket === 'group') {
      lines.push(`<b>团体票</b>：${candidate.group.length} 人都在第 ${seatRows[0]} 排（同排连座，不分开）`);
    } else {
      lines.push(`<b>个人票</b>：按体验分挑了个不错的座位`);
    }

    // 有没有需要照顾的老人/少年
    const teens = members.filter(m => m.category === 'teen');
    const seniors = members.filter(m => m.category === 'senior');
    if (teens.length) {
      lines.push(`有 <b>${teens.length}</b> 位少年（&lt;15岁），避开了前 3 排`);
    }
    if (seniors.length) {
      lines.push(`有 <b>${seniors.length}</b> 位老人（≥60岁），避开了后 3 排`);
    }

    lines.push(`体验分 <b style="color:var(--cyan)">${candidate.score}</b> 分`);

    return lines.join('<br>');
  }

  function switchTo(idx) { _switchOption(idx); }
  function topCandidates() { return A()._topCandidates; }

  return { recommend, labelSeats, switchTo, topCandidates, classifyAge, violatesRule };
})();
window.RecommendEngine = RecommendEngine;
