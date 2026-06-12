/**
 * @fileoverview FIFA 世界杯应用 — 全局配置常量
 * @description 集中管理所有硬编码参数、URL、文本映射、时间配置等，
 *              消除各模块间的重复定义，支撑 i18n 扩展与配置维护。
 *              在 data.js / liveScores.js / merged.js 之前加载。
 */

(function () {
  'use strict';

  /* ---- API 相关 ---- */
  /** ESPN 世界杯比分板 API 基础地址 */
  var ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
  /** ESPN 比赛记分板 API 端点 */
  var ESPN_API = ESPN_API_BASE + '/scoreboard';

  /* ---- 赛事日期范围 ---- */
  /** 世界杯整届赛事的日期范围（ESPN API 查询参数格式） */
  var TOURNAMENT_DATE_RANGE = '20260611-20260730';
  var TOURNAMENT_START = '20260611';
  var TOURNAMENT_END = '20260730';

  /* ---- 缓存配置 ---- */
  /** ESPN 赛程缓存 TTL（毫秒） */
  var ESPN_CACHE_TTL = 18e4;       // 180s
  /** ESPN 赛程缓存最大条目数 */
  var ESPN_CACHE_MAX_SIZE = 20;
  /** 单场比赛赔率缓存 TTL（毫秒） */
  var ODDS_CACHE_TTL = 3e5;        // 300s
  /** 单场比赛赔率缓存最大条目数 */
  var ODDS_CACHE_MAX_SIZE = 50;

  /* ---- 自动刷新 ---- */
  /** 自动刷新间隔（毫秒） */
  var AUTO_REFRESH_INTERVAL = 3e4; // 30s

  /* ---- 时区 ---- */
  /** 界面默认时区（北京时间） */
  var DEFAULT_TIMEZONE = 'Asia/Shanghai';

  /* ---- 东道主队伍 ---- */
  var HOST_TEAMS = ['USA', 'MEX', 'CAN'];

  /* ---- 赔率分析平台权重 ---- */
  var PROVIDER_WEIGHTS = {
    draftkings: 1.0,
    bet365: 0.8,
    caesars: 0.7,
    main: 0.6
  };

  /* ---- 图表配色 ---- */
  var ANA_CHART_COLORS = {
    primary: '#0a1628',
    primaryLight: '#142238',
    secondary: '#e8a838',
    accent: '#e63946',
    green: '#10b981',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    orange: '#f59e0b',
    teal: '#14b8a6',
    pink: '#ec4899'
  };

  /* ================================================================
   * 映射表（名称 → 中文 / 枚举翻译）
   * ================================================================ */

  /** 比赛阶段 → 中文名称 */
  var STAGE_NAMES = {
    'group': '小组赛',
    'round32': '32强',
    'round16': '16强',
    'quarterfinal': '8强',
    'semifinal': '半决赛',
    'thirdplace': '三四名决赛',
    'final': '决赛'
  };

  /** 比赛状态 → 中文名称 */
  var STATUS_NAMES = {
    'scheduled': '未开始',
    'live': '进行中',
    'halftime': '中场休息',
    'finished': '已结束',
    'postponed': '已推迟',
    'delayed': '已延迟',
    'canceled': '已取消'
  };

  /** ESPN season.slug → 内部 stage 标识 */
  var SLUG_TO_STAGE = {
    'group-stage': 'group',
    'round-of-32': 'round32',
    'round-of-16': 'round16',
    'quarterfinals': 'quarterfinal',
    'semifinals': 'semifinal',
    '3rd-place-match': 'thirdplace',
    'final': 'final'
  };

  /** 场馆 ID → 时区信息 */
  var VENUE_TIMEZONES = {
    '4727':  { offset: -4, name: 'EDT', city: '纽约' },
    '9115':  { offset: -7, name: 'PDT', city: '洛杉矶' },
    '3871':  { offset: -5, name: 'CDT', city: '达拉斯' },
    '7485':  { offset: -4, name: 'EDT', city: '亚特兰大' },
    '6262':  { offset: -5, name: 'CDT', city: '休斯顿' },
    '10897': { offset: -5, name: 'CDT', city: '堪萨斯城' },
    '5960':  { offset: -7, name: 'PDT', city: '旧金山' },
    '4485':  { offset: -7, name: 'PDT', city: '西雅图' },
    '1421':  { offset: -4, name: 'EDT', city: '费城' },
    '10660': { offset: -4, name: 'EDT', city: '波士顿' },
    '4643':  { offset: -4, name: 'EDT', city: '迈阿密' },
    '10143': { offset: -4, name: 'EDT', city: '多伦多' },
    '4370':  { offset: -7, name: 'PDT', city: '温哥华' },
    '1672':  { offset: -6, name: 'CST', city: '墨西哥城' },
    '5009':  { offset: -6, name: 'CST', city: '瓜达拉哈拉' },
    '6351':  { offset: -6, name: 'CST', city: '蒙特雷' }
  };

  /** 时区默认回退值 */
  var VENUE_TIMEZONE_FALLBACK = { offset: -4, name: 'EDT', city: '' };

  /** 排名占位符映射（parsePlaceholderAbbr 用） */
  var RANK_MAP = { '1': '第1名', '2': '第2名', '3': '第3名' };

  /** ESPN 状态 → 内部统一状态映射 */
  var ESPN_STATUS_MAP = {
    'pre':     'scheduled',
    'scheduled': 'scheduled',
    'in':      'live',
    'live':    'live',
    'post':    'finished',
    'final':   'finished',
    'STATUS_FINAL': 'finished',
    'STATUS_FULL_TIME': 'finished',
    'STATUS_FULL_TIME_EXTRA': 'finished',
    'STATUS_FULL_TIME_PEN': 'finished',
    'STATUS_HALFTIME': 'halftime',
    'STATUS_SECOND_HALF': 'live',
    'STATUS_FIRST_HALF': 'live',
    'STATUS_IN_PROGRESS': 'live',
    'STATUS_PRE_GAME': 'scheduled',
    'STATUS_SCHEDULED':   'scheduled',
    'STATUS_POSTPONED':   'postponed',
    'STATUS_DELAYED':     'delayed',
    'STATUS_CANCELED':    'canceled',
    'STATUS_SUSPENDED':   'delayed',
    'STATUS_FORFEIT':     'finished'
  };

  /** ESPN 原始状态名 → 详细中文显示名（一一对应） */
  var ESPN_STATUS_DETAIL = {
    'STATUS_SCHEDULED':       { cn: '未开赛',        en: 'Scheduled' },
    'STATUS_PRE_GAME':        { cn: '赛前',          en: 'Pre-Game' },
    'STATUS_IN_PROGRESS':     { cn: '进行中',        en: 'In Progress' },
    'STATUS_FIRST_HALF':      { cn: '上半场',        en: 'First Half' },
    'STATUS_HALFTIME':        { cn: '中场休息',      en: 'Halftime' },
    'STATUS_SECOND_HALF':     { cn: '下半场',        en: 'Second Half' },
    'STATUS_FULL_TIME':       { cn: '完场',          en: 'Full Time' },
    'STATUS_FULL_TIME_EXTRA': { cn: '加时完场',      en: 'Extra Time' },
    'STATUS_FULL_TIME_PEN':   { cn: '点球完场',      en: 'Penalty Shootout' },
    'STATUS_FORFEIT':         { cn: '弃权完场',      en: 'Forfeit' },
    'STATUS_POSTPONED':       { cn: '已推迟',        en: 'Postponed' },
    'STATUS_DELAYED':         { cn: '已延迟',        en: 'Delayed' },
    'STATUS_SUSPENDED':       { cn: '已暂停',        en: 'Suspended' },
    'STATUS_CANCELED':        { cn: '已取消',        en: 'Canceled' }
  };

  /** 直播比分分钟数正则 */
  var MINUTE_REGEX = /^\d{1,3}$/;

  /** 小组赛每队场次数 */
  var TOTAL_GROUP_GAMES = 3;

  /* ---- 中文翻译映射表（translateDetailsToChinese 用） ---- */
  var ODDS_TRANSLATIONS = [
    [/\bwon the game\b/gi, '赢得比赛'],
    [/\bwon by ([0-9]+)\b/gi, '以$1分优势获胜'],
    [/\blost the game\b/gi, '输掉比赛'],
    [/\blost by ([0-9]+)\b/gi, '以$1分劣势告负'],
    [/\bpush(ed)?\b/gi, '走盘'],
    [/\bgame went over\b/gi, '比赛总分大于'],
    [/\bgame went under\b/gi, '比赛总分小于'],
    [/\bover all\b/gi, '总分大于'],
    [/\bunder all\b/gi, '总分小于'],
    [/\bcovered the spread\b/gi, '命中让分'],
    [/\bdid not cover\b/gi, '未命中让分'],
    [/\bcovered the over\b/gi, '命中大分'],
    [/\bcovered the under\b/gi, '命中小分'],
    [/\bin the (1st|2nd|3rd|4th|first|second|third|fourth) (quarter|half|period|set)\b/gi, '在第$1$2'],
    [/\bgame\b/gi, '比赛'],
    [/\bquarter\b/gi, '节'],
    [/\bquarters\b/gi, '节'],
    [/\bhalf\b/gi, '半场'],
    [/\bhalves\b/gi, '半场'],
    [/\bperiod\b/gi, '节'],
    [/\bset\b/gi, '盘'],
    [/\bwon\b/gi, '胜'],
    [/\blost\b/gi, '负'],
    [/\bover\b/gi, '大于'],
    [/\bunder\b/gi, '小于'],
    [/\bspread\b/gi, '让分'],
    [/\bcover(?:ed|s|ing)?\b/gi, '命中'],
    [/\bpush\b/gi, '走盘'],
    [/\bteam\b/gi, '队伍'],
    [/\bteams\b/gi, '队伍'],
    [/\btotal\b/gi, '总分'],
    [/\bscore\b/gi, '得分'],
    [/\bscored\b/gi, '得到'],
    [/\bpoints?\b/gi, '分'],
    [/\bthe\b/gi, ''],
    [/\band\b/gi, '和'],
    [/\bfor\b/gi, '为'],
    [/\bwith\b/gi, '使用'],
    [/\bin\b/gi, '在'],
    [/\bto\b/gi, '至']
  ];

  /* ---- 出线概率查表（predictGroupAdvanceProb 用） ---- */
  var ADVANCE_PROB_TABLE = {
    0: [15, 5, 0],
    1: [25, 12, 3],
    2: [35, 18, 5],
    3: [50, 30, 10],
    4: [65, 45, 20],
    5: [75, 55, 28],
    6: [85, 70, 40],
    7: [92, 80, 55],
    8: [96, 90, 70],
    9: [99, 97, 90]
  };

  /* ---- 赋值到 window ---- */
  window.CONFIG = {
    ESPN_API_BASE: ESPN_API_BASE,
    ESPN_API: ESPN_API,
    TOURNAMENT_DATE_RANGE: TOURNAMENT_DATE_RANGE,
    TOURNAMENT_START: TOURNAMENT_START,
    TOURNAMENT_END: TOURNAMENT_END,
    ESPN_CACHE_TTL: ESPN_CACHE_TTL,
    ESPN_CACHE_MAX_SIZE: ESPN_CACHE_MAX_SIZE,
    ODDS_CACHE_TTL: ODDS_CACHE_TTL,
    ODDS_CACHE_MAX_SIZE: ODDS_CACHE_MAX_SIZE,
    AUTO_REFRESH_INTERVAL: AUTO_REFRESH_INTERVAL,
    DEFAULT_TIMEZONE: DEFAULT_TIMEZONE,
    HOST_TEAMS: HOST_TEAMS,
    PROVIDER_WEIGHTS: PROVIDER_WEIGHTS,
    ANA_CHART_COLORS: ANA_CHART_COLORS,
    STAGE_NAMES: STAGE_NAMES,
    STATUS_NAMES: STATUS_NAMES,
    SLUG_TO_STAGE: SLUG_TO_STAGE,
    VENUE_TIMEZONES: VENUE_TIMEZONES,
    VENUE_TIMEZONE_FALLBACK: VENUE_TIMEZONE_FALLBACK,
    RANK_MAP: RANK_MAP,
    ESPN_STATUS_MAP: ESPN_STATUS_MAP,
    ESPN_STATUS_DETAIL: ESPN_STATUS_DETAIL,
    MINUTE_REGEX: MINUTE_REGEX,
    TOTAL_GROUP_GAMES: TOTAL_GROUP_GAMES,
    ODDS_TRANSLATIONS: ODDS_TRANSLATIONS,
    ADVANCE_PROB_TABLE: ADVANCE_PROB_TABLE
  };
})();