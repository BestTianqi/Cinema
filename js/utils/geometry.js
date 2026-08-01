/* === 几何计算工具 === */

const Geometry = (() => {

  /** 两点的欧几里得距离 */
  function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  /**
   * 水平视角偏差（度）
   * 银幕中心位于影厅中轴线上方，atan2(水平偏移 / 纵向距离) = 视角偏差
   *
   * @param {number} col - 座位列号
   * @param {number} row - 座位排号（排号越大越远）
   * @param {number} totalCols - 影厅总列数
   */
  function viewingAngleDeg(col, row, totalCols) {
    const centerCol = (totalCols + 1) / 2;
    const horz = Math.abs(col - centerCol);
    const vert = row + 2; // +2 补偿银幕到第一排的距离
    return Math.atan2(horz, vert) * (180 / Math.PI);
  }

  /**
   * 观影距离评分（0-100）
   * 中间排=100，第一排=55，最后一排=70（前排惩罚重于后排）
   */
  function distanceScore(row, totalRows) {
    if (totalRows <= 1) return 100;
    const optimal = Math.round(totalRows * 0.5);
    if (row <= optimal) {
      const t = (optimal - row) / (optimal - 1);
      return Math.round(100 - t * 45);
    } else {
      const t = (row - optimal) / (totalRows - optimal);
      return Math.round(100 - t * 30);
    }
  }

  /**
   * 水平居中评分（0-100）
   * 越靠近影厅中轴线越高
   */
  function centerScore(col, totalCols) {
    const center = (totalCols + 1) / 2;
    const maxOff = (totalCols - 1) / 2;
    const t = Math.min(Math.abs(col - center) / maxOff, 1);
    return 100 - t * 40;
  }

  /** 线性插值 */
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** 将 value 从 [inMin,inMax] 映射到 [outMin,outMax]，超出部分钳位 */
  function clampMap(value, inMin, inMax, outMin, outMax) {
    const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
    return outMin + t * (outMax - outMin);
  }

  return { distance, viewingAngleDeg, distanceScore, centerScore, lerp, clampMap };
})();
