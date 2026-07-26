/* === 智能推荐引擎（成员A） ===
   设计目标：完全对齐作业模块1要求。
     观众分三类（按年龄）：少年(<15) / 成年(15~59) / 老年(≥60)。
     排座硬规则：
       - 少年：不能坐前 3 排
       - 老年：不能坐最后 3 排
       - 成年：可随意坐
     票型策略：
       - 个人票：单座，按硬规则+基础评分选最优
       - 情侣票：同排连续 2 座，优先中间区域
       - 家庭票：同排连续 N 座，优先中后排
       - 团体票：成员必须同一排连续，组内有少年/老人需遵循上述硬规则；
                 找不到同排连续座位时不降级，提示切换更大影厅。

   评分 = 基础观影体验评分（视角/距离/空位）+ 票型加成。
   候选生成遵循"硬规则筛选 → 票型策略打分 → 取 Top-3"流程。
*/

const RecommendEngine = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ---------- 年龄分类（作业阈值） ---------- */
  /** 年龄 → 类别 teen/adult/senior */
  function classifyAge(age) {
    const n = Number(age);
    if (!n || n <= 0) return 'adult';   // 未填写按成年处理
    if (n < 15) return 'teen';
    if (n >= 60) return 'senior';
    return 'adult';
  }

  /** 某座位对某类别观众是否违反硬规则 */
  function violatesRule(seat, category, totalRows) {
    if (category === 'teen' && seat.row <= 3) return true;       // 少年不能坐前 3 排
    if (category === 'senior' && seat.row >= totalRows - 2) return true; // 老年不能坐最后 3 排
    return false;
  }

  /** 一组座位是否违反任意成员的硬规则 */
  function groupViolates(group, categories, totalRows) {
    // 每个成员（按顺序）对应一个座位，检查是否违规
    for (let i = 0; i < group.length; i++) {
      if (i < categories.length && violatesRule(group[i], categories[i], totalRows)) return true;
    }
    // 另外只要组内存在该类别人群，则整组所在排都不能落在禁区
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    if (hasTeen && group.some(s => s.row <= 3)) return true;
    if (hasSenior && group.some(s => s.row >= totalRows - 2)) return true;
    return false;
  }

  /* ---------- 座位排序标签 ---------- */
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
      // 情侣：中间区域连续双座 —— 越靠近中轴线加分越高
      bonus += Math.round((1 - Math.abs(avgCol - centerCol) / (hall.cols / 2)) * 25);
    } else if (ticket === 'family') {
      // 家庭：优先中后排（row 在 中排~中后排 区间加分）
      const midRow = hall.rows * 0.5;
      if (avgRow >= midRow && avgRow <= hall.rows * 0.75) bonus += 18;
    } else if (ticket === 'group') {
      // 团体：同排居中（已在候选阶段保证同排连续）
      bonus += Math.round((1 - Math.abs(avgCol - centerCol) / (hall.cols / 2)) * 15);
    }
    // 个人票不加票型加成，纯按基础评分（成年"随意坐"）

    return Math.round(baseAvg + bonus);
  }

  /* ---------- 同排连续座位枚举 ---------- */
  /** 返回 hall 内所有"从某排某列起、长度 count、同排连续且全部可选"的座位组 */
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

  /* ---------- 主推荐流程 ---------- */
  function recommend() {
    const app = A();
    if (!app.user()) { app.toast('请先登录'); return; }

    // 读取成员：姓名 + 年龄
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
    if (count > H.cols * H.rows) { app.toast('当前放映厅无足够座位'); return; }

    const seats = SeatData.all();
    const allAvailable = seats.filter(s => !s.sold);
    if (allAvailable.length < count) { app.toast('当前放映厅剩余空位不足'); return; }

    const ticket = app.ticket;
    let candidates = [];

    if (count === 1) {
      // 个人票（情侣/家庭/团体人数调到1时也走此分支）：单座 + 硬规则
      const valid = allAvailable.filter(s => !violatesRule(s, categories[0], H.rows));
      valid.sort((a, b) =>
        scoreGroup([b], H, seats, ticket, categories) - scoreGroup([a], H, seats, ticket, categories));
      candidates = valid.slice(0, 3).map(g => ({ group: [g], type: 'single', score: scoreGroup([g], H, seats, ticket, categories) }));
    } else {
      // 多人票：必须同排连续（作业要求）
      const runs = sameRowRuns(seats, H, count, categories);
      if (runs.length === 0) {
        // 同排连续不可得 —— 不降级
        const reason = _noRunReason(ticket, categories, H, count);
        app.toast(reason.toast);
        // 仍尝试给一个提示性推荐（无候选时清空）
        app._topCandidates = [];
        _renderOptions([]);
        _switchOption(-1);
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

    const best = candidates[0];
    app.toast(_resultToast(ticket, categories, best, H));
  }

  /* ---------- 无同排连续候选时的原因文案 ---------- */
  function _noRunReason(ticket, categories, H, count) {
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    let msg = `当前${H.name}无满足「同排连续 ${count} 座」的空位`;
    if (hasTeen) msg += '，且需避开前 3 排';
    if (hasSenior) msg += '，且需避开后 3 排';
    msg += '，请尝试切换更大的放映厅或减少人数';
    return { toast: msg };
  }

  /* ---------- 推荐完成提示 ---------- */
  function _resultToast(ticket, categories, best, H) {
    if (!best) return '暂无可推荐座位';
    const hasTeen = categories.includes('teen');
    const hasSenior = categories.includes('senior');
    if (ticket === 'group') {
      if (hasTeen || hasSenior) return '已锁定同排连续座位，并已照顾老年/少年成员的排数限制';
      return '已锁定同排连续座位';
    }
    if (ticket === 'couple') return '已推荐中间区域连续双座';
    if (ticket === 'family') return '已推荐中后排连续座位';
    if (hasTeen) return '已避开前 3 排，为您推荐合适座位';
    if (hasSenior) return '已避开后 3 排，为您推荐合适座位';
    return '智能推荐完成';
  }

  /* ---------- 渲染 Top-3 备选卡片 ---------- */
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
        const typeMap = { 'single': '单座优选', 'same-row': '同排连续' };
        $(`#optDesc${i + 1}`).textContent = `${typeMap[candidates[i].type] || ''} · ${candidates[i].score}分`;
      } else {
        card.classList.add('hidden');
      }
    }
  }

  /* ---------- 切换到第 idx 个方案并生成逐条理由 ---------- */
  function _switchOption(idx) {
    const app = A();
    const candidates = app._topCandidates;

    // idx === -1：无候选，清空推荐
    if (idx < 0 || !candidates[idx]) {
      SeatData.setRecommended([]);
      const titleEl = $('#recommendTitle');
      const reasonEl = $('#recommendReason');
      if (titleEl) titleEl.textContent = '暂无满足条件的推荐方案';
      if (reasonEl) reasonEl.textContent = '当前影厅没有满足排座规则的连续座位，请切换更大放映厅或调整人数。';
      EventBus.emit('seats:changed');
      EventBus.emit('canvas:redraw');
      return;
    }

    const candidate = candidates[idx];
    SeatData.setRecommended(candidate.group.map(s => s.id));

    for (let i = 0; i < 3; i++) {
      const card = $(`#opt${i + 1}`);
      if (card) card.classList.toggle('active', i === idx);
    }

    const seatLabel = labelSeats(candidate.group.map(s => s.id));
    const titleEl = $('#recommendTitle');
    if (titleEl) titleEl.textContent = `已推荐 ${seatLabel}`;

    const reason = _buildReason(candidate, app);
    const reasonEl = $('#recommendReason');
    if (reasonEl) reasonEl.innerHTML = reason;

    const step2 = $('#step2');
    if (step2) step2.classList.add('done');

    EventBus.emit('seats:changed');
    EventBus.emit('canvas:redraw');
  }

  /* ---------- 逐条推荐理由 ---------- */
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
    const sameRow = seatRows.length === 1;
    const avgRow = candidate.group.reduce((a, s) => a + s.row, 0) / candidate.group.length;
    const avgCol = candidate.group.reduce((a, s) => a + s.col, 0) / candidate.group.length;
    const centerCol = (H.cols + 1) / 2;

    const lines = [];

    // 1. 票型/排型说明
    if (ticket === 'couple') {
      const offCenter = Math.abs(avgCol - centerCol);
      lines.push(`<b>情侣票</b>：已安排同排连续双座${offCenter < H.cols * 0.15 ? '，位于影厅中轴线附近，居中视角最佳' : '，尽量靠近中间区域'}`);
    } else if (ticket === 'family') {
      lines.push(`<b>家庭票</b>：已安排同排连续 ${candidate.group.length} 座，位于第 ${Math.round(avgRow)} 排（中后排，观影距离适中）`);
    } else if (ticket === 'group') {
      lines.push(`<b>团体票</b>：共 ${candidate.group.length} 人已锁定第 ${seatRows[0]} 排连续座位（成员不分开，同一排就座）`);
    } else {
      lines.push(`<b>个人票</b>：已按观影体验评分为您挑选最优单座`);
    }

    // 2. 老人/少年照顾说明
    const teens = members.filter(m => m.category === 'teen');
    const seniors = members.filter(m => m.category === 'senior');
    if (teens.length) {
      lines.push(`检测到 <b>${teens.length}</b> 位少年（&lt;15岁），已避开前 3 排以保护视力`);
    }
    if (seniors.length) {
      lines.push(`检测到 <b>${seniors.length}</b> 位老年（≥60岁），已避开最后 3 排以方便进出`);
    }

    // 3. 体验分概览
    lines.push(`综合体验评分 <b style="color:var(--cyan)">${candidate.score}</b> 分`);

    return lines.join('<br>');
  }

  function switchTo(idx) { _switchOption(idx); }
  function topCandidates() { return A()._topCandidates; }

  return { recommend, labelSeats, switchTo, topCandidates, classifyAge, violatesRule };
})();
window.RecommendEngine = RecommendEngine;
