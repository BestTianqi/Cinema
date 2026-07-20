/* === 全局配置 === */
window.CinemaConfig = {
  // 影厅预设
  halls: {
    small:  { name: '星海小厅', cols: 10, rows: 10 },
    medium: { name: '未来中厅', cols: 20, rows: 10 },
    large:  { name: '银河大厅', cols: 30, rows: 10 },
  },
  defaultHall: 'small',

  // 票价（每座）
  pricePerSeat: 48,

  // 体验评分维度权重（合计 1.0）
  scoreWeights: {
    viewingAngle: 0.35,   // 视角偏差
    distance:     0.30,   // 观影距离
    centerOffset: 0.15,   // 水平居中
    vacancy:      0.20,   // 周围空位密度
  },

  // 评分等级阈值
  scoreGrades: {
    excellent: 80,  // ≥ 80 → 极佳
    good:      60,  // ≥ 60 → 优秀，其余为一般
  },

  // 最佳观影排比例（总排数 × ratio = 最佳排）
  optimalRowRatio: 0.5,

  // LocalStorage key
  storageKeys: {
    users:   'sc_users',
    session: 'sc_session',
    orders:  'sc_orders',
    sold:    'sc_sold',
    access:  'sc_access',
  },
};
