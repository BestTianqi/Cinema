/* === 几何计算工具 === */

const Geometry = (() => {

  /**
   * 水平视角偏差（度）
   * 银幕中心位于影厅中轴线上方，atan2(水平偏移 / 纵向距离) = 视角偏差
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

  return { viewingAngleDeg, distanceScore };
})();
