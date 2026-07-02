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

- 展示全部 **104 场比赛**，覆盖 12 个小组（A–L）和 7 轮淘汰赛，按日期分组
- 支持多维度筛选：按阶段、小组、日期和队名搜索
- 比赛卡片展示对阵双方国旗、北京时间（UTC+8）、场馆城市和阶段标签
- 实时状态标记：`未开始` / `进行中` / `已结束`，同步显示比分
- **每 30 秒**从 ESPN 轮询最新比分和比赛状态（由 `liveScores.js` 驱动）
- 手动刷新按钮，内置 60 秒倒计时提示

### 2. 积分榜

- **12 个小组（A–L）**自动计算排名
- 排序规则：积分 → 净胜球 → 进球数 → 胜负关系 → 队名
- 仅支持手动刷新，不进行自动轮询，避免无效 API 请求
- 动态同步 ESPN 实时比赛数据

### 3. 预测分析

- **赔率驱动预测**：基于 ESPN 实时赔率，使用多数据源加权聚合算法生成预测
- **8 大算法优化管线**：
  - 多数据源加权聚合（DraftKings ×1.0、Bet365 ×0.8、Caesars ×0.7、ESPN ×0.6）
  - 庄家利润去除：乘法归一化法提取真实概率
  - 赔率变动分析：Sharp Money（聪明资金）检测，四级分级（stable / moderate / sharp / extreme）
  - 信心度校准：综合多因素（数据源数量、利润率、变动幅度）计算校准信心度
  - 跨盘口融合：利用让球盘和大小球赔率辅助修正
  - 价值投注检测：对比真实概率与赔率隐含概率（edge > 2%）
  - 基于 FIFA 排名的 Elo 回退模型：无赔率时使用 Elo 等级分公式（含东道主 +5% 加成、平局率衰减）
  - 动态热门预测：基于实时数据生成热门比赛列表
- 每场比赛展示实时隐含概率条（主胜 / 平局 / 客胜）
- 赔率面板展示多平台的独赢（Moneyline）赔率

### 4. 赔率分析中心

- 交互式趋势图（Chart.js）展示赔率历史走势
- **数据源**：DraftKings、Bet365、Caesars、ESPN（均通过 ESPN API）
- **赔率类型**：独赢 / 让球 / 大小球
- 单场比赛深入分析，包含完整赔率明细弹窗
- 历史赔率快照存储（localStorage）
- 数据导出功能，支持离线分析（JSON 格式）

---

## 快速开始

### 环境要求

- 现代浏览器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+）
- 网络连接（用于 ESPN API）
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
| **预测分析** | 即将进行的小组赛胜率预测 | 评估赔率数据、发现价值投注 |
| **赔率趋势** | 历史赔率走势图与关键指标 | 分析赔率变动、检测聪明资金信号 |

### 赛程筛选

在赛程页面，你可以使用以下筛选器快速定位目标比赛：

1. **比赛阶段** — 筛选全部阶段或仅小组赛
2. **小组** — 聚焦特定小组（A–L）
3. **日期** — 选择特定比赛日
4. **搜索** — 输入队伍名称（如"巴西"、"Germany"）即时搜索

点击 **清除筛选** 按钮可一键重置所有筛选条件。

### 查看比赛详情

点击任意比赛卡片，弹出详情窗口，展示以下信息：
- 对阵双方名称与国旗
- 比赛时间（同时显示北京时间 UTC+8 和场馆当地时间）
- 场馆信息（国家、城市）
- 比赛阶段和小组
- 实时比分或比赛状态

### 预测卡片

在预测分析页面，每张比赛卡片展示：
- **概率条** — 主胜 / 平局 / 客胜的概率可视化对比
- **信心度** — 校准后的信心度进度条（高 / 中 / 低）
- **智能标签** — 价值投注标记、Sharp Money 信号、多数据源聚合标签
- **FIFA 排名展示** — 每支队伍显示其 FIFA 排名数字

点击预测卡片可打开赔率详情弹窗，查看各平台的完整赔率对比。

### 赔率分析

1. 在下拉菜单中选择**比赛**
2. 选择**赔率类型**（独赢、让球或大小球）
3. 选择**数据源**（DraftKings、Bet365、Caesars、ESPN）
4. 图表自动更新，展示赔率历史走势和关键指标

使用 **导出** 按钮可将当前分析数据下载为 JSON 文件。

---

## 项目结构

```
FIFA-World-Cup/
├── index.html                  # 单页应用入口（4 个视图 + 2 个弹窗）
├── css/
│   └── styles.css              # 全局样式表（设计变量、布局、组件、动画）
├── js/
│   ├── config.js               # 全局配置常量
│   ├── data.js                 # 静态数据：48 支球队、16 个场馆、104 场比赛
│   ├── utils.js                # 纯工具函数（时间、HTML、格式化、校验）
│   ├── apiClient.js            # ESPN API 客户端（缓存 + 请求去重）
│   ├── scheduleView.js         # 赛程渲染、筛选、积分榜计算
│   ├── oddsEngine.js           # 赔率聚合、预测引擎、趋势图渲染
│   ├── predictionsView.js      # 预测卡片渲染、赔率详情弹窗、比赛详情弹窗
│   ├── main.js                 # 应用初始化、视图切换、自动刷新计时器
│   └── liveScores.js           # 实时比分轮询（30 秒间隔）
├── .trae/
│   └── documents/              # 设计文档和规划记录
├── .gitignore
├── README.md                   # 英文文档
└── README-CN.md                # 中文文档
```

### 各文件职责

| 文件 | 职责 |
|------|------|
| `config.js` | 所有配置常量：API 地址、缓存 TTL、赛事日期范围、时区、阶段/状态映射表、数据源权重、场馆时区、赔率翻译表、出线概率表等 |
| `data.js` | 静态业务数据：48 支参赛球队（含分组、FIFA 排名、国旗 URL）、16 个场馆（含容量、城市、时区）、104 场完整赛程；构建索引（Map 实现 O(1) 查找）；积分榜计算 |
| `utils.js` | 纯工具函数：`escapeHTML()`、`buildFlagHtml()`、`toBeijingTime()`、`formatDate2()`、`formatTime()`、`translateDetailsToChinese()`、`parsePlaceholderAbbr()`、`getLocalMatchTime()`、`normalizeProbabilities()`、`americanToDecimal()`、`oddsToImpliedProb()`、队伍/场馆校验等 |
| `apiClient.js` | ESPN API 数据获取（TTL 缓存 + LRU 淘汰 + 请求去重）；事件转换（`transformEspnEvent`）；赔率提取（`parseOddsFromEspnEvent`）；阶段/分组检测 |
| `scheduleView.js` | 赛程列表渲染（按日期分组）；比赛卡片创建（含点击事件）；多维度筛选器（阶段/分组/日期/搜索）；积分榜表格渲染（含排名逻辑） |
| `oddsEngine.js` | 赔率聚合管线（加权平均 → 去利润 → 变动分析 → 信心校准 → 跨市场调整 → 价值检测）；Chart.js 趋势图渲染；赔率快照存储；热门预测生成；出线概率计算 |
| `predictionsView.js` | 预测卡片渲染（FIFA 排名 Elo 回退 + 异步赔率补充）；赔率详情弹窗；比赛详情弹窗；预测筛选器（阶段/信心度/排序/搜索） |
| `main.js` | DOMContentLoaded 初始化；视图切换（`switchView`）；自动刷新计时器（60 秒倒计时）；移动端菜单；刷新按钮绑定 |
| `liveScores.js` | 30 秒间隔轮询 ESPN API；实时比分 → `WORLD_CUP_DATA` 同步；TBD 占位符自动替换；启停控制 |

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
utils.js（纯工具函数）
    │
    ▼
apiClient.js ────────────────── ESPN API
    │               │
    ├── scheduleView.js        │  （赛程 + 积分榜）
    ├── oddsEngine.js          │  （预测 + 图表）
    ├── predictionsView.js     │  （预测界面 + 弹窗）
    └── liveScores.js ─────────┘  （30 秒轮询 → WORLD_CUP_DATA）
               │
               ▼
          main.js（初始化 + 视图切换 + 自动刷新）
```

### 脚本加载顺序

```
config.js → data.js → utils.js → apiClient.js → scheduleView.js → oddsEngine.js → predictionsView.js → main.js → liveScores.js
```

### 缓存策略

所有 ESPN API 请求由 `apiClient.js` 内部的统一缓存层管理：

| 缓存对象 | 过期时间 | 容量上限 | 淘汰策略 |
|----------|----------|----------|----------|
| `espnCache` | 180 秒 | 20 条 | LRU（最早条目） |
| `matchOddsCache` | 300 秒 | 50 条 | 过期检测 + LRU |

所有缓存配置通过 `window.CONFIG`（[config.js](js/config.js)）集中管理。

**关键优化：**

- **请求去重** — 同一接口的并发请求共用同一个 Promise，避免重复调用
- **浏览器 HTTP 缓存** — 常规请求使用 `cache: 'default'`，强制刷新时使用 `'reload'`
- **比赛索引** — 基于 `Map` 实现 O(1) 查找（`MATCH_INDEX_BY_ID`、`MATCH_INDEX_BY_DATE_TEAMS`）
- **GPU 加速动画** — CSS `translate3d` / `will-change` / `contain`，减少重排重绘
- **事件委托** — 预测卡片等列表使用容器级事件监听，避免为每项绑定独立监听器
- **内容去重** — 赛程渲染对比 ID+比分+状态的指纹，避免重复 DOM 更新
- **双 rAF** — 双重 `requestAnimationFrame` 延迟，确保 CSS 过渡动画顺滑

### 阶段判定逻辑

比赛阶段判定优先依赖 ESPN 接口的 `season.slug` 字段，降级使用日期回退：

| 优先级 | 数据源 | 映射方式 |
|--------|--------|----------|
| 1 | `espnEvent.season.slug` | `SLUG_TO_STAGE` 表（config.js） |
| 2 | 比赛日期 | 硬编码日期范围回退 |

### 视图与刷新机制

| 视图 | 自动刷新 | 触发方式 |
|------|----------|----------|
| 赛程 | 60 秒倒计时 | 手动按钮 + 自动计时器 |
| 积分榜 | 无 | 仅手动按钮 |
| 预测分析 | 无 | 仅手动按钮 |
| 赔率趋势 | 无 | 仅手动按钮 |

### 安全策略

- **XSS 防护** — 所有动态渲染内容均通过 `escapeHTML()` 进行安全转义
- **SRI 完整性校验** — Chart.js CDN 脚本包含完整性哈希值
- **防御性空值检查** — 所有 DOM 元素引用均进行 `null` 保护
- **淘汰赛占位过滤** — 非小组赛阶段的 TBD 占位比赛自动从预测和赛程视图中排除

---

## 配置选项

所有配置集中在 [js/config.js](js/config.js)，通过 `window.CONFIG` 暴露，可在不修改业务逻辑的前提下调整应用行为。

### API 配置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `ESPN_API` | `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | ESPN 记分板 API 地址 |
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
| `AUTO_REFRESH_INTERVAL` | `30000`（30 秒） | 比分轮询间隔（liveScores.js） |

### 数据源权重

| 键 | 默认值 | 说明 |
|----|--------|------|
| `PROVIDER_WEIGHTS` | `{ draftkings: 1.0, bet365: 0.8, caesars: 0.7, main: 0.6 }` | 多数据源赔率聚合的加权平均权重 |

### 赛事配置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `HOST_TEAMS` | `['USA', 'MEX', 'CAN']` | 东道主队伍（用于 Elo 预测加成） |
| `DEFAULT_TIMEZONE` | `Asia/Shanghai` | 默认显示时区（UTC+8） |

### 映射表

| 键 | 说明 |
|----|------|
| `STAGE_NAMES` | 7 个比赛阶段中文名称（小组赛、32强、16强、8强、半决赛、三四名决赛、决赛） |
| `STATUS_NAMES` | 7 种比赛状态中文文本（未开始、进行中、中场休息、已结束、已推迟、已延迟、已取消） |
| `SLUG_TO_STAGE` | ESPN season.slug 转内部阶段标识 |
| `ESPN_STATUS_MAP` | 20+ ESPN 原始状态转内部统一状态 |
| `ESPN_STATUS_DETAIL` | 14 种 ESPN 状态的中英文详情描述 |
| `VENUE_TIMEZONES` | 16 个场馆的时区偏移、缩写和城市名 |
| `ODDS_TRANSLATIONS` | 38 条英文赔率描述转中文的翻译规则 |
| `ADVANCE_PROB_TABLE` | 小组出线概率查表（基于剩余场数和积分） |
| `TEAM_MAP` | 48+ ESPN 队伍缩写转内部队伍 ID |
| `ESPN_VENUE_IDS` | 16 个世界杯场馆 ID 的 Set 集合 |

---

## 数据来源

### 静态数据（[data.js](js/data.js)）

| 数据类别 | 数量 | 说明 |
|----------|------|------|
| 球队 | 48 | 12 个小组（A–L），每组 4 支，含 FIFA 排名 |
| 场馆 | 16 | 美国 10 座 + 墨西哥 3 座 + 加拿大 2 座 + 1 座未分配 |
| 比赛 | 104 | 72 场小组赛（第 1–17 比赛日）+ 32 场淘汰赛 |

球队国旗来自 [flagcdn.com](https://flagcdn.com)，以 `<img>` 标签渲染，支持 2x/3x `srcset` 高清适配。

### 外部 API

所有实时数据均来自 **ESPN 公开 API**，无需申请 API 密钥。

| 接口地址 | 用途 |
|----------|------|
| `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | 赛程、比分、赔率、比赛状态 |

**查询参数**：`?dates=YYYYMMDD-YYYYMMDD&limit=200`

---

## API 参考

### 比赛数据结构

`apiClient.js` 中的 `transformEspnEvent()` 函数将 ESPN 返回的事件对象转换为内部使用的比赛数据格式：

```js
{
  id: Number,              // 比赛唯一 ID
  date: String,            // 比赛日期，如 "2026-06-11"
  time: String,            // 比赛时间，如 "12:00"
  timeUTC: String,         // UTC 时间字符串
  homeTeam: String,        // 主队缩写，如 "USA"
  awayTeam: String,        // 客队缩写，如 "CAN"
  _homeName: String,       // 主队显示名称
  _awayName: String,       // 客队显示名称
  venue: String,           // 场馆 ID
  stage: String,           // 比赛阶段："group" | "round32" | "round16" | "quarterfinal" | "semifinal" | "thirdplace" | "final"
  group: String,           // 小组标识："A"–"L" | null
  status: String,          // 比赛状态："scheduled" | "live" | "finished"
  homeScore: Number,       // 主队得分，未开始时为 null
  awayScore: Number,       // 客队得分，未开始时为 null
  minute: String,          // 当前比赛分钟数（非进行中时为 null）
  _espnStatusName: String, // ESPN 原始状态名称
  _espnStatusDesc: String, // ESPN 原始状态描述
  _espnId: String,         // ESPN 事件 ID
  _source: String          // 数据来源（"espn" | "local"）
}
```

### 核心工具函数（[utils.js](js/utils.js)）

| 函数 | 功能说明 |
|------|----------|
| `escapeHTML(str)` | HTML 实体转义，防止 XSS 攻击 |
| `buildFlagHtml(url, name)` | 构建安全的国旗 `<img>` 标签（含 2x/3x srcset） |
| `toBeijingTime(utcDate)` | UTC 时间转北京时间 |
| `formatDate2(date)` | 日期格式化为 `YYYY-MM-DD` |
| `formatTime(date)` | 时间格式化为 `HH:MM` |
| `translateDetailsToChinese(details)` | ESPN 赔率描述英译中 |
| `parsePlaceholderAbbr(abbr)` | 淘汰赛占位符转换（如 "1A" → "小组赛A组第1名"） |
| `getTeamById(teamId, fallbackName)` | 按缩写查找队伍信息（含 `isPlaceholder` 标记） |
| `getVenueById(venueId)` | 按 ID 查找场馆信息 |
| `getStageName(stage)` | 阶段代码转中文显示名 |
| `getStatusText(status)` | 状态代码转中文显示文本 |
| `getDetailedStatus(match)` | 获取详细状态描述（使用 `ESPN_STATUS_DETAIL`） |
| `isMatchWithRealTeams(match)` | 检查双方是否为真实队伍（非占位符） |
| `isMatchConfirmed(match)` | 检查双方队伍缩写是否非空 |
| `isKnockoutPlaceholder(match)` | 检查是否为淘汰赛占位比赛 |
| `normalizeProbabilities(home, draw, away)` | 归一化三项概率，总和为 100 |
| `americanToDecimal(american)` | 美式赔率转欧洲小数赔率 |
| `formatDecimalOdds(american)` | 格式化欧洲赔率用于显示 |
| `oddsToImpliedProb(american)` | 赔率转隐含概率 |
| `getVenueTimezone(venueId)` | 获取场馆时区信息 |
| `getLocalMatchTime(dateStr, timeStr, venueId, timeUTC)` | 计算北京时间 + 场馆当地时间 |

### 预测引擎函数（[oddsEngine.js](js/oddsEngine.js)）

| 函数 | 功能说明 |
|------|----------|
| `parseOddsFromEspnEvent(event)` | 从 ESPN 事件中按提供商提取赔率信息 |
| `aggregateOdds(oddsInfo)` | 多数据源加权聚合，使用 `PROVIDER_WEIGHTS` 权重 |
| `removeOverround(homeProb, drawProb, awayProb)` | 去除庄家利润（乘法归一化） |
| `analyzeOddsMovement(ml)` | 赔率变动分析：Sharp Money 检测，信号强度 1–10 |
| `crossMarketAdjust(spread, total)` | 跨盘口融合，利用让球盘和大小球赔率辅助修正 |
| `calibrateConfidence(norm, overround, movement, providerCount)` | 多因素信心度校准（10–95） |
| `detectValueBet(trueProbs, ml)` | 价值投注检测（edge > 2%） |
| `derivePredictionFromOdds(oddsInfo)` | 完整预测流程：赔率 → 最终预测 |
| `calcAdvancementProb(teamId, allMatches)` | 小组出线概率（查表法 + 净胜球微调） |
| `generateHotPredictions()` | 生成热门预测列表（按热度排序，最多 15 条） |

### 图表与分析函数（[oddsEngine.js](js/oddsEngine.js)）

| 函数 | 功能说明 |
|------|----------|
| `anaFetchScoreboardWithOdds()` | 获取 ESPN 记分板数据（含赔率） |
| `anaGenerateTrendData(oddsInfo, provider, oddsType)` | 生成趋势数据点 |
| `anaDrawQuickTrend(trend, oddsInfo)` | 快速绘制趋势图（首屏用） |
| `renderOddsTrend()` | 完整 Chart.js 趋势图渲染 |
| `anaRenderKeyPoints(oddsInfo, provider, oddsType)` | 渲染赔率关键指标面板 |
| `saveOddsSnapshot(matchId, oddsInfo, provider, oddsType)` | 保存赔率快照到 localStorage |
| `loadOddsHistory(matchId)` | 加载历史赔率快照 |
| `anaExportData()` | 导出分析数据为 JSON |

---

## 设计系统

### 色彩方案

采用玻璃拟态（Glassmorphism）设计风格，以绿色/金色为主色调。

| CSS 变量 | 色值 | 用途 |
|----------|------|------|
| `--glass-bg` | `rgba(255,255,255,0.72)` | 卡片玻璃背景 |
| `--glass-bg-strong` | `rgba(255,255,255,0.88)` | 弹窗/提示玻璃背景 |
| `--glass-border` | `rgba(255,255,255,0.45)` | 玻璃卡片边框 |
| `--primary-color` | `#1a5c3a` | 导航栏、主要标题、强调色 |
| `--primary-light` | `#2d8a57` | 悬停状态、渐变过渡 |
| `--primary-dark` | `#0d3d24` | 激活状态、深度层次 |
| `--secondary-color` | `#d4a843` | 金色强调、比分高亮 |
| `--secondary-light` | `#e8c056` | 金色悬停状态 |
| `--accent-color` | `#e63946` | 进行中状态、警告提示 |
| `--bg-color` | `#f0f8f4` | 页面背景色（淡绿基底） |
| `--bg-secondary` | `#e0f0e8` | 次级背景色 |
| `--card-bg` | `rgba(255,255,255,0.82)` | 玻璃卡片背景 |
| `--text-primary` | `#0f172a` | 标题、主要文字 |
| `--text-secondary` | `#334155` | 正文内容 |
| `--text-tertiary` | `#475569` | 辅助说明文字 |
| `--status-live` | `#dc2626` | 进行中比赛指示 |
| `--status-finished` | `#059669` | 已结束比赛指示 |
| `--status-scheduled` | `#475569` | 未开始比赛指示 |

### 字体排版

| 用途 | 字体栈 | 字重 |
|------|--------|------|
| 展示字体（标题、比分） | `-apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Serif SC', serif` | 600–700 |
| 正文字体 | `'SF Mono', 'Consolas', 'JetBrains Mono', monospace, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif` | 400–500 |
| 数字数据 | `'SF Mono', 'Consolas', 'JetBrains Mono', monospace` | 400–700 |

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

### 部分比赛显示为"TBD"或占位名称

淘汰赛阶段的比赛（如 32 强、16 强等）在赛程公布前参赛队伍是未知的，会显示占位符标记（如"小组赛A组第1名"）。预测分析页面会自动过滤这些比赛。随着赛事推进，ESPN 更新实际参赛队伍后，应用会自动同步。

### 预测分析页面只显示小组赛比赛

这是设计上的决策。淘汰赛阶段的比赛参赛队伍尚未确定，无法进行有意义的预测。预测分析页面使用基于 FIFA 排名的 Elo 模型处理无赔率比赛，并完全过滤掉非小组赛阶段的比赛。

### 赔率分析页面某些数据源没有数据

不同比赛的数据源可用性不同。如果某场比赛的某个数据源（如 Bet365、Caesars）没有赔率数据，其对应的标签按钮会自动隐藏。应用会自动切换到第一个有数据的数据源。

### 页面长时间不更新

赛程视图有 60 秒自动刷新倒计时。其他视图需要手动点击刷新按钮。`liveScores.js` 模块独立每 30 秒轮询 ESPN 比分数据。如果是网络问题导致 API 请求失败，应用会在下次轮询时自动重试。

### 国旗图片不显示

国旗图片来自 [flagcdn.com](https://flagcdn.com)。如果某个国旗无法加载，说明该 URL 可能无效或网络受限。检查浏览器控制台确认是否被 CSP 策略拦截或存在网络错误。

### 怎么调整缓存刷新频率

修改 [config.js](js/config.js) 中的 `ESPN_CACHE_TTL`、`ODDS_CACHE_TTL` 和 `AUTO_REFRESH_INTERVAL` 值即可，无需改动业务代码。

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