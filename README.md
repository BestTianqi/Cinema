# SmartCinema 智能影院选座系统

> "Don't Make Me Think" — 3 步完成选座购票

## 项目简介

面向大学生、情侣、家庭、老年人及团体观众，通过智能推荐、热度地图和观影评分，帮助用户快速找到最佳座位。纯前端实现，零后端依赖。

## 快速启动

```bash
# 直接打开 index.html 即可（Chrome / Edge / Firefox）
# 或使用 Live Server
npx serve .
```

## 技术栈

| 层        | 技术                        |
| --------- | --------------------------- |
| 结构/样式 | HTML5 + CSS3（CSS 变量主题） |
| 逻辑      | Vanilla JavaScript (ES6+)   |
| 绘图      | Canvas API（无第三方图表库）  |
| 存储      | LocalStorage                |
| 响应式    | PC / iPad / 手机            |

## 项目结构

```
index.html              # 单页入口（主逻辑内联 ~2600 行）
js/
  config.js             # 全局配置（影厅、票价、权重、阈值）
  main.js               # 模块初始化、事件绑定
  data/
    seatData.js         # 座位状态（单一事实来源）
    hallConfig.js       # 影厅配置管理
    orderStorage.js     # 订单 CRUD（LocalStorage）
  engine/
    scoreEngine.js      # 观影体验评分引擎
    heatmapEngine.js    # 热度数据计算
    recommendEngine.js  # （预留）
  render/
    canvasRenderer.js   # Canvas 座位图绘制
    heatmapRenderer.js  # 热度图层
    interactionLayer.js # 悬停/选中交互
  ui/
    recommendPanel.js   # 推荐面板（备选方案渲染）
    orderPanel.js       # 订单侧栏
    scorePanel.js       # 评分详情面板
    accessibilityPanel.js # 无障碍模式
  utils/
    eventBus.js         # 发布订阅
    geometry.js         # 视角、距离、居中计算
```

## 6 大功能模块

### 1. 智能推荐选座

- **输入**：成员年龄类别（青少年/成年人/老年人）、人数、电影类型
- **输出**：Top-3 推荐方案，可切换
- **评分公式**：每个座位独立计算观影体验评分取平均，叠加推荐策略加成/惩罚

| 因子           | 影响                              |
| -------------- | --------------------------------- |
| 年龄约束（减分） | 青少年坐前三排 −30/座，老年人坐后三排 −30/座 |
| 过道惩罚       | 跨分区座位 −3                     |
| 同排连续       | +15                               |
| 相邻排组合     | +8（重叠）/ +3（紧邻）             |
| 情侣/家庭票    | 中后排加分（$\sqrt{}$ 开方递减）    |

### 2. 手动选座

- 点击单选 / 拖拽框选 / 滚轮缩放 / 拖动画布
- 分区弧形布局（中厅 `[5,10,5]` 三区 + 过道）
- 排号标注、中轴线、银幕曲线

### 3. 影院热度地图

- Canvas 热度图层叠加
- 红（热门）→ 黄（一般）→ 绿（冷门）
- 数据基于用户选座行为累积

### 4. 观影体验评分

三维加权评分（与 ScoreEngine 一致）：

| 维度   | 权重 | 核心逻辑                                    |
| ------ | ---- | ------------------------------------------- |
| 视角   | 35%  | $\theta = \arctan2(\|col - center\|, row+2)$ |
| 距离   | 30%  | 中间排最优，两端递减（**非越近越好**）        |
| 空位   | 20%  | 8 邻域已售座位越少越高                       |

- **≥80** 极佳 / **≥60** 优秀 / **<60** 一般
- 多座位时各维度取平均后加权

### 5. 无障碍模式

- 大字体 / 高对比度 / 色盲友好 / 语音提示
- CSS 变量切换主题，一键生效

### 6. 订单中心

- 选座 → 扫码支付 → 出票（3 步闭环）
- 微信/支付宝/PayPal/银联/Apple Pay/银行卡 6 种支付方式
- 支持退票（释放座位）
- 订单按用户过滤（admin 看全部）

## 设计语言

深色科技风，参考 Apple / Tesla / OpenAI：

| 元素     | 色值      |
| -------- | --------- |
| 主背景   | `#070a12` |
| 面板     | `#111725` |
| 电光青   | `#65e7ff` |
| 电光蓝   | `#6579ff` |
| 空座绿   | `#32d583` |
| 已选黄   | `#fdbf47` |
| 已售红   | `#f35f67` |
| 推荐紫   | `#a77dff` |

所有图标来自 [simple-icons@13](https://github.com/simple-icons/simple-icons) CDN，二维码由 [qrserver.com](https://goqr.me/api/) 实时生成。
