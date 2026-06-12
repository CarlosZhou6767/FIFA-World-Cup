# 2026 年美加墨世界杯赛事追踪

<p align="center">
  <strong>美国 · 加拿大 · 墨西哥</strong><br>
  <em>2026 年 6 月 11 日 — 7 月 19 日</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-yellow" alt="JavaScript">
  <img src="https://img.shields.io/badge/HTML-5-orange" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS-3-blue" alt="CSS3">
  <img src="https://img.shields.io/badge/Chart.js-4.4-green" alt="Chart.js">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

---

一个轻量级、零依赖的 2026 年 FIFA 世界杯赛事追踪单页应用。提供实时比分、小组积分榜、赔率驱动预测和赔率趋势分析四大功能模块，所有数据均来自 ESPN 公开 API，无需后端服务、无需构建工具、无需 API 密钥，打开即用。

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [安装指南](#安装指南)
- [使用教程](#使用教程)
- [项目结构](#项目结构)
- [架构设计](#架构设计)
- [配置选项](#配置选项)
- [数据来源](#数据来源)
- [API 参考](#api-参考)
- [设计系统](#设计系统)
- [浏览器支持](#浏览器支持)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 功能特性

### 1. 赛程

- 展示全部 **104 场比赛**，覆盖 12 个小组和 5 轮淘汰赛，按日期分组
- 支持多维度筛选：按阶段、小组、日期和队名搜索
- 比赛卡片展示对阵双方国旗、北京时间（UTC+8）、场馆城市和阶段标签
- 实时状态标记：`未开始` / `进行中` / `已结束`，同步显示比分
- **每 30 秒**从 ESPN 轮询最新比分和比赛状态
- 手动刷新按钮，内置 180 秒倒计时提示

### 2. 积分榜

- **12 个小组（A–L）**自动计算排名
- 排序规则：积分 → 净胜球 → 进球数 → 胜负关系
- 仅支持手动刷新，不进行自动轮询，避免无效 API 请求
- 基于 ESPN 实时比赛数据动态同步

### 3. 预测分析

- **赔率驱动预测**：基于 ESPN 实时赔率，使用多数据源聚合算法生成预测
- **8 大算法优化**：
  - 多数据源聚合：中位数算法消除单一平台偏差
  - 庄家利润去除：乘法去除法提取真实概率
  - 赔率变动分析：检测 Sharp Money（聪明资金）信号
  - 信心度校准：综合多因素计算校准后信心度
  - 跨盘口融合：利用让球盘和大小球赔率辅助修正
  - 价值投注检测：对比真实概率与赔率隐含概率
  - 5 级梯度降级：无赔率时使用分档概率矩阵
  - 动态热门预测：基于实时数据生成热门比赛列表
- 每场比赛展示实时隐含概率条（主胜 / 平局 / 客胜）
- 赔率面板展示 ESPN 提供的独赢（Moneyline）赔率

### 4. 赔率分析中心

- 交互式趋势图（Chart.js）展示赔率历史走势
- 数据源：DraftKings（ESPN API 返回）
- **赔率类型**：独赢 / 让球 / 大小球
- 单场比赛深入分析，包含完整赔率明细弹窗
- 数据导出功能，支持离线分析

---

## 快速开始

### 环境要求

- 现代浏览器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+）
- 网络连接（用于 ESPN API 和 Google Fonts）
- 无需服务器、构建工具或 npm 依赖

### 一键启动

用浏览器打开 `index.html` 即可。应用会立即加载并开始获取实时数据。

ESPN 公开 API 支持 `file://` 协议下的跨域请求，因此无需搭建本地服务器。

---

## 安装指南

### 方式一：克隆仓库

```bash
git clone https://github.com/CarlosZhou6767/FIFA-World-Cup.git
cd FIFA-World-Cup
```

然后用浏览器打开 `index.html`。

### 方式二：下载 ZIP 压缩包

1. 在仓库页面点击绿色的 **Code** 按钮
2. 选择 **Download ZIP**
3. 解压后打开 `index.html`

### 方式三：使用本地服务器（可选）

如需通过 HTTP 协议访问（例如测试 CSP 安全策略），可启动本地静态服务器：

```bash
# Python 3
python -m http.server 8080

# Node.js（npx）
npx serve .

# 或使用任意其他静态文件服务器
```

然后访问 `http://localhost:8080`。

---

## 使用教程

### 视图导航

顶部导航栏提供四个主要视图，点击即可切换：

| 标签 | 展示内容 | 适用场景 |
|------|----------|----------|
| **赛程** | 全部 104 场比赛按日期分组 | 追踪比赛时间线、查看比分 |
| **积分榜** | 12 个小组的排名表格 | 了解各小组出线形势 |
| **预测分析** | 即将比赛的概率条和赔率 | 评估赔率数据、发现价值投注 |
| **赔率趋势** | 历史赔率走势图与关键节点 | 分析赔率变动、检测聪明资金信号 |

### 赛程筛选

在赛程页面，你可以使用以下筛选器快速定位目标比赛：

1. **比赛阶段** — 筛选小组赛、32 强、16 强、8 强、半决赛等
2. **小组** — 聚焦特定小组（A–L）
3. **日期** — 选择特定比赛日
4. **搜索** — 输入队伍名称（如"巴西"、"Germany"）即时搜索

点击 **清除筛选** 按钮可一键重置所有筛选条件。

### 查看比赛详情

点击任意比赛卡片，弹出详情窗口，展示以下信息：
- 对阵双方名称与国旗
- 比赛时间（同时显示北京时间 UTC+8 和场馆当地时间）
- 场馆信息（体育场、城市、国家）
- 比赛阶段和小组
- 实时比分或比赛状态

### 预测卡片

在预测分析页面，每张比赛卡片展示：
- **概率条** — 主胜 / 平局 / 客胜的概率可视化对比
- **赔率数据** — 来自 ESPN 的独赢赔率
- **热门预测标记** — 信号强烈的比赛会被高亮标记

点击预测卡片可打开赔率详情弹窗，查看各平台的完整赔率对比。

### 赔率分析

1. 在下拉菜单中选择**比赛**
2. 选择**赔率类型**（独赢、让球或大小球）
3. 图表自动更新，展示赔率历史走势和关键转折点

使用 **导出** 按钮可将当前分析数据下载保存。

---

## 项目结构

```
FIFA-World-Cup/
├── index.html                  # 单页应用入口（4 个视图 + 2 个弹窗）
├── css/
│   └── styles.css              # 全局样式表（设计变量、布局、组件、动画）
├── js/
│   ├── config.js               # 全局配置常量（URL、缓存 TTL、映射表等）
│   ├── data.js                 # 静态数据：48 支球队、16 个场馆、104 场比赛
│   ├── liveScores.js           # ESPN 实时比分轮询模块（30 秒间隔）
│   └── merged.js               # 主应用逻辑（视图切换、渲染、筛选、弹窗、图表）
├── docs/
│   └── PredictionAlgorithmV2.md  # 预测算法详细文档
├── .gitignore
├── README.md                     # 英文文档
└── README-CN.md                  # 中文文档
```

### 各文件职责

| 文件 | 职责 |
|------|------|
| `config.js` | 所有配置常量：API 地址、缓存 TTL、赛事日期范围、时区、阶段/状态/时区映射表、图表配色、赔率翻译表、出线概率表等 |
| `data.js` | 静态业务数据：48 支参赛球队（含分组、排名、国旗 URL）、16 个场馆（含容量、城市、时区）、104 场完整赛程 |
| `liveScores.js` | 间隔轮询 ESPN API，获取实时比分和比赛状态更新，映射 ESPN 原始状态为内部统一状态 |
| `merged.js` | 合一的模块化 IIFE，包含：视图切换与初始化、路由管理、ESPN API 请求与缓存、共享工具函数、赛程渲染与筛选、积分榜排名计算、预测引擎与 UI 渲染、赔率趋势图表、弹窗管理、自动刷新计时器 |

---

## 架构设计

### 数据流

```
config.js（配置常量）
    │
    ▼
data.js（静态数据）── WORLD_CUP_DATA { teams, venues, matches }
    │
    ▼
merged.js ── liveScores.js ── ESPN API
    │              │
    ├── 赛程视图      │  30 秒轮询
    ├── 积分榜视图     │
    ├── 预测分析视图   │
    └── 赔率趋势视图   │
```

### 缓存策略

所有 ESPN API 请求由 `merged.js` 内部的统一缓存层管理：

| 缓存组件 | 过期时间 | 容量上限 | 淘汰策略 |
|----------|----------|----------|----------|
| `espnCache` | 180 秒 | 20 条 | 先进先出（FIFO） |
| `matchOddsCache` | 300 秒 | 50 条 | 过期检测 + 先进先出（FIFO） |

所有缓存配置通过 `window.CONFIG`（[config.js](js/config.js)）集中管理，如需调整只需修改 TTL 或 MAX_SIZE 值。

**关键优化：**

- **请求去重** — 同一接口的并发请求共用同一个 Promise，避免重复调用
- **浏览器 HTTP 缓存** — 常规请求使用 `cache: 'default'`，强制刷新时使用 `'reload'`
- **比赛索引** — 基于 `Map` 实现 O(1) 查找，替代 `Array.find()` 的 O(n) 线性扫描
- **GPU 加速动画** — CSS `translate3d` / `will-change` / `contain`，减少重排重绘
- **事件委托** — 预测卡片等列表使用容器级事件监听，避免为每项绑定独立监听器
- **预计算排序键** — 对日期分组和排序预计算时间值，避免重复调用 `getLocalMatchTime`

### 阶段判定逻辑

比赛阶段判定优先依赖 ESPN 接口的 `season.slug` 字段，降级使用日期回退：

| 优先级 | 数据源 | 映射方式 |
|--------|--------|----------|
| 1 | `espnEvent.season.slug` | `slugToStage` 表（`config.js`） |
| 2 | 比赛日期 | 硬编码日期范围回退 |

### 视图与刷新机制

| 视图 | 视图 ID | 自动刷新 | 触发方式 |
|------|---------|----------|----------|
| 赛程 | `schedule` | 180 秒（轮询驱动） | 手动按钮 + 定时轮询 |
| 积分榜 | `standings` | 无 | 仅手动按钮 |
| 预测分析 | `predictions` | 无 | 仅手动按钮 |
| 赔率趋势 | `analysis` | 无 | 仅手动按钮 |

### 安全策略

- **内容安全策略（CSP）** — 限制脚本、样式、字体、图片和 API 请求来源
- **XSS 防护** — 所有动态渲染内容均通过 `escapeHTML()` 进行安全转义
- **SRI 完整性校验** — Chart.js CDN 脚本包含完整性哈希值
- **防御性空值检查** — 所有 DOM 元素引用均进行 `null` 保护

---

## 配置选项

所有配置集中在 [js/config.js](js/config.js)，通过 `window.CONFIG` 暴露，可在不修改业务逻辑的前提下调整应用行为。

### API 配置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `ESPN_API` | `https://site.api.espn.com/.../scoreboard` | ESPN 记分板 API 地址 |
| `TOURNAMENT_DATE_RANGE` | `20260611-20260730` | 赛事日期范围（API 查询参数） |

### 缓存配置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `ESPN_CACHE_TTL` | `180000`（3 分钟） | 赛程缓存过期时间 |
| `ESPN_CACHE_MAX_SIZE` | `20` | 赛程缓存最大条目 |
| `ODDS_CACHE_TTL` | `300000`（5 分钟） | 单场赔率缓存过期时间 |
| `ODDS_CACHE_MAX_SIZE` | `50` | 单场赔率缓存最大条目 |

### 刷新配置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `AUTO_REFRESH_INTERVAL` | `30000`（30 秒） | 比分轮询间隔 |

### 映射表

| 键 | 说明 |
|----|------|
| `STAGE_NAMES` | 比赛阶段中文名称（小组赛、32强、16强等） |
| `STATUS_NAMES` | 比赛状态中文文本（未开始、进行中、已结束） |
| `SLUG_TO_STAGE` | ESPN season.slug 转内部阶段标识 |
| `ESPN_STATUS_MAP` | ESPN 原始状态转内部统一状态 |
| `VENUE_TIMEZONES` | 16 个场馆时区偏移和城市名 |
| `ODDS_TRANSLATIONS` | 英文赔率描述转中文的翻译规则 |
| `ADVANCE_PROB_TABLE` | 小组出线概率查表（基于剩余场数和积分） |

---

## 数据来源

### 静态数据（[data.js](js/data.js)）

| 数据类别 | 数量 | 说明 |
|----------|------|------|
| 球队 | 48 | 12 个小组（A–L），每组 4 支 |
| 场馆 | 16 | 分布于美国、加拿大、墨西哥 |
| 比赛 | 104 | 72 场小组赛 + 32 场淘汰赛 |

球队国旗来自 [flagcdn.com](https://flagcdn.com)，以 `<img>` 标签形式嵌入 `data.js` 中。

### 外部 API

所有实时数据均来自 **ESPN 公开 API**，无需申请 API 密钥。

| 接口地址 | 用途 |
|----------|------|
| `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | 赛程、比分、赔率、比赛状态 |

**查询参数**：`?dates=YYYYMMDD-YYYYMMDD&limit=200`

---

## API 参考

### 比赛数据结构

`transformEspnEvent()` 函数将 ESPN 返回的事件对象转换为内部使用的比赛数据格式：

```js
{
  id: Number,           // 比赛唯一 ID
  date: String,         // 比赛日期，如 "2026-06-11"
  time: String,         // 比赛时间，如 "12:00"
  homeTeam: String,     // 主队缩写，如 "USA"
  awayTeam: String,     // 客队缩写，如 "CAN"
  stage: String,        // 比赛阶段："group" | "round32" | "round16" | "quarterfinal" | "semifinal" | "thirdplace" | "final"
  group: String,        // 小组标识："A" | "B" | … | null
  venue: String,        // 场馆 ID
  status: String,       // 比赛状态："scheduled" | "live" | "finished"
  homeScore: Number,    // 主队得分，未开始时为 null
  awayScore: Number,    // 客队得分，未开始时为 null
  odds: Object,         // 赔率对象：{ provider, moneyline, spread, total }
  _espnEvent: Object    // ESPN 原始事件数据（调试用）
}
```

### 核心工具函数

| 函数 | 功能说明 |
|------|----------|
| `escapeHTML(str)` | HTML 实体转义，防止 XSS 攻击 |
| `buildFlagHtml(url, name)` | 构建安全的国旗 `<img>` 标签（含 srcset 多倍图） |
| `getTeamById(teamId, fallbackName)` | 根据球队缩写查找球队信息 |
| `getVenueById(venueId)` | 根据 ID 查找场馆信息（含城市和时区） |
| `getStageName(stage)` | 阶段代码转换为中文显示名称（使用 `CONFIG.STAGE_NAMES`） |
| `getStatusText(status)` | 状态代码转换为中文显示文本（使用 `CONFIG.STATUS_NAMES`） |
| `getVenueTimezone(venueId)` | 获取场馆时区信息（使用 `CONFIG.VENUE_TIMEZONES`） |
| `getLocalMatchTime(dateStr, timeStr, venueId, timeUTC)` | 将 UTC 时间转换为北京时间（UTC+8） |
| `isMatchConfirmed(match)` | 检查比赛双方是否为真实队伍（非占位符） |
| `isMatchWithRealTeams(match)` | 检查比赛是否可用于预测/赔率页面 |
| `normalizeProbabilities(home, draw, away)` | 归一化三项概率，使其总和为 100 |
| `americanToDecimal(american)` | 美式赔率转换为欧洲小数赔率 |
| `formatDecimalOdds(american)` | 格式化欧洲赔率用于显示 |
| `oddsToImpliedProb(american)` | 赔率转换为隐含概率 |
| `verifyMatchTeams(event, home, away, teamMap)` | 验证 ESPN 事件与本地队伍数据是否匹配 |

### 预测引擎函数

| 函数 | 功能说明 |
|------|----------|
| `parseOddsFromEspnEvent(event)` | 从 ESPN 事件中提取赔率信息 |
| `aggregateOdds(oddsInfo)` | 多数据源聚合，使用 `CONFIG.PROVIDER_WEIGHTS` 加权 |
| `removeOverround(homeProb, drawProb, awayProb)` | 去除庄家利润（乘法去除法） |
| `analyzeOddsMovement(ml)` | 赔率变动分析，检测 Sharp Money 信号 |
| `crossMarketAdjust(spread, total)` | 跨盘口融合，利用让球盘和大小球赔率辅助修正 |
| `calibrateConfidence(...)` | 信心度校准，综合多因素计算 |
| `detectValueBet(trueProbs, ml)` | 价值投注检测，edge > 2% 时标记 |
| `buildPredFallback(match)` | 5 级梯度降级概率矩阵 |
| `derivePredictionFromOdds(oddsInfo)` | 完整预测流程，从赔率数据到最终预测 |

---

## 设计系统

### 色彩方案

| CSS 变量 | 色值 | 用途 |
|----------|------|------|
| `--primary-color` | `#0c1525` | 导航栏、标题、卡片背景 |
| `--primary-light` | `#162038` | 渐变过渡、悬停状态 |
| `--secondary-color` | `#d4a843` | 金色强调、比分高亮 |
| `--accent-color` | `#e63946` | 进行中状态、警告提示 |
| `--bg-color` | `#f0f2f5` | 页面背景色 |
| `--card-bg` | `#ffffff` | 卡片和表格背景 |
| `--text-primary` | `#0f172a` | 标题、主要文字 |
| `--text-secondary` | `#334155` | 正文内容 |
| `--text-tertiary` | `#64748b` | 辅助说明文字 |

### 字体排版

| 用途 | 字体 | 字重 |
|------|------|------|
| 展示字体（标题、比分） | [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | 600–700 |
| 正文字体 | [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) | 400–600 |
| UI 标签 | [Inter](https://fonts.google.com/specimen/Inter) | 400–500 |
| 等宽字体（数据展示） | [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) + 回退 | 400–500 |

### 间距体系

基于 8px 网格系统递进：`4px` → `8px` → `16px` → `24px` → `32px` → `48px` → `64px`

### 响应式断点

| 断点范围 | 适用设备 | 布局策略 |
|----------|----------|----------|
| < 480px | 手机竖屏 | 单列布局，筛选器纵向堆叠 |
| 480–768px | 手机横屏 | 筛选器横向排列 |
| 768–1024px | 平板设备 | 双列网格布局 |
| > 1024px | 桌面设备 | 完整布局，多列展示 |

---

## 浏览器支持

| 浏览器 | 最低版本要求 |
|--------|--------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## 常见问题

### 部分比赛显示为"TBD"（待定）

淘汰赛阶段的部分比赛（如 32 强、16 强等）在赛程公布前参赛队伍是未知的，会显示占位符标记（TBD）。随着赛事推进，ESPN 会更新实际的参赛队伍，应用会自动同步更新。

### 赔率分析页面没有数据

当前仅 DraftKings 一个数据源的赔率可用。如果某场比赛没有赔率数据，预测分析页面会显示基于分档概率矩阵的降级预测。

### 页面长时间不更新

赛程视图每 30 秒自动轮询最新比分。其他视图需要手动点击刷新按钮。如果是网络问题导致 ESPN API 请求失败，应用会在下次轮询时自动重试。

### 国旗图片不显示

大部分国旗图标内嵌在 `data.js` 中。如果某个国旗无法加载，说明该队伍对应的 flagcdn URL 可能无效或网络受限，检查浏览器控制台确认是否被 CSP 策略拦截。

### 怎么调整缓存刷新频率

修改 [config.js](js/config.js) 中的 `ESPN_CACHE_TTL` 和 `AUTO_REFRESH_INTERVAL` 值即可，无需改动业务代码。

---

## 贡献指南

欢迎参与项目贡献。提交代码前，请确保满足以下要求：

1. 所有比赛数据必须来源于 ESPN API，禁止硬编码静态赛程数据
2. 使用本地国旗图片资源，不使用 API 返回的国旗链接
3. 动态渲染内容必须通过 `escapeHTML()` 进行安全转义，防止 XSS 攻击
4. 新增功能需添加防御性空值检查，避免页面白屏
5. 配置参数应添加到 [config.js](js/config.js) 的 `window.CONFIG` 中，而非硬编码
6. 新增中文文本优先添加到 `config.js` 的映射表或翻译规则中，而非直接写在渲染逻辑里

### 本地开发

```bash
# 本项目无需构建步骤，直接编辑源文件即可
# 在浏览器中打开 index.html 预览修改效果
# 使用浏览器开发者工具的 Network 面板验证 API 调用
```

---

## 许可证

本项目采用 [MIT 许可证](LICENSE)。你可以自由使用、修改和分发本软件，无论是商业用途还是私人用途，只需保留原始许可证声明即可。

---

<p align="center">
  <sub>基于原生 JavaScript、ESPN 公开数据与对足球的热爱构建。</sub>
</p>
