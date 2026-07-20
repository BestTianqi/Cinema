/* === 观影体验评分引擎 ===
   从四个维度量化座位的观影体验：视角、距离、居中、周围空位。

   评分体系（每维度 0-100 分）：
     viewingAngle (35%) — 水平偏离银幕中轴线的角度，越小越好
     distance     (30%) — 与最佳观影排的距离，越近越好
     centerOffset (15%) — 水平居中程度，越中间越好
     vacancy      (20%) — 周围空位密度，越空旷越好
*/

const ScoreEngine = (() => {
  const cfg = () => window.CinemaConfig;
  const W = () => cfg().scoreWeights;

  /**
   * 计算单个座位的四维评分
   * @returns {{ total: number, grade: string, details: {} }}
   */
  function scoreSeat(seat, totalRows, totalCols, allSeats) {
    // 1. 视角评分：角度越小越高分
    const angle = Geometry.viewingAngleDeg(seat.col, seat.row, totalCols);
    const angleScore = Math.max(30, 100 - angle * 2.0); // 0°→100, 35°→30

    // 2. 距离评分
    const distScore = Geometry.distanceScore(seat.row, totalRows);

    // 3. 水平居中评分
    const cntrScore = Geometry.centerScore(seat.col, totalCols);

    // 4. 周围空位评分：检查8邻域已售座位
    const nearSold = allSeats.filter(o =>
      o.sold &&
      Math.abs(o.row - seat.row) <= 1 &&
      Math.abs(o.col - seat.col) <= 1
    ).length;
    const vacScore = Math.max(30, 100 - nearSold * 9);  // 0个→100, 8个→28

    const w = W();
    const total = Math.round(
      angleScore * w.viewingAngle +
      distScore  * w.distance +
      cntrScore  * w.centerOffset +
      vacScore   * w.vacancy
    );

    const grades = cfg().scoreGrades;
    const grade = total >= grades.excellent ? '极佳' : total >= grades.good ? '优秀' : '一般';

    return {
      total,
      grade,
      details: {
        angleScore: Math.round(angleScore),
        distanceScore: Math.round(distScore),
        centerScore: Math.round(cntrScore),
        vacancyScore: Math.round(vacScore),
        angleDeg: Math.round(angle * 10) / 10,
        nearSold,
      },
    };
  }

  /**
   * 批量评分：对已选座位中的每个座位单独评分，然后取平均值
   * @param {string[]} selectedIds - 已选座位 id 集合
   * @param {Array} allSeats       - 全部座位数据
   * @param {number} totalRows     - 总排数
   * @param {number} totalCols     - 总列数
   * @param {number} userRating    - 用户评分（1-5），占最终得分的 20%
   */
  function scoreSelection(selectedIds, allSeats, totalRows, totalCols, userRating = 5) {
    if (selectedIds.length === 0) return null;

    const seats = allSeats.filter(s => selectedIds.includes(s.id));
    const scores = seats.map(s => scoreSeat(s, totalRows, totalCols, allSeats));

    // 各维度取平均值
    const avg = (field) => scores.reduce((a, s) => a + s.details[field], 0) / scores.length;
    const sysScore = Math.round(
      avg('angleScore')    * W().viewingAngle +
      avg('distanceScore') * W().distance +
      avg('centerScore')   * W().centerOffset +
      avg('vacancyScore')  * W().vacancy
    );

    // 系统评分 80% + 用户自评 20%
    const userScore = userRating * 20; // 1星=20, 5星=100
    const total = Math.round(sysScore * 0.8 + userScore * 0.2);

    const grades = cfg().scoreGrades;
    const grade = total >= grades.excellent ? '极佳' : total >= grades.good ? '优秀' : '一般';

    // 逐座评分详情
    const perSeat = seats.map((s, i) => ({
      id: s.id,
      label: `${s.row}排${s.col}座`,
      ...scores[i],
    }));

    return {
      total,
      grade,
      perSeat,
      aggregate: {
        angleScore: Math.round(avg('angleScore')),
        distanceScore: Math.round(avg('distanceScore')),
        centerScore: Math.round(avg('centerScore')),
        vacancyScore: Math.round(avg('vacancyScore')),
      },
    };
  }

  /**
   * 生成评分解释文案
   */
  function explain(result) {
    if (!result) return { title: '--', body: '选择座位后，将从视角、距离和周围空位三个维度计算体验评分。' };
    const { grade, total, aggregate: a } = result;
    const titles = { '极佳': '黄金观影位', '优秀': '不错的观影位', '一般': '建议调整座位' };
    const body = `综合评分 ${total} 分 · ${grade}。`
      + `视角 ${a.angleScore}分 · 距离 ${a.distanceScore}分 · 居中 ${a.centerScore}分 · 空位 ${a.vacancyScore}分。`
      + (grade === '极佳' ? '这是影厅最佳观影区域之一！' :
         grade === '优秀' ? '观影体验良好，适合大多数观众。' :
         '可以试试更靠近中间的座位来获得更好的体验。');
    return { title: titles[grade], body };
  }

  return { scoreSeat, scoreSelection, explain };
})();
