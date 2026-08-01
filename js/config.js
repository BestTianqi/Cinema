/* 全局配置 */
window.CinemaConfig = {
  // 影厅预设
  //   cols/rows  每排座位数 / 排数
  //   groups     每排按过道分段（用于绘制走道）
  //   curve      弧形排列的弧度强度，越大越弯（标准厅 12，IMAX 厅更大）
  //   layout     布局类型：'standard' 矩形 / 'imax' 强弧形扇形
  halls: {
    small:  { name: '星海小厅', cols: 10, rows: 10, groups: [10], curve: 12, layout: 'standard' },
    medium: { name: '未来中厅', cols: 20, rows: 10, groups: [5, 10, 5], curve: 12, layout: 'standard' },
    large:  { name: '银河大厅', cols: 30, rows: 10, groups: [5, 20, 5], curve: 12, layout: 'standard' },
    // 自设计布局：IMAX 弧形巨幕厅，更强弧度模拟扇形包围银幕
    imax:   { name: 'IMAX 巨幕厅', cols: 24, rows: 12, groups: [6, 12, 6], curve: 30, layout: 'imax' },
  },
  defaultHall: 'small',

  // 票价（每座）
  pricePerSeat: 48,

  // 体验评分维度权重（合计 1.0）
  scoreWeights: {
    viewingAngle: 0.45,   // 视角偏差
    distance:     0.35,   // 观影距离
    vacancy:      0.20,   // 周围空位密度
  },

  // 评分等级阈值
  scoreGrades: {
    excellent: 80,  // ≥ 80 → 极佳
    good:      60,  // ≥ 60 → 优秀，其余为一般
  },

  // LocalStorage key
  storageKeys: {
    users:   'sc_users',
    session: 'sc_session',
    orders:  'sc_orders',
    sold:    'sc_sold',
    access:  'sc_access',
  },
};
