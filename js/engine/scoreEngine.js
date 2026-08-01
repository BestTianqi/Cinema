/* === 观影体验评分引擎 ===
   从三个维度量化座位的观影体验：视角、距离、周围空位。

   评分体系（每维度 0-100 分）：
     viewingAngle (45%) — 水平偏离银幕中轴线的角度，越小越好
     distance     (35%) — 与最佳观影排的距离，越近越好
     vacancy      (20%) — 周围空位密度，越空旷越好
*/

const ScoreEngine = (() => {
  const cfg = () => window.CinemaConfig;
  const W = () => cfg().scoreWeights;

  /**
   * 计算单个座位的三维评分
   * @returns {{ total: number, grade: string, details: {} }}
   */
  function scoreSeat(seat, totalRows, totalCols, allSeats) {
    // 1. 视角评分：以该厅最大可能角度为基准做归一化
    const angle = Geometry.viewingAngleDeg(seat.col, seat.row, totalCols);
    const maxAngle = Math.atan2((totalCols - 1) / 2, 1 + 2) * (180 / Math.PI);
    const angleScore = Math.max(30, Math.round(100 - (angle / Math.max(maxAngle, 1)) * 70));

    // 2. 距离评分：中间排最优，两端递减
    const distScore = Geometry.distanceScore(seat.row, totalRows);

    // 3. 周围空位评分：检查8邻域已售座位
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
        vacancyScore: Math.round(vacScore),
        angleDeg: Math.round(angle * 10) / 10,
        nearSold,
      },
    };
  }

  /**
   * 批量评分
   */
  function scoreSelection(selectedIds, allSeats, totalRows, totalCols) {
    if (selectedIds.length === 0) return null;

    const seats = allSeats.filter(s => selectedIds.includes(s.id));
    const scores = seats.map(s => scoreSeat(s, totalRows, totalCols, allSeats));

    const avg = (field) => scores.reduce((a, s) => a + s.details[field], 0) / scores.length;
    const total = Math.round(
      avg('angleScore')    * W().viewingAngle +
      avg('distanceScore') * W().distance +
      avg('vacancyScore')  * W().vacancy
    );

    const grades = cfg().scoreGrades;
    const grade = total >= grades.excellent ? '极佳' : total >= grades.good ? '优秀' : '一般';

    const perSeat = seats.map((s, i) => ({
      id: s.id,
      label: `${s.row}排${s.col}座`,
      ...scores[i],
    }));

    return { total, grade, perSeat, aggregate: {
      angleScore: Math.round(avg('angleScore')),
      distanceScore: Math.round(avg('distanceScore')),
      vacancyScore: Math.round(avg('vacancyScore')),
    }};
  }

  return { scoreSeat, scoreSelection };
})();
