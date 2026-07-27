/* AI 观影顾问
   用户用一句话描述需求（比如"两个大学生周末看科幻片"），
   这里用关键词把话拆成 票型/人数/年龄/电影类型，填进表单后调用推荐引擎，
   再把结果用对话的方式回给用户。纯本地规则匹配，不调外部接口。
*/

const AIAdvisor = (() => {
  const A = () => window.CinemaApp;
  const $  = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // 关键词词典
  const DICT = {
    ticket: {
      // 关键词 → [票型, 默认人数]（注意：personal 用词边界，避免"两个人"误匹配"一个人"）
      '情侣|双人|约会': ['couple', 2],
      '家庭|一家|带孩子|带小孩|父母|小孩': ['family', 3],
      '团体|团建|部门|一群|班级|宿舍|几个同学|朋友一起|同事': ['group', 5],
      '我自己|独自|单独一人': ['personal', 1],
    },
    genre: {
      '科幻': 'scifi',
      '动作|打斗|战争': 'action',
      '爱情|恋爱|浪漫': 'romance',
      '恐怖|惊悚|吓人': 'horror',
      '动画|卡通|儿童片': 'animation',
      '文艺|剧情': 'drama',
      '纪录片': 'documentary',
    },
    age: {
      // 年龄定性词 → 估算年龄
      '小孩|儿童|小学生|初中生|少年': 12,
      '高中生': 16,
      '大学生|学生': 20,
      '中年': 45,
      '老人|爷爷|奶奶|老年|长者|爸妈|父母': 60,
    },
  };

  // 中文数字 → 阿拉伯数字
  const CN_NUM = { '一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
  function cnToNum(str) {
    if (!str) return null;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    // "十" "十一" "二十" "二十三"
    if (str === '十') return 10;
    if (str.startsWith('十')) return 10 + (CN_NUM[str[1]] || 0);
    if (str.endsWith('十')) return (CN_NUM[str[0]] || 0) * 10;
    if (str.includes('十')) {
      const [a, b] = str.split('十');
      return (CN_NUM[a] || 0) * 10 + (CN_NUM[b] || 0);
    }
    return CN_NUM[str] || null;
  }

  // 解析一条自然语言
  function parse(text) {
    const t = (text || '').trim();
    if (!t) return null;

    const result = {
      ticket: null,
      count: null,
      ages: [],
      genre: null,
      raw: t,
      matched: [],  // 记录命中了哪些维度，用于回复时解释
    };

    // 1. 票型 + 默认人数
    for (const [pattern, [type, count]] of Object.entries(DICT.ticket)) {
      const re = new RegExp(pattern);
      if (re.test(t)) {
        result.ticket = type;
        result.count = count;
        result.matched.push(`票型：${ {personal:'个人',couple:'情侣',family:'家庭',group:'团体'}[type] }`);
        break;
      }
    }
    // 没匹配到票型，默认个人
    if (!result.ticket) {
      result.ticket = 'personal';
      result.count = 1;
    }

    // 2. 电影类型
    for (const [pattern, genre] of Object.entries(DICT.genre)) {
      if (new RegExp(pattern).test(t)) {
        result.genre = genre;
        result.matched.push(`类型：${ {action:'动作',romance:'爱情',horror:'恐怖',animation:'动画',scifi:'科幻',drama:'文艺',documentary:'纪录'}[genre] }`);
        break;
      }
    }

    // 3. 人数 —— 支持阿拉伯数字 + 中文数字 + "X口/X人/X个"
    //   匹配 "X个人 / X人 / X位 / X口 / X个" 以及 "一家X"
    const cntPatterns = [
      /(\d+)\s*(?:个|个人|人|位|口)/,
      /([一二两三四五六七八九十]+)\s*(?:个|个人|人|位|口)/,
      /一家([一二两三四五六七八九十]+)/,
    ];
    for (const re of cntPatterns) {
      const m = t.match(re);
      if (m) {
        const n = cnToNum(m[1]);
        if (n && n >= 1 && n <= 30) {
          // "我自己一个人" 已命中 personal，不覆盖；其余情况人数优先
          if (result.ticket === 'personal' && n === 1) {
            // 保持 personal
          } else {
            result.count = n;
            result.matched.push(`人数：${n}人`);
            // 根据人数反推票型边界
            if (n === 1) result.ticket = 'personal';
            else if (n === 2 && result.ticket !== 'family') result.ticket = 'couple';
            else if (n >= 5) result.ticket = 'group';
            else if (n >= 3) result.ticket = 'family';
          }
          break;
        }
      }
    }

    // 4. 成员年龄
    // 4a. 显式数字年龄（"X岁"）
    const ageNums = [];
    let m;
    const numRe = /(\d{1,3})\s*岁/g;
    while ((m = numRe.exec(t)) !== null) {
      const a = parseInt(m[1], 10);
      if (a >= 3 && a <= 110) ageNums.push(a);
    }
    if (ageNums.length) {
      result.ages = ageNums;
    } else {
      // 4b. 定性词 → 估算年龄
      for (const [pattern, age] of Object.entries(DICT.age)) {
        if (new RegExp(pattern).test(t)) {
          result.ages.push(age);
        }
      }
    }

    // 5. 团体人数兜底：若票型是 group 但没给具体人数，用默认5
    if (result.ticket === 'group' && (!result.count || result.count < 5)) {
      result.count = Math.max(5, result.count || 5);
    }

    // 6. 年龄数组对齐人数
    if (result.ages.length === 0) {
      // 没有任何年龄信息，按票型给默认年龄
      const defaults = { personal: [20], couple: [20, 20], family: [40, 38, 10], group: [20] };
      result.ages = defaults[result.ticket] || [20];
    }
    // 年龄数不足人数时，用成年(20)补齐
    while (result.ages.length < result.count) result.ages.push(20);
    // 年龄数超出人数时截断
    if (result.ages.length > result.count) result.ages = result.ages.slice(0, result.count);

    return result;
  }

  // 把解析结果填入右侧表单
  function applyToForm(parsed) {
    const app = A();

    // 切换票型按钮
    const ticketBtn = $(`#ticketChoices .choice[data-ticket="${parsed.ticket}"]`);
    if (ticketBtn) ticketBtn.click();

    // 家庭/团体人数
    if (parsed.ticket === 'family') {
      const input = $('#familyCount');
      if (input) { input.value = parsed.count; $('#applyFamilyCount')?.click(); }
    } else if (parsed.ticket === 'group') {
      const input = $('#groupCount');
      if (input) { input.value = parsed.count; $('#applyGroupCount')?.click(); }
    }

    // 电影类型
    if (parsed.genre) {
      const sel = $('#movieGenre');
      if (sel) sel.value = parsed.genre;
    }

    // 填入成员年龄（姓名留空，推荐时按"匿名"处理）
    const ageInputs = $$('#memberList .member-age');
    parsed.ages.forEach((age, i) => {
      if (ageInputs[i]) ageInputs[i].value = age;
    });
  }

  // 生成对话式回复
  function buildReply(parsed, best) {
    const H = HallConfig.get();
    const lines = [];

    const ticketName = { personal:'个人', couple:'情侣', family:'家庭', group:'团体' }[parsed.ticket];
    lines.push(`看明白了——<b>${ticketName}</b>观影，共 <b>${parsed.count}</b> 人。`);

    if (parsed.matched.length) {
      lines.push(`(${parsed.matched.join('、')})`);
    }

    if (best && best.group && best.group.length) {
      const seatLabel = RecommendEngine.labelSeats(best.group.map(s => s.id));
      const row = best.group[0].row;
      lines.push(`帮你看了一下，<b style="color:var(--cyan)">${seatLabel}</b>（第 ${row} 排）比较合适，体验分 ${best.score}。`);

      const reasons = [];
      const hasTeen = parsed.ages.some(a => a < 15);
      const hasSenior = parsed.ages.some(a => a >= 60);
      if (hasTeen) reasons.push('少年避开了前三排');
      if (hasSenior) reasons.push('老人避开了后三排');
      if (parsed.ticket === 'couple') reasons.push('情侣走了中间连续双座');
      if (parsed.ticket === 'family') reasons.push('家庭走了中后排连续');
      if (parsed.ticket === 'group') reasons.push('团体保证同排连座');
      if (reasons.length) lines.push(`理由：${reasons.join('、')}。`);
    } else {
      lines.push('这个厅暂时排不开连续座位，换个更大的厅或者改下人数试试。');
    }

    return lines.join('<br>');
  }

  // 主入口：处理用户输入
  function consult(text) {
    const app = A();
    if (!app.user()) { app.toast('请先登录后使用AI顾问'); return null; }

    const parsed = parse(text);
    if (!parsed) { app.toast('请输入您的观影需求'); return null; }

    // 填表单
    applyToForm(parsed);

    // 触发推荐
    RecommendEngine.recommend();

    // 取推荐结果生成回复
    const candidates = RecommendEngine.topCandidates() || [];
    const best = candidates[0];
    const reply = buildReply(parsed, best);

    return { parsed, reply };
  }

  return { parse, applyToForm, buildReply, consult };
})();
window.AIAdvisor = AIAdvisor;
