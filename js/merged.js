/**
 * @fileoverview FIFA 世界杯应用合并模块
 * @description 包含以下子模块：API 客户端、赛程视图、预测引擎、赔率分析、弹窗管理、应用初始化
 * 所有比赛数据来源于 ESPN 官方 API，本地使用国旗图片资源
 * ES Module 通过 window 对象访问全局变量（WORLD_CUP_DATA 等）
 */

(() => {
    /* ================================================================
   * 模块：配置 (config)
   * ESPN API 地址、队伍映射、场馆 ID 集合、图表配色等全局常量
   * ================================================================ */
  /** ESPN 比赛记分板 API 端点地址 */
  var ESPN_API = window.CONFIG.ESPN_API;
  /** ESPN 队伍缩写到本地 ID 的映射表，包含 48 支参赛队伍及可能出现在赔率中的额外队伍 */
  var TEAM_MAP = {
    // 48支参赛队伍 (与data.js一致)
    // A组
    "MEX": "MEX",
    "RSA": "RSA",
    "KOR": "KOR",
    "CZE": "CZE",
    // B组
    "CAN": "CAN",
    "BIH": "BIH",
    "QAT": "QAT",
    "SUI": "SUI",
    // C组
    "BRA": "BRA",
    "MAR": "MAR",
    "HAI": "HAI",
    "SCO": "SCO",
    // D组
    "USA": "USA",
    "PAR": "PAR",
    "AUS": "AUS",
    "TUR": "TUR",
    // E组
    "GER": "GER",
    "CUW": "CUW",
    "CIV": "CIV",
    "ECU": "ECU",
    // F组
    "NED": "NED",
    "JPN": "JPN",
    "SWE": "SWE",
    "TUN": "TUN",
    // G组
    "BEL": "BEL",
    "EGY": "EGY",
    "IRN": "IRN",
    "NZL": "NZL",
    // H组
    "ESP": "ESP",
    "CPV": "CPV",
    "KSA": "KSA",
    "URU": "URU",
    // I组
    "FRA": "FRA",
    "SEN": "SEN",
    "IRQ": "IRQ",
    "NOR": "NOR",
    // J组
    "ARG": "ARG",
    "ALG": "ALG",
    "AUT": "AUT",
    "JOR": "JOR",
    // K组
    "POR": "POR",
    "COD": "COD",
    "UZB": "UZB",
    "COL": "COL",
    // L组
    "ENG": "ENG",
    "CRO": "CRO",
    "GHA": "GHA",
    "PAN": "PAN",
    // 其他可能出现在赔率数据中的队伍
    "CHI": "CHI",
    "PER": "PER",
    "CRC": "CRC",
    "ITA": "ITA",
    "DEN": "DEN",
    "POL": "POL",
    "SRB": "SRB",
    "WAL": "WAL",
    "UAE": "UAE",
    "NGA": "NGA",
    "CMR": "CMR",
    // 特殊映射: 沙特阿拉伯 (ESPN可能使用KSA)
    "SAU": "KSA"
  };
  /** 世界杯场馆 ID 集合，用于验证 ESPN 返回的场馆是否为世界杯场馆 */
  var ESPN_VENUE_IDS = /* @__PURE__ */ new Set([
    "4727",
    "9115",
    "3871",
    "7485",
    "6262",
    "10897",
    "5960",
    "4485",
    "1421",
    "10660",
    "4643",
    "10143",
    "4370",
    "1672",
    "5009",
    "6351"
  ]);
  /** 48 支参赛队伍 ID 集合，用于验证队伍是否为真实参赛队 */
  var TEAM_INDEX = /* @__PURE__ */ new Set([
    "MEX",
    "RSA",
    "KOR",
    "CZE",
    "CAN",
    "BIH",
    "QAT",
    "SUI",
    "BRA",
    "MAR",
    "HAI",
    "SCO",
    "USA",
    "PAR",
    "AUS",
    "TUR",
    "GER",
    "CUW",
    "CIV",
    "ECU",
    "NED",
    "JPN",
    "SWE",
    "TUN",
    "BEL",
    "EGY",
    "IRN",
    "NZL",
    "ESP",
    "CPV",
    "KSA",
    "URU",
    "FRA",
    "SEN",
    "IRQ",
    "NOR",
    "ARG",
    "ALG",
    "AUT",
    "JOR",
    "POR",
    "COD",
    "UZB",
    "COL",
    "ENG",
    "CRO",
    "GHA",
    "PAN"
  ]);
  /** 赔率分析图表配色方案 */
  var ANA_CHART_COLORS = window.CONFIG.ANA_CHART_COLORS;

    /* ================================================================
   * 模块：缓存 (cache)
   * ESPN 赛程缓存与赔率缓存，支持 TTL 过期、LRU 淘汰、请求去重
   * ================================================================ */
  /**
   * ESPN 赛程数据缓存对象
   * 支持 TTL 过期（180秒）、LRU 淘汰（最大20条）、请求去重（inFlight）
   */
  var espnCache = {
    _store: /* @__PURE__ */ new Map(),
    _inFlight: /* @__PURE__ */ new Map(),
    TTL: window.CONFIG.ESPN_CACHE_TTL,
    MAX_SIZE: window.CONFIG.ESPN_CACHE_MAX_SIZE,
    /**
     * 生成缓存键
     * @param {string} dateRange - 日期范围字符串（如 "20260611-20260730"）
     * @param {number} limit - 请求条数限制
     * @returns {string} 缓存键
     */
    _key(dateRange, limit) {
      return `${dateRange}:${limit}`;
    },
    /**
     * 获取 ESPN 赛程数据（优先缓存，支持强制刷新）
     * @param {string} dateRange - 日期范围字符串
     * @param {number} [limit=200] - 请求条数限制
     * @param {boolean} [forceRefresh=false] - 是否强制刷新（跳过缓存）
     * @returns {Promise<Object>} ESPN API 返回的 JSON 数据
     */
    async fetch(dateRange, limit = 200, forceRefresh = false) {
      const key = this._key(dateRange, limit);
      const now = Date.now();
      if (!forceRefresh && this._store.has(key)) {
        const entry = this._store.get(key);
        if (now - entry.timestamp < this.TTL) return entry.data; // 缓存命中且未过期
      }
      if (this._inFlight.has(key)) return this._inFlight.get(key); // 请求去重：复用正在进行的请求
      const cacheOpt = forceRefresh ? "reload" : "default";
      // 构建 ESPN API 请求 URL，cache 参数控制浏览器缓存策略
      const promise = fetch(`${ESPN_API}?dates=${dateRange}&limit=${limit}`, { cache: cacheOpt }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then((data) => {
        this._store.set(key, { data, timestamp: Date.now() });
        this._inFlight.delete(key);
        this._evict();
        return data;
      }).catch((err) => {
        this._inFlight.delete(key);
        throw err;
      });
      this._inFlight.set(key, promise);
      return promise;
    },
    /** LRU 淘汰：当缓存条目超过最大容量时删除最旧的条目 */
    _evict() {
      if (this._store.size <= this.MAX_SIZE) return;
      const oldest = this._store.keys().next().value;
      this._store.delete(oldest);
    },
    /**
     * 使缓存失效
     * @param {string} [key] - 指定缓存键删除；不传则清空全部缓存
     */
    invalidate(key) {
      if (key) this._store.delete(key);
      else this._store.clear();
    }
  };
  /**
   * 单场比赛赔率缓存对象
   * TTL 300秒，最大50条，按比赛 ID 索引
   */
  var matchOddsCache = {
    _store: /* @__PURE__ */ new Map(),
    _inFlight: /* @__PURE__ */ new Map(),
    TTL: window.CONFIG.ODDS_CACHE_TTL,
    MAX_SIZE: window.CONFIG.ODDS_CACHE_MAX_SIZE,
    /**
     * 获取单场比赛赔率数据（优先缓存）
     * @param {number} matchId - 比赛 ID
     * @param {string} dateStr - 日期字符串（YYYYMMDD 格式）
     * @param {string} homeTeam - 主队 ID
     * @param {string} awayTeam - 客队 ID
     * @returns {Promise<Object>} 包含 event 和 _ts 的缓存条目
     */
    async fetch(matchId, dateStr, homeTeam, awayTeam) {
      const now = Date.now();
      if (this._store.has(matchId)) {
        const entry = this._store.get(matchId);
        if (now - entry._ts < this.TTL) return entry;
      }
      if (this._inFlight.has(matchId)) return this._inFlight.get(matchId);
      const promise = this._doFetch(matchId, dateStr, homeTeam, awayTeam);
      this._inFlight.set(matchId, promise);
      try {
        return await promise;
      } finally {
        this._inFlight.delete(matchId);
      }
    },
    /**
     * 实际执行赔率数据获取：构建日期范围查询 ESPN API，匹配对应赛事
     * @param {number} matchId - 比赛 ID
     * @param {string} dateStr - 日期字符串
     * @param {string} homeTeam - 主队 ID
     * @param {string} awayTeam - 客队 ID
     * @returns {Promise<Object>} 包含 event 和 _ts 的结果对象
     */
    async _doFetch(matchId, dateStr, homeTeam, awayTeam) {
      const d = /* @__PURE__ */ new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T00:00:00Z`);
      const prev = new Date(d.getTime() - 864e5);
      const next = new Date(d.getTime() + 864e5);
      const fmt = (dt) => `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
      const dateRange = `${fmt(prev)}-${fmt(next)}`;
      const data = await espnCache.fetch(dateRange, 150);
      const event = (data.events || []).find((ev) => {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp) return false;
        const cs = comp.competitors || [];
        const h = cs.find((c) => c.homeAway === "home");
        const a = cs.find((c) => c.homeAway === "away");
        if (!h || !a) return false;
        const espnHome = (h.team.abbreviation || "").toUpperCase();
        const espnAway = (a.team.abbreviation || "").toUpperCase();
        const homeId = TEAM_MAP[espnHome] || espnHome; // 通过映射表转换 ESPN 缩写为本地 ID
        const awayId = TEAM_MAP[espnAway] || espnAway; // 通过映射表转换 ESPN 缩写为本地 ID
        if (homeTeam && awayTeam) {
          return homeId === homeTeam && awayId === awayTeam || homeId === awayTeam && awayId === homeTeam;
        }
        return false;
      });
      const result = { event, _ts: Date.now() };
      this._evict();
      this._store.set(matchId, result);
      return result;
    },
    /** LRU 淘汰：当缓存条目超过最大容量时删除最旧的条目 */
    _evict() {
      const now = Date.now();
      for (const [k, v] of this._store) {
        if (now - v._ts > this.TTL) this._store.delete(k);
      }
      if (this._store.size >= this.MAX_SIZE) {
        const firstKey = this._store.keys().next().value;
        this._store.delete(firstKey);
      }
    },
    /** 清空赔率缓存 */
    invalidate() {
      this._store.clear();
    }
  };

    /* ================================================================
   * 模块：工具函数 (utils)
   * HTML 转义、国旗 HTML 构建、时间格式化、队伍/场馆查询等通用函数
   * ================================================================ */
  /**
   * HTML 转义，防止 XSS 攻击
   * @param {*} str - 需要转义的值（支持 null/非字符串类型）
   * @returns {string} 转义后的安全 HTML 字符串
   */
  function escapeHTML(str) {
    if (str == null) return ""; // null/undefined 返回空字符串，防止后续操作报错
    if (typeof str !== "string") str = String(str);
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  /**
   * 构建国旗图片 HTML（支持 2x/3x 高清源）
   * @param {string} url - 国旗图片基础 URL（40x30 尺寸）
   @param {string} name - 队伍名称（用于 alt 属性）
   * @returns {string} 完整的 img 标签 HTML
   */
  function buildFlagHtml(url, name) {
    if (!url) return "";
    const safeUrl = escapeHTML(url);
    const safeName = escapeHTML(name || "");
    const src2x = safeUrl.replace("40x30", "80x60");
    const src3x = safeUrl.replace("40x30", "120x90");
    return `<img src="${safeUrl}" srcset="${src2x} 2x, ${src3x} 3x" width="40" height="30" alt="${safeName}" loading="lazy">`;
  }
  /**
   * 验证 ESPN 事件中的队伍是否与目标比赛匹配
   * @param {Object} event - ESPN 事件对象
   * @param {string} homeTeam - 目标主队 ID
   * @param {string} awayTeam - 目标客队 ID
   * @param {Object} teamMap - 队伍缩写映射表
   * @returns {Object|null} 匹配成功返回事件对象，否则返回 null
   */
  function verifyMatchTeams(event, homeTeam, awayTeam, teamMap) {
    if (!event || !event.competitions) return null;
    const comp = event.competitions[0];
    if (!comp) return null;
    const cs = comp.competitors || [];
    const h = cs.find((c) => c.homeAway === "home");
    const a = cs.find((c) => c.homeAway === "away");
    if (!h || !a) return null;
    const espnHome = (h.team.abbreviation || "").toUpperCase();
    const espnAway = (a.team.abbreviation || "").toUpperCase();
    const homeId = teamMap[espnHome] || espnHome;
    const awayId = teamMap[espnAway] || espnAway;
    const isMatch = homeId === homeTeam && awayId === awayTeam || homeId === awayTeam && awayId === homeTeam;
    return isMatch ? event : null;
  }
  /**
   * 将 UTC 时间转换为北京时间（UTC+8）
   * @param {Date} utcDate - UTC 时间对象
   * @returns {Date} 北京时间对象
   */
  function toBeijingTime(utcDate) {
    return new Date(utcDate.getTime() + 8 * 36e5); // UTC+8 偏移量：8小时 × 3600000毫秒
  }
  /**
   * 格式化日期为 YYYY-MM-DD 字符串
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的日期字符串
   */
  function formatDate2(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  /**
   * 格式化时间为 HH:MM 字符串
   * @param {Date} date - 日期对象
   * @returns {string} 格式化后的时间字符串
   */
  function formatTime(date) {
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  /**
   * 将ESPN赔率details字段(英文)翻译为中文
   * @param {string} details - ESPN返回的英文details描述
   * @returns {string} 中文翻译结果
   */
  function translateDetailsToChinese(details) {
    if (!details || typeof details !== "string") return "";
    let text = details.trim();
    if (!text) return "";
    const translations = window.CONFIG.ODDS_TRANSLATIONS;
    translations.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement);
    });
    // 清理多余空格
    return text.replace(/\s+/g, " ").trim();
  }
  /**
   * 将 ESPN 淘汰赛占位符缩写（如 1A/2A/3RD）转换为"小组赛X组第N名"格式的中文名称
   * @param {string} abbr - ESPN 缩写（如 "1A"、"2B"、"3RD"）
   * @returns {string|null} 中文占位名称，无法识别返回 null
   */
  function parsePlaceholderAbbr(abbr) {
    if (!abbr) return null;
    const m = abbr.match(/^([1-3])([A-L])$/);
    if (m) {
      var rankMap = window.CONFIG.RANK_MAP;
      return `\u5C0F\u7EC4\u8D5B${m[2]}\u7EC4${rankMap[m[1]]}`;
    }
    if (abbr === "3RD") return "\u5C0F\u7EC4\u8D5B\u7B2C\u4E09\u6863";
    return null;
  }
  /**
   * 根据队伍 ID 查找队伍信息（从 window.WORLD_CUP_DATA 获取）
   * @param {string} teamId - 队伍 ID
   * @param {string} [fallbackName] - 找不到时的回退名称
   * @returns {Object} 队伍对象（含 id, name, flag, isPlaceholder 字段）
   */
  function getTeamById(teamId, fallbackName) {
    if (typeof WORLD_CUP_DATA === "undefined") return { id: teamId, name: fallbackName || teamId, flag: "", isPlaceholder: true }; // 全局数据未加载时的防御性回退
    const team = WORLD_CUP_DATA.teams.find((t) => t.id === teamId);
    if (!team) return { id: teamId, name: fallbackName || teamId, flag: "", isPlaceholder: true };
    return team;
  }
  /**
   * 根据场馆 ID 查找场馆信息
   * @param {string} venueId - 场馆 ID
   * @returns {Object} 场馆对象（含 id, name, country, city, capacity 字段）
   */
  function getVenueById(venueId) {
    if (typeof WORLD_CUP_DATA === "undefined") return { id: venueId, name: venueId, country: "", city: "", capacity: 0 };
    const venue = WORLD_CUP_DATA.venues.find((v) => v.id === venueId);
    if (!venue) return { id: venueId, name: venueId, country: "", city: "", capacity: 0 };
    return venue;
  }
  /**
   * 获取比赛阶段的中文名称
   * @param {string} stage - 阶段标识（group/round32/round16/quarterfinal/semifinal/thirdplace/final）
   * @returns {string} 中文阶段名称
   */
  function getStageName(stage) {
    var stageNames = window.CONFIG.STAGE_NAMES;
    return stageNames[stage] || stage;
  }
  /**
   * 获取比赛状态的中文名称
   * @param {string} status - 状态标识（scheduled/live/finished）
   * @returns {string} 中文状态文本
   */
  function getStatusText(status) {
    var statusNames = window.CONFIG.STATUS_NAMES;
    return statusNames[status] || status;
  }
  /**
   * 获取详细比赛状态显示名（一一对应 ESPN 原始状态）
   * 有 ESPN_STATUS_DETAIL 映射时使用具体名称，否则回退到 getStatusText
   * @param {Object} match - 比赛对象
   * @returns {string} 中文状态名称
   */
  function getDetailedStatus(match) {
    var detail = window.CONFIG.ESPN_STATUS_DETAIL;
    if (match._espnStatusName && detail[match._espnStatusName]) {
      return detail[match._espnStatusName].cn;
    }
    return getStatusText(match.status);
  }
  /**
   * 判断比赛双方是否均为真实参赛队伍（非占位符如 2A、W74 等）
   * @param {Object} match - 比赛对象
   * @returns {boolean} 双方均为真实队伍返回 true
   */
  function isMatchWithRealTeams(match) {
    const home = String(match.homeTeam || "").toUpperCase();
    const away = String(match.awayTeam || "").toUpperCase();
    if (home === "" || away === "") return false;
    return TEAM_INDEX.has(home) && TEAM_INDEX.has(away);
  }
  /**
   * 判断比赛是否已确认（双方队伍 ID 非空）
   * @param {Object} match - 比赛对象
   * @returns {boolean} 已确认返回 true
   */
  function isMatchConfirmed(match) {
    const home = String(match.homeTeam || "").toUpperCase();
    const away = String(match.awayTeam || "").toUpperCase();
    if (home === "" || away === "") return false;
    return true;
  }
  /**
   * 归一化概率值，使三者之和为 100%
   * @param {number} homeProb - 主胜概率
   * @param {number|null} drawProb - 平局概率（淘汰赛可为 null）
   * @param {number} awayProb - 客胜概率
   * @returns {Object} 归一化后的概率对象 { home, draw, away }
   */
  function normalizeProbabilities(homeProb, drawProb, awayProb) {
    const total = homeProb + (drawProb || 0) + awayProb;
    if (total <= 0) return { home: 33.3, draw: 33.3, away: 33.4 };
    const scale = 100 / total;
    return {
      home: +(homeProb * scale).toFixed(1),
      draw: drawProb !== null && drawProb !== void 0 ? +(drawProb * scale).toFixed(1) : null,
      away: +(awayProb * scale).toFixed(1)
    };
  }
  /**
   * 美式赔率转十进制赔率
   * @param {string|number} american - 美式赔率（正数如 +150，负数如 -120）
   * @returns {number|null} 十进制赔率（如 2.50），无效输入返回 null
   */
  function americanToDecimal(american) {
    if (!american && american !== 0) return null;
    const n = parseInt(american, 10);
    if (isNaN(n)) return null;
    if (n > 0) return +(n / 100 + 1).toFixed(2);
    return +(100 / Math.abs(n) + 1).toFixed(2);
  }
  /**
   * 格式化美式赔率为十进制字符串
   * @param {string|number} american - 美式赔率
   * @returns {string} 十进制赔率字符串（如 "2.50"），无效输入返回 "-"
   */
  function formatDecimalOdds(american) {
    if (!american && american !== 0) return "-";
    const decimal = americanToDecimal(american);
    return decimal !== null ? decimal.toFixed(2) : "-";
  }
  /**
   * 美式赔率转隐含概率
   * 正赔率：概率 = 100 / (赔率 + 100) × 100
   * 负赔率：概率 = |赔率| / (|赔率| + 100) × 100
   * @param {string|number} american - 美式赔率
   * @returns {number|null} 隐含概率百分比（如 62.5），无效输入返回 null
   */
  function oddsToImpliedProb(american) {
    if (!american && american !== 0) return null;
    const n = parseInt(american, 10);
    if (isNaN(n)) return null;
    if (n > 0) return +(100 / (n + 100) * 100).toFixed(1);
    return +(-n / (-n + 100) * 100).toFixed(1);
  }
  /**
   * 获取场馆所在时区信息
   * @param {string} venueId - 场馆 ID
   * @returns {Object} 时区对象 { offset, name, city }
   */
  function getVenueTimezone(venueId) {
    var venueTimeZones = window.CONFIG.VENUE_TIMEZONES;
    var fallback = window.CONFIG.VENUE_TIMEZONE_FALLBACK;
    return venueTimeZones[venueId] || fallback;
  }
  /**
   * 计算比赛的北京时间与场馆本地时间
   * @param {string} dateStr - 日期字符串（YYYY-MM-DD）
   * @param {string} timeStr - 时间字符串（HH:MM，场馆本地时区）
   * @param {string} venueId - 场馆 ID
   * @returns {Object} 时间对象 { date(北京), timezone, city, originalDate(场馆本地), originalTimezoneUTC, originalCity }
   */
  function getLocalMatchTime(dateStr, timeStr, venueId, timeUTC) {
    const tz = getVenueTimezone(venueId);
    let utcMs;
    if (timeUTC) {
      // ESPN API 数据：timeUTC 是原始 ISO 字符串（如 "2026-06-11T19:00Z"），直接解析
      utcMs = new Date(timeUTC).getTime();
    } else {
      // 本地数据回退：time 是场馆本地时间，需减去场馆时区偏移得到 UTC
      // 例如：墨西哥城 13:00 CDT (UTC-6) → UTC = 13:00 - (-6) = 19:00
      const [h, m] = timeStr.split(":").map(Number);
      const localMinutes = h * 60 + m;
      const utcMinutes = localMinutes - tz.offset * 60;
      const utcHours = Math.floor(utcMinutes / 60) % 24;
      const utcMins = utcMinutes % 60;
      // 处理跨日：如果 UTC 时间小于场馆时间，日期可能需要+1天
      const adjustedDate = utcMinutes < 0
        ? new Date(new Date(dateStr).getTime() - 86400000)
        : utcMinutes >= 1440
          ? new Date(new Date(dateStr).getTime() + 86400000)
          : new Date(dateStr);
      const dateStrAdj = adjustedDate.toISOString().slice(0, 10);
      utcMs = new Date(`${dateStrAdj}T${String(utcHours < 0 ? utcHours + 24 : utcHours).padStart(2, "0")}:${String(Math.abs(utcMins)).padStart(2, "0")}:00Z`).getTime();
    }
    // 北京时间 = UTC + 8h
    const beijingDate = new Date(utcMs + 8 * 36e5);
    // 场馆本地时间 = UTC + 场馆时区偏移（西半球为负，加偏移相当于减小时差）
    const localDate = new Date(utcMs + tz.offset * 36e5);
    const offsetHours = tz.offset;
    const offsetSign = offsetHours >= 0 ? "+" : "-";
    const offsetAbs = Math.abs(offsetHours);
    const utcOffsetStr = `UTC${offsetSign}${offsetAbs}`;
    return {
      date: beijingDate,
      timezone: "UTC+8",
      city: "\u5317\u4EAC",
      originalDate: localDate,
      originalTimezone: tz.name || "UTC",
      originalTimezoneUTC: utcOffsetStr,
      originalCity: tz.city || ""
    };
  }

    /* ================================================================
   * 模块：API 客户端 (api)
   * ESPN 数据获取、赛事解析转换、阶段/分组检测、比分状态解析
   * ================================================================ */
  /** 获取全局世界杯数据（通过 window 对象访问以兼容 ES Module） */
  var WC_DATA = () => window.WORLD_CUP_DATA;
  /** 获取全局日期-队伍索引（通过 window 对象访问以兼容 ES Module） */
  var DATE_TEAM_IDX = () => window.MATCH_INDEX_BY_DATE_TEAMS;
  /**
   * 检测 ESPN 事件的比赛阶段和分组
   * 优先从 notes 中提取分组信息（小组赛），再按日期判断淘汰赛阶段
   * @param {Object} espnEvent - ESPN 事件对象
   * @returns {Object} { stage: string, group: string|null }
   */
  function detectStageAndGroup(espnEvent) {
    const dateStr = (espnEvent.date || "").slice(0, 10);
    const d = new Date(espnEvent.date || dateStr);
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    // 优先使用 ESPN season.slug 字段（权威），避免日期硬编码误判
    const slug = (espnEvent.season && espnEvent.season.slug || "").toLowerCase();
    var slugToStage = window.CONFIG.SLUG_TO_STAGE;
    if (slugToStage[slug]) {
      const notes = espnEvent.notes || [];
      for (const note of notes) {
        const text = (note.type || "") + " " + (note.text || "");
        const gMatch = text.match(/Group\s+([A-L])/i);
        if (gMatch) return { stage: slugToStage[slug], group: gMatch[1].toUpperCase() };
        const gMatch2 = text.match(/([A-L])\s*组/i);
        if (gMatch2) return { stage: slugToStage[slug], group: gMatch2[1].toUpperCase() };
      }
      return { stage: slugToStage[slug], group: null };
    }
    const notes = espnEvent.notes || [];
    for (const note of notes) {
      const text = (note.type || "") + " " + (note.text || "");
      const gMatch = text.match(/Group\s+([A-L])/i);
      if (gMatch) return { stage: "group", group: gMatch[1].toUpperCase() };
      const gMatch2 = text.match(/([A-L])\s*组/i);
      if (gMatch2) return { stage: "group", group: gMatch2[1].toUpperCase() };
    }
    if (month === 7 && day >= 5 && day <= 8) return { stage: "round16", group: null };
    if (month === 7 && (day === 10 || day === 11 || day === 12)) return { stage: "quarterfinal", group: null };
    if (month === 7 && (day === 15 || day === 16)) return { stage: "semifinal", group: null };
    if (month === 7 && day >= 18 && day <= 19) {
      const hour = d.getUTCHours();
      if (hour >= 17) return { stage: "thirdplace", group: null };
      return { stage: "final", group: null };
    }
    if (month === 6 && day >= 28 && day <= 30 || month === 7 && day <= 4) return { stage: "round32", group: null };
    return { stage: "group", group: null };
  }
  /**
   * 解析 ESPN 比赛状态为统一的状态标识
   * @param {Object} comp - ESPN 竞赛对象
   * @returns {string} 状态标识（"scheduled" / "live" / "finished"）
   */
  function parseEspnStatus(comp) {
    if (!comp) return "scheduled";
    const st = comp.status || {};
    const type = st.type || {};
    // 优先用 state 字段（ESPN 标准），回退检查 name 中的 post/final 关键字
    const state = type.state || "";
    const name = type.name || "";
    if (name === "STATUS_HALFTIME") return "halftime";
    if (state === "post" || type.completed === true) return "finished";
    if (state === "in" || name === "STATUS_IN_PROGRESS") return "live";
    return "scheduled";
  }
  /**
   * 解析 ESPN 比赛比分和比赛分钟数
   * @param {Object} comp - ESPN 竞赛对象
   * @returns {Object} { homeScore, awayScore, minute }
   */
  function parseEspnScores(comp) {
    if (!comp) return { homeScore: null, awayScore: null, minute: null };
    const st = comp.status || {};
    const type = st.type || {};
    const state = type.state || "";
    const name = type.name || "";
    const isFinished = state === "post" || type.completed === true;
    const isLive = state === "in" || name === "STATUS_IN_PROGRESS";
    if (!isFinished && !isLive) {
      return { homeScore: null, awayScore: null, minute: null };
    }
    const competitors = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeScore = home && home.score != null ? Number(home.score) : null;
    const awayScore = away && away.score != null ? Number(away.score) : null;
    let minute = null;
    if (isLive) {
      minute = st.displayClock || st.period || null;
    }
    return { homeScore, awayScore, minute };
  }
  /**
   * 将 ESPN 事件对象转换为应用内部比赛数据格式
   * 包含队伍映射、分组/场馆回退策略、占位队伍替换等逻辑
   * @param {Object} espnEvent - ESPN 事件对象
   * @param {number} index - 事件索引（用于生成回退 ID）
   * @returns {Object|null} 转换后的比赛对象，解析失败返回 null
   */
  function transformEspnEvent(espnEvent, index) {
    const comp = espnEvent.competitions && espnEvent.competitions[0];
    if (!comp) return null;
    const competitors = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) return null;
    const homeAbbr = (home.team && (home.team.abbreviation || home.team.shortDisplayName || "") || "").toUpperCase().trim();
    const awayAbbr = (away.team && (away.team.abbreviation || away.team.shortDisplayName || "") || "").toUpperCase().trim();
    let homeDisplayName = home.team && (home.team.shortDisplayName || home.team.displayName || homeAbbr) || homeAbbr;
    let awayDisplayName = away.team && (away.team.shortDisplayName || away.team.displayName || awayAbbr) || awayAbbr;
    let homeId = TEAM_MAP[homeAbbr] || homeAbbr;
    let awayId = TEAM_MAP[awayAbbr] || awayAbbr;
    const dateObj = new Date(espnEvent.date);
    const dateStr = dateObj.toISOString().slice(0, 10);
    const timeStr = dateObj.toISOString().slice(11, 16);
    const espnVenueId = comp.venue && comp.venue.id || "";
    let venueId = ESPN_VENUE_IDS.has(espnVenueId) ? espnVenueId : "";
    let { stage, group } = detectStageAndGroup(espnEvent);
    const status = parseEspnStatus(comp);
    const { homeScore, awayScore, minute } = parseEspnScores(comp);
    const espnType = comp.status?.type || {};
    const espnStatusName = espnType.name || "";
    const espnStatusDesc = espnType.description || espnType.name || "";
    let localMatch = null;
    if (stage !== "group") {
      localMatch = WC_DATA().matches.find((m) => {
        if (m.date !== dateStr || m.stage !== stage) return false;
        if (venueId && m.venue === venueId) return true;
        return false;
      });
    }
    // 回退策略：先按日期+队伍ID查索引，再遍历全量比赛按队伍对匹配
    if (!localMatch) {
      const idxKey = `${dateStr}|${homeId}|${awayId}`;
      const dateTeamIdx = DATE_TEAM_IDX();
      localMatch = dateTeamIdx ? dateTeamIdx.get(idxKey) : WC_DATA().matches.find((m) => {
        if (m.date !== dateStr) return false;
        const mh = String(m.homeTeam).toUpperCase();
        const ma = String(m.awayTeam).toUpperCase();
        return mh === homeId && ma === awayId || mh === awayId && ma === homeId;
      });
    }
    // 淘汰赛阶段：保留 ESPN 原始占位符缩写（如 2A、W74 等），仅把 _homeName/_awayName 映射为"小组赛X组第N名"中文文本
    if (stage !== "group" && localMatch) {
      const homeIsReal = TEAM_INDEX.has(homeId);
      const awayIsReal = TEAM_INDEX.has(awayId);
      if (!homeIsReal) {
        const placeholderName = parsePlaceholderAbbr(homeAbbr);
        if (placeholderName) homeDisplayName = placeholderName;
      }
      if (!awayIsReal) {
        const placeholderName = parsePlaceholderAbbr(awayAbbr);
        if (placeholderName) awayDisplayName = placeholderName;
      }
    }
    if (stage === "group" && !group && localMatch) {
      group = localMatch.group;
    }
    // ESPN notes 缺少分组信息时的回退：按队伍对在本地数据中查找分组和场馆
    if (stage === "group" && !group && !localMatch) {
      const fallbackMatch = WC_DATA().matches.find((m) => {
        const mh = String(m.homeTeam).toUpperCase();
        const ma = String(m.awayTeam).toUpperCase();
        return mh === homeId && ma === awayId || mh === awayId && ma === homeId;
      });
      if (fallbackMatch) {
        group = fallbackMatch.group;
        if (!venueId) venueId = fallbackMatch.venue;
      }
    }
    if (!venueId && localMatch) {
      venueId = localMatch.venue;
    }
    return {
      id: localMatch ? localMatch.id : 1e4 + index,
      date: dateStr,
      time: timeStr,
      timeUTC: espnEvent.date,
      homeTeam: homeId,
      awayTeam: awayId,
      _homeName: homeDisplayName,
      _awayName: awayDisplayName,
      venue: venueId,
      stage,
      group,
      status,
      homeScore,
      awayScore,
      minute,
      _espnStatusName: espnStatusName,
      _espnStatusDesc: espnStatusDesc,
      _espnId: espnEvent.id,
      _source: "espn"
    };
  }
  /** 导出 ESPN 解析工具供 liveScores.js 复用 */
  window.__espnHelpers = {
    transformEspnEvent: transformEspnEvent
  };
  /**
   * 从 ESPN API 获取赛程数据（带缓存），失败时回退到本地数据
   * @param {boolean} [forceRefresh=false] - 是否强制刷新
   * @returns {Promise<Array>} 比赛数组
   */
  async function fetchScheduleFromESPNCached(forceRefresh = false) {
    try {
      const dates = window.CONFIG.TOURNAMENT_DATE_RANGE;
      const json = await espnCache.fetch(dates, 200, forceRefresh);
      const events = json.events || [];
      const matches = [];
      events.forEach((evt, i) => {
        const m = transformEspnEvent(evt, i);
        if (m) matches.push(m);
      });
      const result = matches.length > 0 ? matches : WC_DATA().matches;
      return result;
    } catch (e) {
      return WC_DATA().matches;
    }
  }

    /* ================================================================
   * 模块：自动刷新 (auto-refresh)
   * 倒计时定时器、刷新指示器状态管理、手动/自动刷新触发
   * ================================================================ */
  /** 自动刷新间隔（30秒） */
  var AUTO_REFRESH_INTERVAL = window.CONFIG.AUTO_REFRESH_INTERVAL;
  var autoRefreshCountdownTimer = null;
  var autoRefreshCurrentView = null;
  var autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
  /** 自动刷新配置：各视图对应的倒计时元素 ID 和刷新按钮 ID */
  var AUTO_REFRESH_CONFIG = {
    schedule: {
      countdownEl: "scheduleRefreshCountdown",
      buttonId: "btnRefreshSchedule"
    },
    standings: {
      countdownEl: "standingsRefreshCountdown",
      buttonId: "btnRefreshStandings"
    }
  };
  var refreshHandlers = {};
  /**
   * 注册视图的刷新处理函数
   * @param {string} viewName - 视图名称
   * @param {Function} handler - 刷新回调函数
   */
  function setRefreshHandler(viewName, handler) {
    refreshHandlers[viewName] = handler;
  }
  /**
   * 启动指定视图的自动刷新倒计时
   * @param {string} viewName - 视图名称
   */
  function startAutoRefresh(viewName) {
    stopAutoRefresh();
    if (!AUTO_REFRESH_CONFIG[viewName]) return;
    autoRefreshCurrentView = viewName;
    autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
    updateAutoRefreshCountdown();
    autoRefreshCountdownTimer = setInterval(() => {
      autoRefreshRemaining -= 1;
      if (autoRefreshRemaining <= 0) {
        autoRefreshRemaining = 0;
        updateAutoRefreshCountdown();
        performAutoRefresh();
        autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
      } else {
        updateAutoRefreshCountdown();
      }
    }, 1e3);
  }
  /** 停止当前自动刷新倒计时 */
  function stopAutoRefresh() {
    if (autoRefreshCountdownTimer) {
      clearInterval(autoRefreshCountdownTimer);
      autoRefreshCountdownTimer = null;
    }
    autoRefreshCurrentView = null;
  }
  /** 更新倒计时显示文本 */
  function updateAutoRefreshCountdown() {
    const cfg = AUTO_REFRESH_CONFIG[autoRefreshCurrentView];
    if (!cfg) return;
    const el = document.getElementById(cfg.countdownEl);
    if (el) el.textContent = Math.max(0, autoRefreshRemaining) + "s";
  }
  /**
   * 设置刷新指示器的视觉状态
   * @param {boolean} refreshing - 是否正在刷新
   */
  function setAutoRefreshIndicatorState(refreshing) {
    const cfg = AUTO_REFRESH_CONFIG[autoRefreshCurrentView];
    if (!cfg) return;
    const btn = document.getElementById(cfg.buttonId);
    const countdown = document.getElementById(cfg.countdownEl);
    if (btn) {
      if (refreshing) btn.classList.add("btn-refresh--refreshing");
      else btn.classList.remove("btn-refresh--refreshing");
    }
    if (countdown) {
      if (refreshing) countdown.classList.add("btn-refresh--refreshing");
      else countdown.classList.remove("btn-refresh--refreshing");
    }
  }
  /** 执行当前视图的自动刷新回调 */
  function performAutoRefresh() {
    const view = autoRefreshCurrentView;
    if (!view) return;
    const handler = refreshHandlers[view];
    if (handler) {
      handler();
    }
  }
  /** 重置自动刷新倒计时为初始值 */
  function resetAutoRefreshTimer() {
    if (autoRefreshCurrentView) {
      autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
      updateAutoRefreshCountdown();
    }
  }

    /* ================================================================
   * 模块：预测引擎 (predictions)
   * 赔率解析聚合、隐含概率计算、庄家利润移除、赔率变动分析、
   * 价值投注检测、信心校准、预测卡片渲染
   * ================================================================ */
  var predMatchOddsMap2 = /* @__PURE__ */ new Map();
  var _predEspnMatches2 = null;
  /**
   * 生成推荐文案模板
   * @param {string} favorite - 看好方（"home"/"away"/"draw"）
   * @param {string|null} homeOdds - 主胜美式赔率
   * @param {string|null} drawOdds - 平局美式赔率
   * @param {string|null} awayOdds - 客胜美式赔率
   * @returns {Object|null} 推荐模板对象 { text, teamName, americanOdds, decimalOdds }
   */
  function generateRecommendationTemplate(favorite, homeOdds, drawOdds, awayOdds) {
    let teamName = "", americanOdds = null;
    if (favorite === "home") {
      teamName = "\u4E3B\u80DC";
      americanOdds = homeOdds;
    } else if (favorite === "away") {
      teamName = "\u5BA2\u80DC";
      americanOdds = awayOdds;
    } else if (favorite === "draw") {
      teamName = "\u5E73\u5C40";
      americanOdds = drawOdds;
    }
    if (!americanOdds) return null;
    const decimalOdds = americanToDecimal(americanOdds);
    if (!decimalOdds) return null;
    return { text: `\u770B\u597D${teamName}\uFF0C\u5BF9\u5E94\u7684\u8D54\u7387\u4E3A${decimalOdds}\uFF08\u56FD\u5185\u8D54\u7387\uFF09`, teamName, americanOdds, decimalOdds };
  }
  /**
   * 从 ESPN 事件中解析赔率数据（独赢、让球、大小球）
   * 按提供商名称分类（draftkings/bet365/caesars/betfair/unibet/main）
   * @param {Object} event - ESPN 事件对象
   * @returns {Object|null} 赔率信息对象，无赔率数据返回 null
   */
  function parseOddsFromEspnEvent(event) {
    const comp = event.competitions && event.competitions[0];
    if (!comp) return null;
    const oddsArr = comp.odds || [];
    if (oddsArr.length === 0) return null;
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) return null;
    const result = {
      eventId: event.id,
      date: (event.date || "").slice(0, 10),
      homeAbbr: (home.team && (home.team.abbreviation || home.team.id) || "").toUpperCase(),
      awayAbbr: (away.team && (away.team.abbreviation || away.team.id) || "").toUpperCase(),
      homeName: home.team && home.team.displayName || "",
      awayName: away.team && away.team.displayName || "",
      status: comp.status && comp.status.type && comp.status.type.state || "pre",
      providers: {}
    };
    oddsArr.forEach((o) => {
      const pName = o.provider && o.provider.name || "";
      const provider = { name: pName, details: o.details || null, moneyline: null, spread: null, total: null };
      if (o.moneyline) {
        provider.moneyline = {
          home: o.moneyline.home?.close?.odds ?? null,
          away: o.moneyline.away?.close?.odds ?? null,
          draw: o.moneyline.draw?.close?.odds ?? (o.drawOdds?.moneyLine != null ? String(o.drawOdds.moneyLine) : null),
          homeOpen: o.moneyline.home?.open?.odds ?? null,
          awayOpen: o.moneyline.away?.open?.odds ?? null,
          drawOpen: o.moneyline.draw?.open?.odds ?? null
        };
      }
      if (o.pointSpread) {
        provider.spread = {
          homeLine: o.pointSpread.home?.close?.line ?? null,
          homeOdds: o.pointSpread.home?.close?.odds ?? null,
          awayLine: o.pointSpread.away?.close?.line ?? null,
          awayOdds: o.pointSpread.away?.close?.odds ?? null,
          homeLineOpen: o.pointSpread.home?.open?.line ?? null,
          homeOddsOpen: o.pointSpread.home?.open?.odds ?? null,
          awayLineOpen: o.pointSpread.away?.open?.line ?? null,
          awayOddsOpen: o.pointSpread.away?.open?.odds ?? null
        };
      }
      if (o.total) {
        provider.total = {
          line: o.total.over?.close?.line ?? null,
          overOdds: o.total.over?.close?.odds ?? null,
          underOdds: o.total.under?.close?.odds ?? null,
          lineOpen: o.total.over?.open?.line ?? null,
          overOddsOpen: o.total.over?.open?.odds ?? null,
          underOddsOpen: o.total.under?.open?.odds ?? null
        };
      }
      const key = pName.toLowerCase().replace(/[\s()]+/g, "");
      if (key.includes("draftkings")) result.providers.draftkings = provider;
      else if (key.includes("bet365") || key.includes("365")) result.providers.bet365 = provider;
      else if (key.includes("caesars")) result.providers.caesars = provider;
      else if (key.includes("betfair")) result.providers.betfair = provider;
      else if (key.includes("unibet")) result.providers.unibet = provider;
      else if (!result.providers.main) result.providers.main = provider;
    });
    return result;
  }
  /**
   * 聚合多个提供商的赔率数据，取各方向隐含概率的中位数
   * @param {Object} oddsInfo - parseOddsFromEspnEvent 返回的赔率信息
   * @returns {Object|null} 聚合后的赔率对象（含 _aggProbs），无数据返回 null
   */
  function aggregateOdds(oddsInfo) {
    // 平台权重配置：利润率越低/精度越高的平台权重越大
    const PROVIDER_WEIGHTS = window.CONFIG.PROVIDER_WEIGHTS;
    const providers = Object.entries(oddsInfo.providers).filter(([, p]) => p.moneyline);
    if (providers.length === 0) return null;
    if (providers.length === 1) {
      const [, p] = providers[0];
      const hp = oddsToImpliedProb(p.moneyline.home), dp = oddsToImpliedProb(p.moneyline.draw), ap = oddsToImpliedProb(p.moneyline.away);
      return { ...p, providerCount: 1, _aggProbs: { home: hp, draw: dp, away: ap } };
    }
    // 加权聚合：各平台概率 × 权重 / 总权重
    let wHome = 0, wDraw = 0, wAway = 0, wTotal = 0;
    let wHomeSum = 0, wDrawSum = 0, wAwaySum = 0;
    providers.forEach(([key, p]) => {
      const hp = oddsToImpliedProb(p.moneyline.home), dp = oddsToImpliedProb(p.moneyline.draw), ap = oddsToImpliedProb(p.moneyline.away);
      if (hp !== null && ap !== null) {
        const w = PROVIDER_WEIGHTS[key] || 0.7;
        wHomeSum += hp * w;
        wAwaySum += ap * w;
        if (dp !== null) wDrawSum += dp * w;
        wTotal += w;
        wHome += hp * w;
        wAway += ap * w;
        if (dp !== null) wDraw += dp * w;
      }
    });
    if (wTotal === 0) return null;
    const providerObjs = providers.map(([, p]) => p);
    return {
      name: providerObjs.map((p) => p.name).join(" / ") + " (\u52A0\u6743\u805A\u5408)",
      providerCount: providers.length,
      _aggProbs: {
        home: +(wHomeSum / wTotal).toFixed(1),
        draw: wDrawSum > 0 ? +(wDrawSum / wTotal).toFixed(1) : null,
        away: +(wAwaySum / wTotal).toFixed(1)
      },
      spread: providerObjs.find((p) => p.spread)?.spread || null,
      total: providerObjs.find((p) => p.total)?.total || null
    };
  }
  /**
   * 移除庄家利润（overround），还原真实概率
   *
   * 算法说明：
   *   庄家利润 = 三方隐含概率之和 - 100%
   *   真实概率 = 隐含概率 / (隐含概率之和 / 100)
   *   即按比例缩放，使三方概率之和恰好为 100%
   *
   * @param {number} homeProb - 主胜隐含概率
   * @param {number|null} drawProb - 平局隐含概率
   * @param {number} awayProb - 客胜隐含概率
   * @returns {Object} { home, draw, away, overround(庄家利润率%) }
   */
  function removeOverround(homeProb, drawProb, awayProb) {
    const total = (homeProb || 0) + (drawProb || 0) + (awayProb || 0);
    if (total <= 0) return { home: homeProb, draw: drawProb, away: awayProb, overround: 0 };
    const factor = total / 100;
    return {
      home: +(homeProb / factor).toFixed(2),
      draw: drawProb != null ? +(drawProb / factor).toFixed(2) : null,
      away: +(awayProb / factor).toFixed(2),
      overround: +((factor - 1) * 100).toFixed(2)
    };
  }
  /**
   * 分析赔率变动，检测 Sharp Money（大额资金流向）
   *
   * 算法说明：
   *   计算开盘→即时赔率的隐含概率偏移量
   *   偏移量 > 5% 标记为 isSharp（大额资金信号）
   *   主胜概率上升 > 2% → favor_home
   *   主胜概率下降 > 2% → favor_away
   *   其他 → stable
   *
   * @param {Object} ml - 独赢赔率对象（含 open/close 字段）
   * @returns {Object|null} { homeShift, awayShift, isSharp, direction }
   */
  function analyzeOddsMovement(ml) {
    if (!ml || !ml.homeOpen || !ml.home) return null;
    const homeOpen = oddsToImpliedProb(ml.homeOpen), homeClose = oddsToImpliedProb(ml.home);
    const awayOpen = oddsToImpliedProb(ml.awayOpen), awayClose = oddsToImpliedProb(ml.away);
    if (homeOpen === null || homeClose === null) return null;
    const homeShift = homeClose - homeOpen, awayShift = awayClose != null && awayOpen != null ? awayClose - awayOpen : 0;
    const maxShift = Math.max(Math.abs(homeShift), Math.abs(awayShift));
    // 幅度分级：stable / moderate / sharp / extreme
    let magnitude = "stable";
    if (maxShift >= 10) magnitude = "extreme";
    else if (maxShift > 5) magnitude = "sharp";
    else if (maxShift > 2) magnitude = "moderate";
    // 方向检测
    let direction = "stable";
    if (homeShift > 2) direction = "favor_home";
    else if (homeShift < -2) direction = "favor_away";
    // 反向移动检测：主胜赔率上升但客胜赔率也上升 = 资金流向平局（职业资金信号）
    let reverseSignal = false;
    if (homeShift > 1 && awayShift > 1) {
      reverseSignal = true;
      direction = "favor_draw";
    }
    // 速率推断：大幅快速移动 = 职业资金（sharp），小幅缓慢 = 公共资金（public）
    const fundType = maxShift > 5 ? "sharp" : "public";
    return {
      homeShift: +homeShift.toFixed(1),
      awayShift: +awayShift.toFixed(1),
      isSharp: maxShift > 5,
      magnitude,
      direction,
      reverseSignal,
      fundType,
      // 信号强度评分（0-10），用于信心度校准
      signalStrength: Math.min(10, Math.round(maxShift * 1.2))
    };
  }
  /**
   * 跨市场交叉验证：让球盘和大小球对胜负倾向的信号
   * @param {Object} spread - 让球盘数据
   * @param {Object} total - 大小球数据
   * @returns {Object} { spreadSignal, totalLean, penalty }
   */
  function crossMarketAdjust(spread, total) {
    const result = { spreadSignal: null, totalLean: null, penalty: 0 };
    if (spread && spread.homeLine != null) {
      const line = parseFloat(spread.homeLine);
      if (!isNaN(line)) result.spreadSignal = line < -0.5 ? "favor_home" : line > 0.5 ? "favor_away" : "neutral";
    }
    if (total && total.line != null) {
      const line = parseFloat(total.line);
      if (!isNaN(line)) result.totalLean = line >= 2.5 ? "high_scoring" : "low_scoring";
    }
    return result;
  }
  /**
   * 校准预测信心分数
   *
   * 算法说明：
   *   基础分 = 最大概率 - 次大概率（差距越大越确定）
   *   庄家利润 < 5% → +5（市场效率高）
   *   庄家利润 > 15% → -5（数据不可靠）
   *   Sharp Money 方向与预测一致 → +8，不一致 → -5
   *   数据源 ≥ 3 → +3，仅 1 个 → -3
   *   最终 clamp 到 [10, 95] 范围
   *
   * @param {Object} norm - 归一化概率
   * @param {number} overround - 庄家利润率
   * @param {Object|null} movement - 赔率变动分析结果
   * @param {number} providerCount - 数据提供商数量
   * @returns {number} 信心分数（10-95）
   */
  function calibrateConfidence(norm, overround, movement, providerCount) {
    const sorted = [norm.home, norm.draw || 0, norm.away].sort((a, b) => b - a);
    let score = sorted[0] - sorted[1];
    // 庄家利润率影响
    if (overround < 5) score += 5;
    else if (overround > 15) score -= 5;
    // 赔率变动信号（利用增强后的 movement 对象）
    if (movement) {
      const favDir = norm.home > norm.away ? "favor_home" : "favor_away";
      // 信号强度直接加权
      if (movement.signalStrength) score += movement.signalStrength * 0.5;
      // 方向一致加成
      if (movement.direction === favDir) score += 6;
      else if (movement.direction === "favor_draw") score -= 3;
      else score -= 4;
      // 极端变动额外调整
      if (movement.magnitude === "extreme") score += 4;
      // 职业资金 vs 公共资金
      if (movement.fundType === "sharp" && movement.direction === favDir) score += 3;
    }
    // 数据源数量
    if (providerCount >= 3) score += 3;
    else if (providerCount === 1) score -= 3;
    return Math.min(95, Math.max(10, Math.round(40 + score * 1.2)));
  }
  /**
   * 检测价值投注（Value Bet）
   *
   * 算法说明：
   *   价值边缘 = 真实概率/100 × 十进制赔率 - 1
   *   当 edge > 2% 时认为存在价值投注机会
   *   即：真实概率高于赔率隐含概率时，投注具有正期望值
   *
   * @param {Object} trueProbs - 移除利润后的真实概率 { home, draw, away }
   * @param {Object} ml - 独赢赔率对象
   * @returns {Array} 价值投注数组 [{ type, edge, trueProb, decimalOdds }]
   */
  function detectValueBet(trueProbs, ml) {
    if (!ml || !trueProbs) return [];
    const valueBets = [];
    const check = (type, trueProb, americanOdds) => {
      if (trueProb === null || !americanOdds) return;
      const n = parseInt(americanOdds, 10);
      if (isNaN(n)) return;
      const decimalOdds = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
      const edge = trueProb / 100 * decimalOdds - 1;
      if (edge > 0.02) valueBets.push({ type, edge: +(edge * 100).toFixed(1), trueProb: +trueProb.toFixed(1), decimalOdds: +decimalOdds.toFixed(2) });
    };
    check("home", trueProbs.home, ml.home);
    check("draw", trueProbs.draw, ml.draw);
    check("away", trueProbs.away, ml.away);
    return valueBets;
  }
  /**
   * 计算小组赛出线概率（简化版查表法）
   *
   * 算法说明：
   *   2026世界杯小组赛规则：12组×4队，每组前2名+8个最佳第3名出线（共32队）
   *   当前积分 + 剩余比赛数 → 查表估算出线概率
   *   考虑最佳第3名规则，第3名出线概率约 67%（8/12）
   *
   * @param {string} teamId - 队伍 ID
   * @param {Array} allMatches - 全部比赛数据
   * @returns {number|null} 出线概率百分比，无数据返回 null
   */
  function calcAdvancementProb(teamId, allMatches) {
    if (!allMatches || !teamId) return null;
    // 计算该队当前积分和已赛场次
    let points = 0, played = 0, goalsFor = 0, goalsAgainst = 0;
    const groupMatches = allMatches.filter(m =>
      m.status === "finished" && (m.homeTeam === teamId || m.awayTeam === teamId)
    );
    groupMatches.forEach(m => {
      played++;
      const isHome = m.homeTeam === teamId;
      const myScore = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
      const oppScore = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
      goalsFor += myScore;
      goalsAgainst += oppScore;
      if (myScore > oppScore) points += 3;
      else if (myScore === oppScore) points += 1;
    });
    const totalGroupGames = window.CONFIG.TOTAL_GROUP_GAMES;
    const remaining = totalGroupGames - played;
    if (remaining < 0) return null;
    // 查表法：基于当前积分和剩余场次估算出线概率
    // 0分剩3场→15%, 1分→25%, 3分→50%, 4分→65%, 6分→85%, 7分→92%, 9分→99%
    const probTable = window.CONFIG.ADVANCE_PROB_TABLE;
    const row = probTable[points];
    if (!row) return null;
    const idx = remaining - 1;
    if (idx < 0 || idx > 2) return null;
    let prob = row[idx];
    // 净胜球修正：每+1球净胜 → +2%概率（上限5%）
    const gd = goalsFor - goalsAgainst;
    prob += Math.min(5, Math.max(-5, gd * 2));
    return Math.min(99, Math.max(1, prob));
  }
  /**
   * 从赔率数据推导完整预测结果
   * 流程：聚合赔率 → 移除利润 → 归一化 → 变动分析 → 交叉验证 → 信心校准 → 价值检测
   * @param {Object} oddsInfo - parseOddsFromEspnEvent 返回的赔率信息
   * @returns {Object|null} 完整预测对象
   */
  function derivePredictionFromOdds(oddsInfo) {
    const aggProvider = aggregateOdds(oddsInfo);
    if (!aggProvider) return null;
    const rawProvider = oddsInfo.providers.draftkings || oddsInfo.providers.bet365 || oddsInfo.providers.caesars || oddsInfo.providers.main;
    const pred = { homeWin: null, draw: null, awayWin: null, overUnder: null, spread: null, favorite: null, confidence: null, recommendation: "", recommendationTemplate: null, oddsSource: aggProvider.name || "\u5E02\u573A\u8D54\u7387", overround: 0, movement: null, valueBets: [], providerCount: aggProvider.providerCount || 1, isAggregated: (aggProvider.providerCount || 1) > 1, homeAdvProb: null, awayAdvProb: null };
    const aggProbs = aggProvider._aggProbs;
    if (aggProbs && aggProbs.home !== null && aggProbs.away !== null) {
      const trueProbs = removeOverround(aggProbs.home, aggProbs.draw, aggProbs.away);
      pred.overround = trueProbs.overround;
      const norm = normalizeProbabilities(trueProbs.home, trueProbs.draw, trueProbs.away);
      pred.homeWin = norm.home;
      pred.draw = norm.draw;
      pred.awayWin = norm.away;
      pred.movement = analyzeOddsMovement(rawProvider?.moneyline || {});
      const crossResult = crossMarketAdjust(aggProvider.spread, aggProvider.total);
      pred.crossMarket = crossResult;
      pred.favorite = norm.home > (norm.away || 0) ? "home" : (norm.away || 0) > norm.home ? "away" : "draw";
      pred.confidence = calibrateConfidence(norm, pred.overround, pred.movement, pred.providerCount);
      if (crossResult.spreadSignal) {
        const spreadFav = crossResult.spreadSignal, mlFav = pred.favorite === "home" ? "favor_home" : pred.favorite === "away" ? "favor_away" : "neutral";
        if (spreadFav !== "neutral" && mlFav !== "neutral" && spreadFav !== mlFav) pred.confidence = Math.max(10, pred.confidence - 8);
      }
      pred.valueBets = detectValueBet(trueProbs, rawProvider?.moneyline || {});
      const template = generateRecommendationTemplate(pred.favorite, rawProvider?.moneyline?.home, rawProvider?.moneyline?.draw, rawProvider?.moneyline?.away);
      if (pred.confidence >= 70) {
        pred.recommendation = pred.favorite === "home" ? "\u4E3B\u80DC" : pred.favorite === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40";
        if (template) pred.recommendationTemplate = template.text;
      } else if (pred.confidence >= 55) {
        pred.recommendation = pred.favorite === "home" ? "\u4E3B\u80DC\uFF08\u5C0F\u4F18\uFF09" : pred.favorite === "away" ? "\u5BA2\u80DC\uFF08\u5C0F\u4F18\uFF09" : "\u5E73\u5C40\u503E\u5411";
        if (template) pred.recommendationTemplate = template.text;
      } else {
        pred.recommendation = "\u6BD4\u8D5B\u60AC\u5FF5\u8F83\u5927";
        pred.recommendationTemplate = null;
      }
      if (pred.valueBets.length > 0) {
        const bestBet = pred.valueBets.reduce((a, b) => a.edge > b.edge ? a : b);
        const betName = bestBet.type === "home" ? "\u4E3B\u80DC" : bestBet.type === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40";
        pred.recommendationTemplate = `\u{1F4A1} \u4EF7\u503C\u673A\u4F1A\uFF1A${betName} edge +${bestBet.edge}%\uFF08\u771F\u5B9E\u6982\u7387${bestBet.trueProb}% vs \u8D54\u7387\u9690\u542B${(100 / bestBet.decimalOdds).toFixed(1)}%\uFF09`;
      }
    }
    const totalProvider = rawProvider || aggProvider;
    if (totalProvider.total) {
      const line = parseFloat(totalProvider.total.line);
      if (!isNaN(line)) {
        const overStr = totalProvider.total.overOdds ? formatDecimalOdds(totalProvider.total.overOdds) : "";
        const underStr = totalProvider.total.underOdds ? formatDecimalOdds(totalProvider.total.underOdds) : "";
        pred.overUnder = { line, lean: line >= 2.5 ? "over" : "under", description: `\u5927\u5C0F\u7403${line}\u7403${overStr && underStr ? ` (${overStr}/${underStr})` : ""}` };
      }
    }
    if (totalProvider.spread) {
      const hl = parseFloat(totalProvider.spread.homeLine);
      if (!isNaN(hl)) {
        const spreadOdds = totalProvider.spread.homeOdds ? formatDecimalOdds(totalProvider.spread.homeOdds) : "";
        pred.spread = { line: hl, description: hl < 0 ? `\u4E3B\u961F\u8BA9${Math.abs(hl)}\u7403${spreadOdds ? ` (${spreadOdds})` : ""}` : `\u5BA2\u961F\u8BA9${hl}\u7403${spreadOdds ? ` (${spreadOdds})` : ""}` };
      }
    }
    return pred;
  }
  /**
   * 构建无赔率时的回退预测（基于队伍分层矩阵）
   *
   * 算法说明：
   *   队伍分为 5 个层级（tier1~tier5），按实力梯度赋概率
   *   probMatrix 按 tierDiff（客队层级 - 主队层级）索引，偏移 +4 对齐数组下标
   *   东道主队伍（USA/MEX/CAN）额外 +2% 主/客胜概率
   *   信心分数 = max(概率) × 系数 + |tierDiff| × 6
   *
   * @param {Object} match - 比赛对象
   * @returns {Object} 回退预测对象
   */
  function buildPredFallback(match) {
    // FIFA 排名驱动概率模型（Elo 等级分公式）
    const getRank = (teamId) => {
      if (typeof WORLD_CUP_DATA !== "undefined") {
        const team = WORLD_CUP_DATA.teams.find(t => t.id === teamId);
        if (team && team.rank) return team.rank;
      }
      return 50; // 未找到排名时默认中游
    };
    const homeRank = getRank(match.homeTeam), awayRank = getRank(match.awayTeam);
    // Elo 公式：rankDiff 正值=主队更强（排名数字更小）
    const rankDiff = awayRank - homeRank; // 正=主强，负=客强
    // 用 Elo 标准公式计算主胜期望（不含平局）
    const homeExpectRaw = 1 / (1 + Math.pow(10, -rankDiff / 400));
    // 平局概率：世界杯小组赛历史约 25%，实力越接近平局率越高
    // rankDiff=0 时平局率 28%，|rankDiff|>40 时平局率降至 20%
    const drawBase = 0.28;
    const drawDecay = Math.max(0.20, drawBase - Math.abs(rankDiff) * 0.002);
    const drawProb = drawDecay;
    // 将平局概率从主胜期望中分离
    let homeProb = homeExpectRaw * (1 - drawProb);
    let awayProb = (1 - homeExpectRaw) * (1 - drawProb);
    // 东道主加成：统计上东道主效应约 +5% 主胜概率
    const hostTeams = window.CONFIG.HOST_TEAMS;
    if (hostTeams.includes(match.homeTeam)) homeProb += 0.05;
    if (hostTeams.includes(match.awayTeam)) awayProb += 0.05;
    // 归一化
    const total = homeProb + drawProb + awayProb;
    homeProb = +(homeProb / total * 100).toFixed(1);
    const dp = +(drawProb / total * 100).toFixed(1);
    awayProb = +(awayProb / total * 100).toFixed(1);
    const norm = { home: homeProb, draw: dp, away: awayProb };
    const favorite = norm.home > norm.away ? "home" : norm.away > norm.home ? "away" : "draw";
    const maxProb = Math.max(norm.home, norm.away);
    // 信心度：概率差 + 排名差加权
    const probSpread = maxProb - Math.min(norm.home, norm.away);
    const rankBonus = Math.min(20, Math.abs(rankDiff) * 0.3);
    const confidence = Math.min(88, Math.max(15, Math.round(probSpread * 1.1 + rankBonus)));
    return { homeWin: norm.home, draw: norm.draw, awayWin: norm.away, overUnder: null, spread: null, favorite, confidence, recommendation: confidence >= 65 ? favorite === "home" ? "\u4E3B\u80DC" : favorite === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40" : confidence >= 45 ? favorite === "home" ? "\u4E3B\u80DC\uFF08\u5C0F\u4F18\uFF09" : favorite === "away" ? "\u5BA2\u80DC\uFF08\u5C0F\u4F18\uFF09" : "\u5E73\u5C40\u503E\u5411" : "\u6BD4\u8D5B\u60AC\u5FF5\u8F83\u5927", oddsSource: `FIFA\u6392\u540D\u6A21\u578B(#${homeRank} vs #${awayRank})`, overround: 0, movement: null, valueBets: [], providerCount: 0, isAggregated: false, homeRank, awayRank, homeAdvProb: null, awayAdvProb: null };
  }
  /**
   * 加载比赛数据并构建所有预测（先设回退预测，再异步更新赔率预测）
   * @returns {Promise<void>}
   */
  async function loadAndBuildPredictions() {
    const container = document.getElementById("predMatchesContainer");
    if (!container) return;
    predMatchOddsMap2.clear();
    let matches = await fetchScheduleFromESPNCached();
    if (!matches || matches.length === 0) matches = window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
    _predEspnMatches2 = matches;
    const pendingMatches = matches.filter((m) => m.status !== "finished" && isMatchWithRealTeams(m));
    pendingMatches.forEach((match) => {
      const fallback = buildPredFallback(match);
      // 注入出线概率
      fallback.homeAdvProb = calcAdvancementProb(match.homeTeam, matches);
      fallback.awayAdvProb = calcAdvancementProb(match.awayTeam, matches);
      predMatchOddsMap2.set(match.id, { oddsInfo: null, prediction: fallback });
    });
    renderPredictionsList();
    updatePredStats({ total: pendingMatches.length, withOdds: 0 });
    let withOddsCount = 0;
    const promises = pendingMatches.map(async (match) => {
      try {
        const dateStr = match.date.replace(/-/g, "");
        const cached = await matchOddsCache.fetch(match.id, dateStr, match.homeTeam, match.awayTeam);
        const matchedEvent = verifyMatchTeams(cached.event, match.homeTeam, match.awayTeam, TEAM_MAP);
        if (matchedEvent) {
          const oddsInfo = parseOddsFromEspnEvent(matchedEvent);
          const prediction = derivePredictionFromOdds(oddsInfo);
          if (prediction) {
            prediction.homeAdvProb = calcAdvancementProb(match.homeTeam, matches);
            prediction.awayAdvProb = calcAdvancementProb(match.awayTeam, matches);
            predMatchOddsMap2.set(match.id, { oddsInfo, prediction });
            withOddsCount++;
          }
        }
      } catch (e) {
        console.error("[loadAndBuildPredictions] 获取赔率失败:", e.message || e);
      }
    });
    await Promise.all(promises);
    renderPredictionsList();
    updatePredStats({ total: pendingMatches.length, withOdds: withOddsCount });
  }
  /**
   * 更新预测页面的统计数字（待预测比赛数、有赔率数、更新时间）
   * @param {Object} [overrides] - 覆盖值 { total, withOdds }
   */
  function updatePredStats(overrides) {
    const totalEl = document.getElementById("phTotalMatches"), oddsEl = document.getElementById("phWithOdds"), updateEl = document.getElementById("phLastUpdate");
    const allMatches = _predEspnMatches2 && _predEspnMatches2.length > 0 ? _predEspnMatches2 : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
    const defaultTotal = allMatches.filter((m) => m.status !== "finished").length;
    if (totalEl) totalEl.textContent = overrides && overrides.total !== void 0 ? overrides.total : defaultTotal;
    if (oddsEl) oddsEl.textContent = overrides && overrides.withOdds !== void 0 ? overrides.withOdds : 0;
    if (updateEl) {
      const now = /* @__PURE__ */ new Date();
      updateEl.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
  }
  /**
   * 获取筛选后的预测比赛列表（仅真实队伍、按北京时间排序）
   * @returns {Array} 排序后的比赛数组
   */
  function getPredFilteredMatches() {
    let matches = _predEspnMatches2 && _predEspnMatches2.length > 0 ? [..._predEspnMatches2] : [...window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : []];
    matches = matches.filter(isMatchWithRealTeams);
    // 过滤掉非小组赛阶段的比赛（淘汰赛阶段队伍尚未确定，显示无意义）
    matches = matches.filter((m) => m.stage === "group");
    // 预计算北京时间排序键，避免 sort 中重复调用 getLocalMatchTime
    matches = matches.map((m) => {
      const localTime = getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      const sortKey = localTime.date.toISOString().slice(0, 10) + localTime.date.toISOString().slice(11, 16);
      return { match: m, sortKey };
    });
    matches.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return matches.map((e) => e.match);
  }
  /**
   * 渲染预测比赛列表（按日期分组，双 rAF 延迟移除 no-animation）
   */
  function renderPredictionsList() {
    const container = document.getElementById("predMatchesContainer");
    if (!container) return;
    const matches = getPredFilteredMatches();
    if (matches.length === 0) {
      container.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "pred-empty";
      empty.textContent = "\u6682\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u6BD4\u8D5B";
      container.appendChild(empty);
      return;
    }
    // 预计算本地时间，避免后续重复调用
    const grouped = {};
    matches.forEach((m) => {
      const localTime = getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      const beijingDateStr = localTime.date.toISOString().slice(0, 10);
      if (!grouped[beijingDateStr]) grouped[beijingDateStr] = [];
      grouped[beijingDateStr].push(m);
    });
    container.classList.add("no-animation");
    const htmlParts = [];
    Object.keys(grouped).sort().forEach((date) => {
      const dateObj = /* @__PURE__ */ new Date(date + "T00:00:00Z"), dateLabel = formatDate2(dateObj);
      htmlParts.push(`<div class="pred-date-group"><div class="pred-date-group__header">${dateLabel}</div><div class="pred-date-group__matches">`);
      grouped[date].forEach((match) => {
        htmlParts.push(buildPredMatchCard(match));
      });
      htmlParts.push(`</div></div>`);
    });
    const temp = document.createElement("div");
    temp.innerHTML = htmlParts.join("");
    container.replaceChildren(...temp.childNodes);
    // 事件委托：在容器上统一监听，避免逐卡片绑定
    container.querySelectorAll(".pmc-card.pmc-card--clickable").forEach((card) => {
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
    });
    if (!container._delegated) {
      container._delegated = true;
      container.addEventListener("click", (e) => {
        const card = e.target.closest(".pmc-card.pmc-card--clickable");
        if (card && card.dataset.matchId) openMatchOddsModal(card.dataset.matchId);
      });
      container.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const card = e.target.closest(".pmc-card.pmc-card--clickable");
        if (card && card.dataset.matchId) {
          e.preventDefault();
          openMatchOddsModal(card.dataset.matchId);
        }
      });
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.remove("no-animation");
      });
    });
  }
  /**
   * 构建单个预测比赛卡片的 HTML
   * @param {Object} match - 比赛对象
   * @returns {string} 卡片 HTML 字符串
   */
  function buildPredMatchCard(match) {
    const home = getTeamById(match.homeTeam, match._homeName), away = getTeamById(match.awayTeam, match._awayName);
    const venue = getVenueById(match.venue), localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const stage = getStageName(match.stage) + (match.group ? " \xB7 " + match.group + "\u7EC4" : "");
    const entry = predMatchOddsMap2.get(match.id), pred = entry ? entry.prediction : null, hasOdds = entry && entry.oddsInfo !== null;
    const isFinished = match.status === "finished", isLive = match.status === "live" || match.status === "halftime", hasScore = isFinished || isLive;
    const confClass = pred && pred.confidence >= 65 ? "high" : pred && pred.confidence >= 50 ? "med" : "low";
    let valueBetBadge = pred && pred.valueBets && pred.valueBets.length > 0 ? `<div class="pmc-card__value-bet">\u{1F48E} +${pred.valueBets.reduce((a, b) => a.edge > b.edge ? a : b).edge}%</div>` : "";
    let movementBadge = pred && pred.movement && pred.movement.isSharp ? '<div class="pmc-card__sharp-money">\u{1F525} Sharp</div>' : "";
    let sourceBadge = pred && pred.isAggregated ? `<div class="pmc-card__aggregated">\u{1F4CA} ${pred.providerCount}\u6E90</div>` : "";
    let scoreHtml = hasScore ? `<div class="pmc-card__score"><span class="pmc-card__score-num">${match.homeScore || 0}</span><span class="pmc-card__score-sep">-</span><span class="pmc-card__score-num">${match.awayScore || 0}</span></div>` : "";
    let probRingHome = pred && !isFinished ? `<div class="pmc-card__prob-ring pmc-card__prob-ring--home" style="--prob: ${pred.homeWin}"><span>${pred.homeWin}%</span></div>` : "";
    let probRingAway = pred && !isFinished ? `<div class="pmc-card__prob-ring pmc-card__prob-ring--away" style="--prob: ${pred.awayWin}"><span>${pred.awayWin}%</span></div>` : "";
    let probDetail = pred && !isFinished ? `
      <div class="pmc-card__prob-detail">
        <div class="pmc-card__prob-mini-row">
          <div class="pmc-card__prob-mini-track"><div class="pmc-card__prob-mini-fill pmc-card__prob-mini-fill--home" style="width:${pred.homeWin}%"></div></div>
          <span class="pmc-card__prob-mini-val">${pred.homeWin}%</span>
        </div>
        <div class="pmc-card__prob-mini-row">
          <div class="pmc-card__prob-mini-track"><div class="pmc-card__prob-mini-fill pmc-card__prob-mini-fill--draw" style="width:${pred.draw || 0}%"></div></div>
          <span class="pmc-card__prob-mini-val">${pred.draw !== null ? pred.draw : '-'}%</span>
        </div>
        <div class="pmc-card__prob-mini-row">
          <div class="pmc-card__prob-mini-track"><div class="pmc-card__prob-mini-fill pmc-card__prob-mini-fill--away" style="width:${pred.awayWin}%"></div></div>
          <span class="pmc-card__prob-mini-val">${pred.awayWin}%</span>
        </div>
      </div>
    ` : "";
    let confidenceBadge = pred && !isFinished ? `
      <div class="pmc-card__confidence-bar">
        <div class="pmc-card__confidence-track">
          <div class="pmc-card__confidence-fill pmc-card__confidence-fill--${confClass}" style="width: ${pred.confidence}%"></div>
        </div>
        <span class="pmc-card__confidence-text">\u4FE1\u5FC3 ${pred.confidence}%</span>
      </div>
    ` : "";
    let advProbHome = pred && pred.homeAdvProb != null ? `<span class="pmc-card__adv-prob">\u51FA\u7EBF ${pred.homeAdvProb}%</span>` : "";
    let advProbAway = pred && pred.awayAdvProb != null ? `<span class="pmc-card__adv-prob">\u51FA\u7EBF ${pred.awayAdvProb}%</span>` : "";
    let clickHint = !isLive && !isFinished ? '<span class="pmc-card__click-hint">\u70B9\u51FB\u67E5\u770B\u8D54\u7387\u8BE6\u60C5 \u2192</span>' : "";
    let liveBadge = isLive ? `<div class="pmc-card__live-indicator">\u{1F534} ${escapeHTML(getDetailedStatus(match))} ${match.minute || ""}</div>` : "";
    return `<div class="pmc-card pmc-card--clickable ${isLive ? "pmc-card--live" : ""} ${isFinished ? "pmc-card--finished" : ""}" data-match-id="${match.id}">
      <div class="pmc-card__top-bar">
        <span class="pmc-card__stage-badge">${escapeHTML(stage)}</span>
        ${liveBadge}
        <span class="pmc-card__time-capsule">
          <span class="match-card__tz">${formatTime(localTime.date)} ${localTime.timezone}</span>
        </span>
      </div>
      <div class="pmc-card__match-row">
        <div class="pmc-card__team-block pmc-card__team-block--home">
          ${probRingHome}
          <span class="pmc-card__flag">${buildFlagHtml(home.flag, home.name)}</span>
          <div class="pmc-card__team-info">
            <span class="pmc-card__team-name">${escapeHTML(home.name)}</span>
            <span class="pmc-card__team-rank">#${home.rank || '?'}</span>
            ${advProbHome}
          </div>
        </div>
        <div class="pmc-card__vs-center">
          ${scoreHtml || '<span class="pmc-card__vs-text">VS</span>'}
          ${probDetail}
        </div>
        <div class="pmc-card__team-block pmc-card__team-block--away">
          <div class="pmc-card__team-info">
            <span class="pmc-card__team-name">${escapeHTML(away.name)}</span>
            <span class="pmc-card__team-rank">#${away.rank || '?'}</span>
            ${advProbAway}
          </div>
          <span class="pmc-card__flag">${buildFlagHtml(away.flag, away.name)}</span>
          ${probRingAway}
        </div>
      </div>
      <div class="pmc-card__footer">
        ${confidenceBadge}
        <div class="pmc-card__smart-tags">
          ${valueBetBadge}${movementBadge}${sourceBadge}
        </div>
        ${clickHint}
      </div>
    </div>`;
  }
  var predFiltersSetup = false;
  /** 设置预测页面的交互事件（刷新按钮、弹窗关闭、ESC 键） */
  function setupPredFilters() {
    if (predFiltersSetup) return;
    predFiltersSetup = true;
    const refreshBtn = document.getElementById("btnRefreshPred"), modalClose = document.getElementById("oddsModalClose"), modal = document.getElementById("oddsModal");
    if (modalClose) modalClose.addEventListener("click", closeOddsModal);
    if (modal) {
      const overlay = modal.querySelector(".modal__overlay");
      if (overlay) overlay.addEventListener("click", closeOddsModal);
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && modal.classList.contains("modal--active")) closeOddsModal();
    });
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        espnCache.invalidate();
        matchOddsCache.invalidate();
        refreshBtn.classList.add("btn-refresh--spinning");
        await loadAndBuildPredictions();
        refreshBtn.classList.remove("btn-refresh--spinning");
        if (autoRefreshCurrentView === "predictions") {
          resetAutoRefreshTimer();
        }
      });
    }
  }

    /* ================================================================
   * 模块：弹窗管理 (modal)
   * 比赛详情弹窗、赔率弹窗的打开/关闭动画与内容渲染
   * ================================================================ */
  /**
   * 显示比赛详情弹窗
   * @param {Object} match - 比赛对象
   */
  function showMatchDetails(match) {
    const modal = document.getElementById("matchModal");
    const details = document.getElementById("matchDetails");
    const homeTeam = getTeamById(match.homeTeam, match._homeName);
    const awayTeam = getTeamById(match.awayTeam, match._awayName);
    const venue = getVenueById(match.venue);
    const localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const hasScore = match.status === "finished" || match.status === "live" || match.status === "halftime";
    const liveBadge = (match.status === "live" || match.status === "halftime") ? '<span class="live-dot" aria-label="\u76F4\u64AD\u4E2D"></span>' : "";
    const statusText = (match.status === "live" && match.minute) ? `${getDetailedStatus(match)} ${match.minute}` : getDetailedStatus(match);
    const homeFlagHtml = homeTeam.isPlaceholder ? '<div style="font-size: 2rem; color: var(--text-tertiary);">?</div>' : `<div style="font-size: 4.5rem; line-height: 1; margin-bottom: 0.5rem;">${buildFlagHtml(homeTeam.flag, homeTeam.name)}</div>`;
    const awayFlagHtml = awayTeam.isPlaceholder ? '<div style="font-size: 2rem; color: var(--text-tertiary);">?</div>' : `<div style="font-size: 4.5rem; line-height: 1; margin-bottom: 0.5rem;">${buildFlagHtml(awayTeam.flag, awayTeam.name)}</div>`;
    const homeNameStyle = homeTeam.isPlaceholder ? "font-style: italic; color: var(--text-tertiary);" : "";
    const awayNameStyle = awayTeam.isPlaceholder ? "font-style: italic; color: var(--text-tertiary);" : "";
    details.innerHTML = `
        <h2 id="matchModalTitle" style="margin-bottom: 1.5rem; color: var(--primary-color); text-align: center;">
            ${escapeHTML(getStageName(match.stage))}${match.group ? " - " + escapeHTML(match.group) + "\u7EC4" : ""}
        </h2>
        <div style="display: flex; justify-content: center; align-items: center; gap: 2rem; margin-bottom: 2rem;">
            <div style="text-align: center; flex: 1;">
                ${homeFlagHtml}
                <div style="font-size: 1.2rem; font-weight: 600; ${homeNameStyle}">${escapeHTML(homeTeam.name)}</div>
            </div>
            <div style="text-align: center; min-width: 100px;">
                <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-color); font-family: var(--font-num), 'Space Grotesk', monospace;">
                    ${hasScore ? `${escapeHTML(match.homeScore)} - ${escapeHTML(match.awayScore)}` : "VS"}
                </div>
                <div style="margin-top: 0.5rem; border-radius: var(--radius-md); padding: 4px 12px; display: inline-block;" class="match-card__time-status match-card__time-status--${match.status}">${liveBadge}${escapeHTML(statusText)}</div>
            </div>
            <div style="text-align: center; flex: 1;">
                ${awayFlagHtml}
                <div style="font-size: 1.2rem; font-weight: 600; ${awayNameStyle}">${escapeHTML(awayTeam.name)}</div>
            </div>
        </div>
        <div style="background: var(--bg-color); padding: 1.5rem; border-radius: var(--radius-md);">
            <div class="match-modal-info" style="display: grid; grid-template-columns: auto 1fr; gap: 1rem;">
                <div style="font-weight: 600; color: var(--text-secondary);">\u6BD4\u8D5B\u65F6\u95F4\uFF1A</div>
                <div>${formatDate2(localTime.date)} <span class="match-card__tz">${formatTime(localTime.date)} ${escapeHTML(localTime.timezone)}</span></div>
                <div style="font-weight: 600; color: var(--text-secondary);">\u573A\u9986\u65F6\u95F4\uFF1A</div>
                <div>${formatDate2(localTime.originalDate)} <span class="match-card__tz">${formatTime(localTime.originalDate)} ${escapeHTML(localTime.originalTimezoneUTC)}</span></div>
                <div style="font-weight: 600; color: var(--text-secondary);">\u6BD4\u8D5B\u573A\u5730\uFF1A</div>
                <div>${escapeHTML(venue.name)} <span style="opacity:0.6">(${escapeHTML(venue.country)}\xB7${escapeHTML(venue.city)})</span></div>
                <div style="font-weight: 600; color: var(--text-secondary);">\u7403\u573A\u5BB9\u91CF\uFF1A</div>
                <div>${venue.capacity.toLocaleString()} \u4EBA</div>
                <div style="font-weight: 600; color: var(--text-secondary);">\u6BD4\u8D5B\u9636\u6BB5\uFF1A</div>
                <div>${escapeHTML(getStageName(match.stage))}${match.group ? " - " + escapeHTML(match.group) + "\u7EC4" : ""}</div>
            </div>
        </div>
    `;
    modal.classList.add("modal--active");
    document.body.style.overflow = "hidden";
  }
  /**
   * 打开赔率详情弹窗，异步加载 ESPN 赔率数据
   * @param {string|number} matchId - 比赛 ID
   * @returns {Promise<void>}
   */
  async function openMatchOddsModal(matchId) {
    const numericId = Number(matchId);
    const matchSrc = _predEspnMatches2 && _predEspnMatches2.length > 0 ? _predEspnMatches2 : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
    const match = matchSrc.find((m) => m.id === numericId);
    if (!match) return;
    const modal = document.getElementById("oddsModal");
    const body = document.getElementById("oddsModalBody");
    const title = document.getElementById("oddsModalTitle");
    if (!modal || !body) return;
    const home = getTeamById(match.homeTeam, match._homeName);
    const away = getTeamById(match.awayTeam, match._awayName);
    title.textContent = `${home.name} vs ${away.name}`;
    modal.classList.add("modal--active");
    document.body.style.overflow = "hidden";
    body.innerHTML = `
        <div class="modal-loading">
            <div class="pred-spinner"></div>
            <span>\u6B63\u5728\u4ECE ESPN \u62C9\u53D6\u8BE5\u573A\u6BD4\u8D5B\u8D54\u7387...</span>
        </div>
    `;
    try {
      const dateStr = match.date.replace(/-/g, "");
      const cached = await matchOddsCache.fetch(numericId, dateStr, match.homeTeam, match.awayTeam);
      const event = cached.event;
      const matchedEvent = verifyMatchTeams(event, match.homeTeam, match.awayTeam, TEAM_MAP);
      if (!matchedEvent) {
        body.innerHTML = `
                <div class="modal-no-data">
                    <div class="modal-no-data__icon">\u{1F4ED}</div>
                    <div class="modal-no-data__title">\u6682\u65E0\u8D54\u7387\u6570\u636E</div>
                    <div class="modal-no-data__desc">\u8BE5\u573A\u6BD4\u8D5B\u5C1A\u672A\u5F00\u653E\u6295\u6CE8\uFF0C\u8D54\u7387\u901A\u5E38\u5728\u6BD4\u8D5B\u524D 7 \u5929\u5DE6\u53F3\u516C\u5E03\u3002\u8BF7\u7A0D\u540E\u56DE\u6765\u67E5\u770B\u3002</div>
                </div>
            `;
        return;
      }
      const oddsInfo = parseOddsFromEspnEvent(matchedEvent);
      const prediction = derivePredictionFromOdds(oddsInfo) || buildPredFallback(match);
      const payload = { event: matchedEvent, oddsInfo, prediction };
      renderModalContent(match, payload);
    } catch (e) {
      console.error("[openMatchOddsModal] 加载赔率失败:", e.message || e);
      body.innerHTML = `
            <div class="modal-no-data">
                <div class="modal-no-data__icon">\u26A0\uFE0F</div>
                <div class="modal-no-data__title">\u52A0\u8F7D\u5931\u8D25</div>
                <div class="modal-no-data__desc">\u7F51\u7EDC\u5F02\u5E38\u6216\u63A5\u53E3\u6682\u65F6\u4E0D\u53EF\u7528\uFF1A${escapeHTML(e.message || String(e))}</div>
            </div>
        `;
    }
  }
  /**
   * 渲染赔率弹窗内容（算法增强信息、独赢概率、完整赔率、场馆信息）
   * @param {Object} match - 比赛对象
   * @param {Object} payload - { event, oddsInfo, prediction }
   */
  function renderModalContent(match, payload) {
    const body = document.getElementById("oddsModalBody");
    if (!body) return;
    const { event, oddsInfo, prediction } = payload;
    const home = getTeamById(match.homeTeam, match._homeName);
    const away = getTeamById(match.awayTeam, match._awayName);
    const venue = getVenueById(match.venue);
    const localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const stage = getStageName(match.stage) + (match.group ? " \xB7 " + match.group + "\u7EC4" : "");
    const provider = oddsInfo.providers.draftkings || oddsInfo.providers.bet365 || oddsInfo.providers.caesars || oddsInfo.providers.betfair || oddsInfo.providers.unibet || null;
    const providerName = provider ? provider.name : "\u5E02\u573A";
    let enhancedInfoHtml = "";
    if (prediction) {
      const sourceInfo = prediction.isAggregated ? `\u{1F4CA} \u591A\u6E90\u805A\u5408\uFF08${prediction.providerCount} \u5BB6\u5E73\u53F0\uFF09` : `\u{1F4CA} \u5355\u6E90\u6570\u636E\uFF08${providerName}\uFF09`;
      const overroundInfo = prediction.overround > 0 ? `\u{1F4B0} \u5E84\u5BB6\u5229\u6DA6\u7387\uFF1A${prediction.overround}%` : "";
      let movementHtml = "";
      if (prediction.movement) {
        const m = prediction.movement;
        const dirText = m.direction === "favor_home" ? "\u4E3B\u961F\u8D54\u7387\u4E0B\u964D\uFF08\u770B\u597D\u4E3B\u961F\uFF09" : m.direction === "favor_away" ? "\u5BA2\u961F\u8D54\u7387\u4E0B\u964D\uFF08\u770B\u597D\u5BA2\u961F\uFF09" : "\u8D54\u7387\u7A33\u5B9A";
        const sharpBadge = m.isSharp ? " \u{1F525} Sharp Money" : "";
        movementHtml = `\u{1F4C8} \u8D54\u7387\u53D8\u52A8\uFF1A${dirText}${sharpBadge}`;
      }
      let valueBetHtml = "";
      if (prediction.valueBets && prediction.valueBets.length > 0) {
        const bestBet = prediction.valueBets.reduce((a, b) => a.edge > b.edge ? a : b);
        const betName = bestBet.type === "home" ? "\u4E3B\u80DC" : bestBet.type === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40";
        valueBetHtml = `\u{1F48E} \u4EF7\u503C\u673A\u4F1A\uFF1A${betName} +${bestBet.edge}%`;
      }
      enhancedInfoHtml = `
            <div class="modal-section enhanced-info">
                <h4 class="modal-section__title">\u{1F50D} \u7B97\u6CD5\u589E\u5F3A\u4FE1\u606F</h4>
                <div class="enhanced-info__grid">
                    <div class="enhanced-info__item">${sourceInfo}</div>
                    ${overroundInfo ? `<div class="enhanced-info__item">${overroundInfo}</div>` : ""}
                    ${movementHtml ? `<div class="enhanced-info__item">${movementHtml}</div>` : ""}
                    ${valueBetHtml ? `<div class="enhanced-info__item enhanced-info__item--highlight">${valueBetHtml}</div>` : ""}
                </div>
            </div>
        `;
    }
    let moneylineHtml = "";
    if (prediction.homeWin !== null) {
      const confClass = prediction.confidence >= 65 ? "high" : prediction.confidence >= 50 ? "med" : "low";
      const mlOdds = provider && provider.moneyline;
      const mlHome = mlOdds ? formatDecimalOdds(mlOdds.home) : "-";
      const mlDraw = mlOdds ? formatDecimalOdds(mlOdds.draw) : "-";
      const mlAway = mlOdds ? formatDecimalOdds(mlOdds.away) : "-";
      moneylineHtml = `
            <div class="modal-section">
                <h4 class="modal-section__title">\u{1F4C8} \u72EC\u8D62 (1X2)</h4>
                <div class="modal-odds__row">
                    <div class="modal-odds__cell">
                        <div class="modal-odds__label">\u4E3B\u80DC</div>
                        <div class="modal-odds__value">${prediction.homeWin}%</div>
                        <div class="modal-odds__odds-value">${mlHome}</div>
                        <div class="modal-odds__team">${escapeHTML(home.name)}</div>
                    </div>
                    ${prediction.draw !== null ? `
                    <div class="modal-odds__cell">
                        <div class="modal-odds__label">\u5E73\u5C40</div>
                        <div class="modal-odds__value">${prediction.draw}%</div>
                        <div class="modal-odds__odds-value">${mlDraw}</div>
                        <div class="modal-odds__team">-</div>
                    </div>` : ""}
                    <div class="modal-odds__cell">
                        <div class="modal-odds__label">\u5BA2\u80DC</div>
                        <div class="modal-odds__value">${prediction.awayWin}%</div>
                        <div class="modal-odds__odds-value">${mlAway}</div>
                        <div class="modal-odds__team">${escapeHTML(away.name)}</div>
                    </div>
                </div>
                <div class="modal-prob-bar">
                    <div class="modal-prob-bar__home" style="width:${prediction.homeWin}%"></div>
                    ${prediction.draw !== null ? `<div class="modal-prob-bar__draw" style="width:${prediction.draw}%"></div>` : ""}
                    <div class="modal-prob-bar__away" style="width:${prediction.awayWin}%"></div>
                </div>
                <div class="modal-recommendation">
                    <span class="modal-recommendation__text">\u63A8\u8350\uFF1A${prediction.recommendation}</span>
                    <span class="pmc-card__confidence pmc-card__confidence--${confClass}">\u4FE1\u5FC3 ${prediction.confidence}%</span>
                </div>
                ${prediction.recommendationTemplate ? `
                <div class="modal-recommendation__template">
                    <span class="modal-recommendation__template-icon">\u{1F4A1}</span>
                    <span class="modal-recommendation__template-text">${escapeHTML(prediction.recommendationTemplate)}</span>
                </div>` : ""}
            </div>
        `;
    }
    let marketRawHtml = "";
    if (provider) {
      let categoriesHtml = "";
      if (provider.moneyline) {
        const ml = provider.moneyline;
        const hasOpen = ml.homeOpen != null || ml.awayOpen != null || ml.drawOpen != null;
        if (hasOpen) {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u26BD \u72EC\u8D62\u8D54\u7387 <span class="odds-open-close__label">\u5F00\u76D8 \u2192 \u5373\u65F6</span></div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u4E3B\u80DC</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${formatDecimalOdds(ml.homeOpen)}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${formatDecimalOdds(ml.home)}</span>
                            </div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5E73\u5C40</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${formatDecimalOdds(ml.drawOpen)}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${formatDecimalOdds(ml.draw)}</span>
                            </div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5BA2\u80DC</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${formatDecimalOdds(ml.awayOpen)}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${formatDecimalOdds(ml.away)}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u26BD \u72EC\u8D62\u8D54\u7387</div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u4E3B\u80DC</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(ml.home)}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5E73\u5C40</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(ml.draw)}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5BA2\u80DC</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(ml.away)}</div>
                        </div>
                    </div>
                </div>`;
        }
      }
      if (provider.spread) {
        const sp = provider.spread;
        const hasOpen = sp.homeLineOpen != null || sp.homeOddsOpen != null;
        if (hasOpen) {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u{1F3AF} \u8BA9\u7403\u76D8 <span class="odds-open-close__label">\u5F00\u76D8 \u2192 \u5373\u65F6</span></div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u4E3B\u961F\u8BA9\u7403</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${escapeHTML(sp.homeLineOpen) || "-"}(${formatDecimalOdds(sp.homeOddsOpen)})</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${escapeHTML(sp.homeLine) || "-"}(${formatDecimalOdds(sp.homeOdds)})</span>
                            </div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5BA2\u961F\u53D7\u8BA9</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${escapeHTML(sp.awayLineOpen) || "-"}(${formatDecimalOdds(sp.awayOddsOpen)})</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${escapeHTML(sp.awayLine) || "-"}(${formatDecimalOdds(sp.awayOdds)})</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u{1F3AF} \u8BA9\u7403\u76D8</div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u8BA9\u7403\u7EBF</div>
                            <div class="odds-category__cell-value">${escapeHTML(sp.homeLine) || "-"}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u4E3B\u961F</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(sp.homeOdds)}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5BA2\u961F</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(sp.awayOdds)}</div>
                        </div>
                    </div>
                </div>`;
        }
      }
      if (provider.total) {
        const tt = provider.total;
        const hasOpen = tt.lineOpen != null || tt.overOddsOpen != null;
        if (hasOpen) {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u{1F4CA} \u5927\u5C0F\u7403 <span class="odds-open-close__label">\u5F00\u76D8 \u2192 \u5373\u65F6</span></div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u76D8\u53E3</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${escapeHTML(tt.lineOpen) || "-"}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${escapeHTML(tt.line) || "-"}</span>
                            </div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5927\u7403</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${formatDecimalOdds(tt.overOddsOpen)}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${formatDecimalOdds(tt.overOdds)}</span>
                            </div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5C0F\u7403</div>
                            <div class="odds-open-close__row">
                                <span class="odds-open-close__open">${formatDecimalOdds(tt.underOddsOpen)}</span>
                                <span class="odds-open-close__arrow">\u2192</span>
                                <span class="odds-open-close__close">${formatDecimalOdds(tt.underOdds)}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        } else {
          categoriesHtml += `
                <div class="odds-category">
                    <div class="odds-category__title">\u{1F4CA} \u5927\u5C0F\u7403</div>
                    <div class="odds-category__row">
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u76D8\u53E3</div>
                            <div class="odds-category__cell-value">${escapeHTML(tt.line) || "-"}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5927\u7403</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(tt.overOdds)}</div>
                        </div>
                        <div class="odds-category__cell">
                            <div class="odds-category__cell-label">\u5C0F\u7403</div>
                            <div class="odds-category__cell-value">${formatDecimalOdds(tt.underOdds)}</div>
                        </div>
                    </div>
                </div>`;
        }
      }
      if (categoriesHtml) {
        const detailsTranslated = provider.details ? translateDetailsToChinese(provider.details) : "";
        const detailsHtml = detailsTranslated ? `
                <div class="odds-details__badge">
                    <span class="odds-details__label">\u{1F4CB} \u6458\u8981</span>
                    <span class="odds-details__value">${escapeHTML(detailsTranslated)}</span>
                </div>` : "";
        marketRawHtml = `
                <div class="modal-section">
                    <h4 class="modal-section__title">\u{1F4B0} ${providerName} \u5B8C\u6574\u8D54\u7387</h4>
                    <div class="odds-full-grid">${categoriesHtml}</div>
                    ${detailsHtml}
                </div>
            `;
      }
    }
    let venueStatusHtml = `
        <div class="modal-meta">
            <div class="modal-meta__item">
                <span class="modal-meta__label">\u23F0 \u5F00\u8D5B\u65F6\u95F4</span>
                <span class="modal-meta__value"><span class="match-card__tz">${formatTime(localTime.date)} ${localTime.timezone}</span> / <span class="match-card__tz">${formatTime(localTime.originalDate)} ${escapeHTML(localTime.originalTimezoneUTC)}</span></span>
            </div>
            <div class="modal-meta__item">
                <span class="modal-meta__label">\u{1F3DF}\uFE0F \u6BD4\u8D5B\u573A\u5730</span>
                <span class="modal-meta__value">${escapeHTML(venue.country)}\xB7${escapeHTML(venue.city)}</span>
            </div>
            <div class="modal-meta__item">
                <span class="modal-meta__label">\u{1F3C6} \u8D5B\u4E8B\u9636\u6BB5</span>
                <span class="modal-meta__value">${escapeHTML(stage)}</span>
            </div>
        </div>
    `;
    body.innerHTML = `
        ${venueStatusHtml}
        ${enhancedInfoHtml}
        ${moneylineHtml}
        ${marketRawHtml}
        <div class="modal-footer-note">
            \u6570\u636E\u6765\u6E90\uFF1AESPN API \xB7 \u7B97\u6CD5\u7248\u672C v2.0 \xB7 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}
        </div>
    `;
  }
  var _oddsModalClosing = false;
  /**
   * 关闭赔率弹窗（带滑出动画）
   * 使用 _oddsModalClosing 标志防止重复触发
   */
  function closeOddsModal() {
    const modal = document.getElementById("oddsModal");
    if (!modal || _oddsModalClosing || !modal.classList.contains("modal--active")) return;
    _oddsModalClosing = true;
    modal.classList.add("modal--closing"); // 添加关闭过渡类
    requestAnimationFrame(() => {
      // 双 rAF 模式确保浏览器已渲染 closing 状态后再触发滑出动画
      const content = modal.querySelector(".modal__content");
      if (content) {
        content.style.animation = "modalSlideOut 0.2s ease-out forwards";
      }
    });
    setTimeout(() => {
      modal.classList.remove("modal--active", "modal--closing"); // 移除所有激活状态
      document.body.style.overflow = ""; // 恢复背景滚动
      const content = modal.querySelector(".modal__content");
      if (content) content.style.animation = ""; // 清除动画样式
      _oddsModalClosing = false; // 解除关闭锁
    }, 200);
  }
  /** 设置比赛详情弹窗的关闭事件（关闭按钮、遮罩层点击、ESC 键） */
  function setupModal() {
    const modal = document.getElementById("matchModal");
    const closeBtn = document.getElementById("modalClose");
    const overlay = modal.querySelector(".modal__overlay");
    let isClosing = false;
    function closeModal() {
      if (isClosing || !modal.classList.contains("modal--active")) return;
      isClosing = true;
      modal.classList.add("modal--closing");
      requestAnimationFrame(() => {
        const content = modal.querySelector(".modal__content");
        if (content) {
          content.style.animation = "modalSlideOut 0.2s ease-out forwards";
        }
      });
      setTimeout(() => {
        modal.classList.remove("modal--active", "modal--closing");
        document.body.style.overflow = "";
        const content = modal.querySelector(".modal__content");
        if (content) content.style.animation = "";
        isClosing = false;
      }, 200);
    }
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("modal--active")) {
        closeModal();
      }
    });
  }

    /* ================================================================
   * 模块：赛程视图 (schedule)
   * 赛程渲染、按日期分组、比赛卡片创建、筛选器设置
   * ================================================================ */
  var _lastScheduleKey = "";
  /**
   * 渲染赛程视图（按日期分组，内容去重，双 rAF 动画）
   * @param {Array|null} [filteredMatches=null] - 预筛选的比赛数组，null 则从 API 获取
   * @param {boolean} [forceRefresh=false] - 是否强制刷新 API
   * @returns {Promise<void>}
   */
  async function renderSchedule(filteredMatches = null, forceRefresh = false) {
    const container = document.getElementById("scheduleContainer");
    if (!container) return;
    const rawMatches = filteredMatches || await fetchScheduleFromESPNCached(forceRefresh);
    const matches = rawMatches;
    // 内容去重：比较比赛 ID+比分+状态的指纹，相同则跳过重渲染
    const key = matches.map((m) => `${m.id}|${m.homeScore ?? ""}|${m.awayScore ?? ""}|${m.status}|${m.minute ?? ""}`).join(",");
    if (key === _lastScheduleKey && container.children.length > 0) return;
    _lastScheduleKey = key;
    const groupedMatches = groupMatchesByDate(matches);
    container.classList.add("no-animation");
    const fragment = document.createDocumentFragment();
    if (Object.keys(groupedMatches).length === 0) {
      const noMatches = document.createElement("div");
      noMatches.className = "no-matches";
      noMatches.textContent = "\u6682\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u6BD4\u8D5B";
      fragment.appendChild(noMatches);
    } else {
      Object.keys(groupedMatches).sort().forEach((date) => {
        const dateObj = new Date(date);
        const dateGroup = createDateGroup(dateObj, groupedMatches[date]);
        fragment.appendChild(dateGroup);
      });
    }
    container.replaceChildren(fragment);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.remove("no-animation");
      });
    });
    updateMatchCount(matches.length);
  }
  /**
   * 按北京时间日期分组比赛，每组内按时间排序
   * @param {Array} matches - 比赛数组
   * @returns {Object} 日期字符串到比赛数组的映射
   */
  function groupMatchesByDate(matches) {
    const grouped = {};
    // 预计算本地时间，避免排序时重复调用 getLocalMatchTime
    const enriched = matches.map((match) => {
      const localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
      return { match, beijingDateStr: localTime.date.toISOString().slice(0, 10), timeStr: localTime.date.toISOString().slice(11, 16) };
    });
    enriched.forEach(({ match, beijingDateStr }) => {
      if (!grouped[beijingDateStr]) {
        grouped[beijingDateStr] = [];
      }
      grouped[beijingDateStr].push(match);
    });
    Object.keys(grouped).forEach((date) => {
      // 使用预计算的时间字符串排序，避免重复调用 getLocalMatchTime
      const dateItems = enriched.filter((e) => e.beijingDateStr === date);
      const sorted = dateItems.sort((a, b) => a.timeStr.localeCompare(b.timeStr));
      grouped[date] = sorted.map((e) => e.match);
    });
    return grouped;
  }
  /**
   * 创建日期分组的 DOM 元素
   * @param {Date|string} date - 日期对象或字符串
   * @param {Array} matches - 该日期下的比赛数组
   * @returns {HTMLElement} 日期分组 DOM 元素
   */
  function createDateGroup(date, matches) {
    const group = document.createElement("div");
    group.className = "date-group";
    const header = document.createElement("div");
    header.className = "date-group__header";
    const dateObj = date instanceof Date ? date : /* @__PURE__ */ new Date(date + "T00:00:00Z");
    header.textContent = formatDate(dateObj);
    group.appendChild(header);
    const matchesList = document.createElement("div");
    matchesList.className = "date-group__matches";
    matches.forEach((match) => {
      const card = createMatchCard(match);
      matchesList.appendChild(card);
    });
    group.appendChild(matchesList);
    return group;
  }
  /**
   * 创建单个比赛卡片的 DOM 元素
   * @param {Object} match - 比赛对象
   * @returns {HTMLElement} 比赛卡片 DOM 元素
   */
  function createMatchCard(match) {
    const card = document.createElement("div");
    card.className = `match-card ${match.status === "live" || match.status === "halftime" ? "match-card--live" : ""}`;
    card.dataset.matchId = match.id;
    const homeTeam = getTeamById(match.homeTeam, match._homeName);
    const awayTeam = getTeamById(match.awayTeam, match._awayName);
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${homeTeam.name} vs ${awayTeam.name}`);
    const venue = getVenueById(match.venue);
    const localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const stageClass = `match-card__stage--${match.stage}`;
    const hasScore = match.status === "finished" || match.status === "live" || match.status === "halftime";
    const statusText = (match.status === "live" && match.minute) ? `${getDetailedStatus(match)} ${match.minute}` : getDetailedStatus(match);
    const liveBadge = (match.status === "live" || match.status === "halftime") ? '<span class="live-dot" aria-label="\u76F4\u64AD\u4E2D"></span>' : "";
    const timeHtml = `<div class="match-card__time-value"><span class="match-card__tz">${formatTime(localTime.date)} ${escapeHTML(localTime.timezone)}</span></div><div style="height:16px"></div><div class="match-card__time-value"><span class="match-card__tz">${formatTime(localTime.originalDate)} ${escapeHTML(localTime.originalTimezoneUTC)}</span></div>`;
    const homeIsPlaceholder = homeTeam.isPlaceholder;
    const awayIsPlaceholder = awayTeam.isPlaceholder;
    const homeNameHtml = homeIsPlaceholder ? `<span class="match-card__name match-card__name--placeholder">${escapeHTML(homeTeam.name)}</span>` : `<span class="match-card__name">${escapeHTML(homeTeam.name)}</span>`;
    const awayNameHtml = awayIsPlaceholder ? `<span class="match-card__name match-card__name--placeholder">${escapeHTML(awayTeam.name)}</span>` : `<span class="match-card__name">${escapeHTML(awayTeam.name)}</span>`;
    const placeholderFlagHtml = '<span class="match-card__flag match-card__flag--placeholder">?</span>';
    const homeFlagHtml = homeIsPlaceholder ? placeholderFlagHtml : `<span class="match-card__flag">${buildFlagHtml(homeTeam.flag, homeTeam.name)}</span>`;
    const awayFlagHtml = awayIsPlaceholder ? placeholderFlagHtml : `<span class="match-card__flag">${buildFlagHtml(awayTeam.flag, awayTeam.name)}</span>`;
    const scoreOrStatusHtml = `<div class="match-card__status-above-vs">${liveBadge}${escapeHTML(statusText)}</div>` + (hasScore ? `<div class="match-card__score">${escapeHTML(match.homeScore)} - ${escapeHTML(match.awayScore)}</div>` : `<span class="match-card__vs">VS</span>`);
    card.innerHTML = `
        <div class="match-card__time">
            ${timeHtml}
        </div>
        <div class="match-card__teams">
            <div class="match-card__team match-card__team--home">
                ${homeNameHtml}
                ${homeFlagHtml}
            </div>
            ${scoreOrStatusHtml}
            <div class="match-card__team match-card__team--away">
                ${awayFlagHtml}
                ${awayNameHtml}
            </div>
        </div>
        <div class="match-card__info">
            <div class="match-card__venue">${escapeHTML(venue.country)}</div>
            <div class="match-card__stage match-card__stage--${match.stage}">${escapeHTML(getStageName(match.stage))}${match.group ? " - " + escapeHTML(match.group) + "\u7EC4" : ""}</div>
        </div>
    `;
    card.addEventListener("click", () => showMatchDetails(match));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showMatchDetails(match);
      }
    });
    return card;
  }
  /**
   * 设置赛程筛选器事件（阶段、分组、日期、搜索框防抖、清除按钮）
   */
  function setupFilters() {
    const stageFilter = document.getElementById("stageFilter");
    const groupFilter = document.getElementById("groupFilter");
    const dateFilter = document.getElementById("dateFilter");
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearFilters");
    const applyFilters = async () => {
      const allMatches = await fetchScheduleFromESPNCached();
      let filtered = [...allMatches];
      if (stageFilter.value !== "all") {
        filtered = filtered.filter((match) => match.stage === stageFilter.value);
      }
      if (groupFilter.value !== "all") {
        filtered = filtered.filter((match) => match.group === groupFilter.value);
      }
      if (dateFilter.value) {
        filtered = filtered.filter((match) => {
          const localTime = getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
          const beijingDateStr = localTime.date.toISOString().slice(0, 10);
          return beijingDateStr === dateFilter.value;
        });
      }
      if (searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter((match) => {
          const homeTeam = getTeamById(match.homeTeam, match._homeName);
          const awayTeam = getTeamById(match.awayTeam, match._awayName);
          return homeTeam.name.toLowerCase().includes(searchTerm) || awayTeam.name.toLowerCase().includes(searchTerm);
        });
      }
      renderSchedule(filtered);
    };
    stageFilter.addEventListener("change", applyFilters);
    groupFilter.addEventListener("change", applyFilters);
    dateFilter.addEventListener("change", applyFilters);
    let searchTimeout; // 搜索防抖定时器
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 300); // 300ms 防抖延迟
    });
    clearBtn.addEventListener("click", () => {
      stageFilter.value = "all";
      groupFilter.value = "all";
      dateFilter.value = "";
      searchInput.value = "";
      renderSchedule();
    });
  }
  /**
   * 更新比赛计数显示
   * @param {number} [count] - 比赛数量
   */
  function updateMatchCount(count = window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches.length : 0) {
    const countEl = document.getElementById("matchCount");
    countEl.textContent = `\u5171 ${count} \u573A\u6BD4\u8D5B`;
  }

    /* ================================================================
   * 模块：积分榜视图 (standings)
   * 小组积分榜计算与表格渲染
   * ================================================================ */
  /**
   * 渲染积分榜视图（仅手动刷新，无自动刷新）
   * @param {boolean} [forceRefresh=false] - 是否强制刷新
   * @returns {Promise<void>}
   */
  async function renderStandings(forceRefresh = false) {
    const container = document.getElementById("standingsContainer");
    if (!container) return;
    const espnMatches = await fetchScheduleFromESPNCached(forceRefresh);
    const standings = calculateStandings(espnMatches);
    container.classList.add("no-animation");
    const fragment = document.createDocumentFragment();
    Object.keys(standings).sort().forEach((group) => {
      const groupTable = createStandingsTable(group, standings[group]);
      fragment.appendChild(groupTable);
    });
    container.replaceChildren(fragment);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.classList.remove("no-animation");
      });
    });
  }
  /**
   * 创建小组积分榜表格 DOM 元素
   * @param {string} group - 组别名称
   * @param {Array} teamStandings - 队伍积分数据数组
   * @returns {HTMLElement} 积分榜表格 DOM 元素
   */
  function createStandingsTable(group, teamStandings) {
    const table = document.createElement("div");
    table.className = "group-table";
    const header = document.createElement("div");
    header.className = "group-table__header";
    header.textContent = `${group}\u7EC4`;
    table.appendChild(header);
    const tableEl = document.createElement("table");
    tableEl.className = "group-table__table";
    tableEl.innerHTML = `
        <thead>
            <tr>
                <th>\u961F\u4F0D</th>
                <th>\u573A\u6B21</th>
                <th>\u80DC</th>
                <th>\u5E73</th>
                <th>\u8D1F</th>
                <th>\u8FDB\u7403</th>
                <th>\u5931\u7403</th>
                <th>\u79EF\u5206</th>
            </tr>
        </thead>
        <tbody>
            ${teamStandings.map((item) => `
                <tr>
                    <td>
                        <div class="group-table__team-cell">
                            <span>${buildFlagHtml(item.team.flag, item.team.name)}</span>
                            <span>${escapeHTML(item.team.name)}</span>
                        </div>
                    </td>
                    <td>${item.played}</td>
                    <td>${item.won}</td>
                    <td>${item.drawn}</td>
                    <td>${item.lost}</td>
                    <td>${item.goalsFor}</td>
                    <td>${item.goalsAgainst}</td>
                    <td style="font-weight: 600; color: var(--primary-color);">${item.points}</td>
                </tr>
            `).join("")}
        </tbody>
    `;
    table.appendChild(tableEl);
    return table;
  }

    /* ================================================================
   * 模块：赔率分析 (analysis)
   * 赔率趋势图（Chart.js）、关键指标渲染、热门预测生成、数据导出
   * ================================================================ */
  var anaChartInstances = {};
  var anaAllOddsData = [];
  /**
   * 销毁指定 Chart.js 实例
   * @param {string} key - 图表实例键名
   */
  function anaDestroyChart(key) {
    if (anaChartInstances[key]) {
      anaChartInstances[key].destroy();
      delete anaChartInstances[key];
    }
  }
  /**
   * 获取 ESPN 记分板数据（含赔率）
   * @returns {Promise<Object|null>} ESPN API 数据，失败返回 null
   */
  async function anaFetchScoreboardWithOdds() {
    try {
      const dates = anaBuildDateRangeStr();
      const data = await espnCache.fetch(dates, 200);
      return data;
    } catch (e) {
      return null;
    }
  }
  /**
   * 构建赔率分析的日期范围字符串（前7天到后80天）
   * @returns {string} 日期范围字符串（YYYYMMDD-YYYYMMDD）
   */
  function anaBuildDateRangeStr() {
    const base = /* @__PURE__ */ new Date();
    const start = new Date(base);
    start.setDate(start.getDate() - 7);
    const end = new Date(base);
    end.setDate(end.getDate() + 80);
    return start.toISOString().slice(0, 10).replace(/-/g, "") + "-" + end.toISOString().slice(0, 10).replace(/-/g, "");
  }
  /**
   * 生成赔率趋势模拟数据（14天时间窗口，带随机抖动和收敛）
   * @param {Object} oddsInfo - 赔率信息对象
   * @param {string} provider - 提供商键名
   * @param {string} oddsType - 赔率类型（"moneyline"/"spread"/"total"）
   * @returns {Array|null} 趋势数据点数组
   */
  function anaGenerateTrendData(oddsInfo, provider, oddsType) {
    const p = oddsInfo.providers[provider];
    if (!p) return null;
    const baseDate = new Date(oddsInfo.date);
    const points = [];
    const numPoints = 14;
    let baseHome, baseAway, baseDraw;
    if (oddsType === "moneyline" && p.moneyline) {
      baseHome = anaAmericanToDecimal(p.moneyline.home);
      baseAway = anaAmericanToDecimal(p.moneyline.away);
      baseDraw = anaAmericanToDecimal(p.moneyline.draw);
    } else if (oddsType === "spread" && p.spread) {
      baseHome = parseFloat(p.spread.homeLine) || 0;
      baseAway = parseFloat(p.spread.awayLine) || 0;
      baseDraw = 0;
    } else if (oddsType === "total" && p.total) {
      baseHome = parseFloat(p.total.line) || 2.5;
      baseAway = baseHome;
      baseDraw = 0;
    } else {
      return null;
    }
    for (let i = numPoints; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const jitter = (Math.random() - 0.5) * 0.15;
      const convergence = (numPoints - i) / numPoints;
      const homeVal = oddsType === "moneyline" ? +(baseHome + jitter * (1 - convergence * 0.7)).toFixed(3) : +(baseHome + jitter * 0.3 * (1 - convergence)).toFixed(2);
      const awayVal = oddsType === "moneyline" ? +(baseAway + jitter * 0.8 * (1 - convergence * 0.5)).toFixed(3) : +(baseAway + jitter * 0.3 * (1 - convergence)).toFixed(2);
      const drawVal = oddsType === "moneyline" ? +(baseDraw + jitter * 0.5 * (1 - convergence * 0.6)).toFixed(3) : null;
      points.push({
        date: d.toISOString().slice(0, 10),
        home: homeVal,
        away: awayVal,
        draw: drawVal
      });
    }
    if (oddsType === "moneyline" && p.moneyline) {
      points[points.length - 1].home = anaAmericanToDecimal(p.moneyline.home);
      points[points.length - 1].away = anaAmericanToDecimal(p.moneyline.away);
      points[points.length - 1].draw = anaAmericanToDecimal(p.moneyline.draw);
    }
    return points;
  }
  /**
   * 美式赔率转十进制赔率（分析模块专用，默认返回 2）
   * @param {string|number} american - 美式赔率
   * @returns {number} 十进制赔率
   */
  function anaAmericanToDecimal(american) {
    if (!american) return 2;
    const n = parseInt(american, 10);
    if (isNaN(n)) return 2;
    if (n > 0) return +(n / 100 + 1).toFixed(3);
    return +(100 / Math.abs(n) + 1).toFixed(3);
  }
  /**
   * 初始化赔率分析模块（填充比赛选择器、设置默认提示）
   * @returns {Promise<void>}
   */
  async function initOddsModule() {
    const select = document.getElementById("oddsMatchSelect");
    const chartWrap = document.getElementById("oddsTrendChart")?.parentElement;
    const kp = document.getElementById("oddsKeyPoints");
    if (!select) return;
    select.innerHTML = '<option value="">-- \u8BF7\u9009\u62E9\u6BD4\u8D5B --</option>';
    anaAllOddsData = [];
    if (kp) kp.innerHTML = "";
    if (chartWrap && !document.getElementById("oddsEmptyHint")) {
      const empty = document.createElement("div");
      empty.id = "oddsEmptyHint";
      empty.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text-tertiary);text-align:center;padding:24px;";
      empty.innerHTML = `
            <div style="font-size:36px;opacity:0.6;">\u{1F4CA}</div>
            <div style="font-size:14px;font-weight:600;color:var(--text-secondary);">\u9009\u62E9\u4E00\u573A\u6BD4\u8D5B\u67E5\u770B\u8D54\u7387\u8D8B\u52BF</div>
            <div style="font-size:12px;color:var(--text-light);">\u4ECE\u4E0A\u65B9\u4E0B\u62C9\u6846\u4E2D\u9009\u62E9\u6BD4\u8D5B\uFF0C\u6216\u5207\u6362\u5230\u9884\u6D4B\u5206\u6790\u9875\u9762\u6D4F\u89C8\u6240\u6709\u6BD4\u8D5B</div>
        `;
      chartWrap.style.position = "relative";
      chartWrap.appendChild(empty);
    }
    const canvas = document.getElementById("oddsTrendChart");
    if (canvas) canvas.style.opacity = "0.15";
    const wcData = window.WORLD_CUP_DATA;
    if (!wcData || !wcData.matches) return;
    const matches = [...wcData.matches].filter((m) => isMatchWithRealTeams(m));
    // 预计算排序键，避免 sort 中重复调用 toBeijingTime
    const enriched = matches.map((m) => {
      const localTime = getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      const sortKey = localTime.date.toISOString().slice(0, 10) + localTime.date.toISOString().slice(11, 16);
      const beijingDateStr = localTime.date.toISOString().slice(0, 10);
      return { match: m, sortKey, beijingDateStr };
    });
    enriched.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    if (enriched.length === 0) return;
    enriched.forEach(({ match, beijingDateStr }) => {
      const home = typeof getTeamById === "function" ? getTeamById(match.homeTeam, match._homeName) : null;
      const away = typeof getTeamById === "function" ? getTeamById(match.awayTeam, match._awayName) : null;
      const opt = document.createElement("option");
      opt.value = match.id;
      opt.textContent = `${home ? home.name : match.homeTeam} vs ${away ? away.name : match.awayTeam} \xB7 ${beijingDateStr}`;
      opt.dataset.matchId = match.id;
      select.appendChild(opt);
    });
    select.onchange = () => {
      const matchId = select.value;
      if (!matchId) return;
      loadAndRenderAnalysisMatch(matchId);
    };
    // 动态更新分析页覆盖比赛统计
    const anaCovered = document.getElementById("anaCoveredMatches");
    if (anaCovered) anaCovered.textContent = matches.length;
  }
  /**
   * 加载并渲染指定比赛的赔率分析
   * @param {string|number} matchId - 比赛 ID
   * @returns {Promise<void>}
   */
  async function loadAndRenderAnalysisMatch(matchId) {
    const match = window.MATCH_INDEX_BY_ID ? window.MATCH_INDEX_BY_ID.get(Number(matchId)) : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches.find((m) => m.id === Number(matchId)) : null;
    if (!match) return;
    const empty = document.getElementById("oddsEmptyHint");
    if (empty) empty.remove();
    const canvas = document.getElementById("oddsTrendChart");
    if (canvas) canvas.style.opacity = "1";
    const chartWrap = document.getElementById("oddsTrendChart")?.parentElement;
    const kp = document.getElementById("oddsKeyPoints");
    if (kp) kp.innerHTML = '<div class="modal-loading"><div class="pred-spinner"></div><span>\u52A0\u8F7D\u8BE5\u573A\u6BD4\u8D5B\u8D54\u7387...</span></div>';
    let payload = null;
    try {
      const dateStr = match.date.replace(/-/g, "");
      const cached = await matchOddsCache.fetch(Number(matchId), dateStr, match.homeTeam, match.awayTeam);
      const matchedEvent = verifyMatchTeams(cached.event, match.homeTeam, match.awayTeam, TEAM_MAP);
      payload = { event: matchedEvent, match };
    } catch (e) {
      console.error("[loadAndRenderAnalysisMatch] 加载赔率失败:", e.message || e);
      if (kp) kp.innerHTML = `<p style="color:var(--accent-color);text-align:center;">\u52A0\u8F7D\u5931\u8D25\uFF1A${escapeHTML(e.message || String(e))}</p>`;
      return;
    }
    if (!payload.event) {
      if (kp) kp.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:24px;">\u8BE5\u573A\u6BD4\u8D5B\u6682\u65E0\u8D54\u7387\u6570\u636E</p>';
      anaAllOddsData = [];
      anaDestroyChart("oddsTrend");
      return;
    }
    const oddsInfo = parseOddsFromEspnEvent(payload.event);
    anaAllOddsData = [oddsInfo];
    const providerTabs2 = document.getElementById("providerTabs");
    if (providerTabs2) {
      const buttons = providerTabs2.querySelectorAll(".provider-tabs__btn");
      let firstVisible = null;
      buttons.forEach((btn) => {
        const key = btn.dataset.provider;
        const hasData = key && oddsInfo.providers && oddsInfo.providers[key];
        btn.style.display = hasData ? "" : "none";
        if (hasData && !firstVisible) firstVisible = btn;
      });
      const active = providerTabs2.querySelector(".provider-tabs__btn--active");
      if (active && active.style.display === "none" && firstVisible) {
        active.classList.remove("provider-tabs__btn--active");
        active.setAttribute("aria-selected", "false");
        firstVisible.classList.add("provider-tabs__btn--active");
        firstVisible.setAttribute("aria-selected", "true");
      }
    }
    const activeProvider = document.querySelector("#providerTabs .provider-tabs__btn.provider-tabs__btn--active")?.dataset.provider || "draftkings";
    if (typeof anaRenderKeyPoints === "function") anaRenderKeyPoints(oddsInfo, activeProvider, "moneyline");
    if (typeof anaGenerateTrendData === "function") {
      const trend = anaGenerateTrendData(oddsInfo, activeProvider, "moneyline");
      if (trend) anaDrawQuickTrend(trend, oddsInfo);
    }
  }
  /**
   * 快速绘制赔率趋势图（Chart.js 折线图，含主胜/客胜/平局三条线）
   * @param {Array} trend - 趋势数据点数组
   * @param {Object} oddsInfo - 赔率信息对象
   */
  function anaDrawQuickTrend(trend, oddsInfo) {
    const ctx = document.getElementById("oddsTrendChart");
    if (!ctx) return;
    anaDestroyChart("oddsTrend");
    const labels = trend.map((p) => p.date.slice(5));
    // Chart.js 折线图配置：三条数据线（主胜/客胜/平局），交互模式为 index
    anaChartInstances["oddsTrend"] = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "\u4E3B\u80DC",
            data: trend.map((p) => p.home),
            borderColor: ANA_CHART_COLORS.primary,
            backgroundColor: ANA_CHART_COLORS.primary + "20",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: 2.5
          },
          {
            label: "\u5BA2\u80DC",
            data: trend.map((p) => p.away),
            borderColor: ANA_CHART_COLORS.accent,
            backgroundColor: ANA_CHART_COLORS.accent + "20",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: 2.5
          },
          {
            label: "\u5E73\u5C40",
            data: trend.map((p) => p.draw || null),
            borderColor: ANA_CHART_COLORS.secondary,
            backgroundColor: ANA_CHART_COLORS.secondary + "20",
            fill: false,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
            borderDash: [5, 3]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { usePointStyle: true, padding: 16, font: { family: "'Noto Sans SC', sans-serif", size: 12 } } },
          tooltip: { backgroundColor: "rgba(26,54,93,0.95)", padding: 12, cornerRadius: 8 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: "rgba(0,0,0,0.05)" }, title: { display: true, text: "\u8D54\u7387(\u5341\u8FDB\u5236)", font: { size: 12 } }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }
  /**
   * 渲染赔率趋势图（根据当前选中的提供商和赔率类型）
   */
  function renderOddsTrend() {
    if (anaAllOddsData.length === 0) return;
    const oddsInfo = anaAllOddsData[0];
    const provider = document.querySelector("#providerTabs .provider-tabs__btn.provider-tabs__btn--active")?.dataset.provider || "draftkings";
    const oddsType = document.getElementById("filterOddsType")?.value || "moneyline";
    const trend = anaGenerateTrendData(oddsInfo, provider, oddsType);
    if (!trend) {
      anaDestroyChart("oddsTrend");
      const kp = document.getElementById("oddsKeyPoints");
      if (kp) kp.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;">\u8BE5\u6BD4\u8D5B\u6682\u65E0\u6B64\u7C7B\u578B\u8D54\u7387\u6570\u636E</p>';
      return;
    }
    const labels = trend.map((p) => p.date.slice(5));
    const datasets = [];
    const teamLabel = oddsType === "total" ? { home: "\u5927\u7403", away: "\u5C0F\u7403" } : { home: oddsInfo.homeName, away: oddsInfo.awayName };
    const chartColors = {
      home: getComputedStyle(document.documentElement).getPropertyValue("--secondary-color").trim() || "#d4a843",
      away: getComputedStyle(document.documentElement).getPropertyValue("--status-live").trim() || "#ef4444",
      draw: getComputedStyle(document.documentElement).getPropertyValue("--text-light").trim() || "#94a3b8"
    };
    datasets.push({
      label: teamLabel.home,
      data: trend.map((p) => p.home),
      borderColor: chartColors.home,
      backgroundColor: chartColors.home + "14",
      fill: oddsType === "moneyline",
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: chartColors.home,
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      borderWidth: 2
    });
    datasets.push({
      label: teamLabel.away,
      data: trend.map((p) => p.away),
      borderColor: chartColors.away,
      backgroundColor: chartColors.away + "14",
      fill: oddsType === "moneyline",
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: chartColors.away,
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      borderWidth: 2
    });
    if (oddsType === "moneyline" && trend[0].draw !== null) {
      datasets.push({
        label: "\u5E73\u5C40",
        data: trend.map((p) => p.draw),
        borderColor: chartColors.draw,
        backgroundColor: "transparent",
        fill: false,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: chartColors.draw,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        borderWidth: 1.5,
        borderDash: [6, 4]
      });
    }
    anaDestroyChart("oddsTrend");
    const ctx = document.getElementById("oddsTrendChart");
    if (!ctx) return;
    anaChartInstances["oddsTrend"] = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              usePointStyle: false,
              boxWidth: 16,
              boxHeight: 2,
              padding: 20,
              font: { family: "'Noto Sans SC', sans-serif", size: 12, weight: "500" },
              color: "#64748b"
            }
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.92)",
            titleFont: { family: "'Noto Sans SC', sans-serif", size: 13, weight: "600" },
            bodyFont: { family: "'Noto Sans SC', sans-serif", size: 12 },
            padding: { top: 12, right: 16, bottom: 12, left: 16 },
            cornerRadius: 10,
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            displayColors: true,
            boxPadding: 6
          }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              font: { family: "'Noto Sans SC', sans-serif", size: 11 },
              color: "var(--text-light)",
              maxRotation: 0,
              padding: 8
            },
            border: { display: false }
          },
          y: {
            grid: { color: "rgba(148,163,184,0.08)", drawBorder: false },
            title: {
              display: true,
              text: oddsType === "moneyline" ? "\u8D54\u7387 (\u5341\u8FDB\u5236)" : oddsType === "spread" ? "\u8BA9\u7403\u6570" : "\u8FDB\u7403\u6570",
              font: { family: "'Noto Sans SC', sans-serif", size: 11, weight: "500" },
              color: "var(--text-light)",
              padding: { top: 0, bottom: 12 }
            },
            ticks: {
              font: { family: "'Noto Sans SC', sans-serif", size: 11 },
              color: "var(--text-light)",
              padding: 8
            },
            border: { display: false },
            beginAtZero: false
          }
        },
        layout: {
          padding: { top: 8, right: 16, bottom: 4, left: 8 }
        }
      }
    });
    anaRenderKeyPoints(oddsInfo, provider, oddsType);
  }
  /**
   * 渲染赔率关键指标面板
   * @param {Object} oddsInfo - 赔率信息对象
   * @param {string} provider - 提供商键名
   * @param {string} oddsType - 赔率类型
   */
  function anaRenderKeyPoints(oddsInfo, provider, oddsType) {
    const p = oddsInfo.providers[provider];
    const kp = document.getElementById("oddsKeyPoints");
    if (!kp) return;
    if (!p) {
      kp.innerHTML = "";
      return;
    }
    const points = [];
    if (oddsType === "moneyline" && p.moneyline) {
      const fav = p.moneyline.home && p.moneyline.away && parseInt(p.moneyline.home) < parseInt(p.moneyline.away) ? escapeHTML(oddsInfo.homeName) : escapeHTML(oddsInfo.awayName);
      points.push({ label: "\u70ED\u95E8\u65B9", value: fav, desc: `\u72EC\u8D62\u8D54\u7387\u6700\u4F4E` });
      points.push({ label: "\u4E3B\u80DC\u8D54\u7387", value: p.moneyline.home || "-", desc: "DraftKings \u72EC\u8D62" });
      points.push({ label: "\u5E73\u5C40\u8D54\u7387", value: p.moneyline.draw || "-", desc: "\u5E73\u5C40\u56DE\u62A5" });
      points.push({ label: "\u5BA2\u80DC\u8D54\u7387", value: p.moneyline.away || "-", desc: "\u5BA2\u961F\u72EC\u8D62" });
    } else if (oddsType === "spread" && p.spread) {
      points.push({ label: "\u8BA9\u7403\u65B9", value: p.spread.homeLine || "-", desc: `${escapeHTML(oddsInfo.homeName)} \u8BA9\u7403` });
      points.push({ label: "\u53D7\u8BA9\u65B9", value: p.spread.awayLine || "-", desc: `${escapeHTML(oddsInfo.awayName)} \u53D7\u8BA9` });
      points.push({ label: "\u4E3B\u961F\u8D54\u7387", value: p.spread.homeOdds || "-", desc: "\u8BA9\u7403\u8D54\u7387" });
      points.push({ label: "\u5BA2\u961F\u8D54\u7387", value: p.spread.awayOdds || "-", desc: "\u53D7\u8BA9\u8D54\u7387" });
    } else if (oddsType === "total" && p.total) {
      points.push({ label: "\u5927\u5C0F\u7403\u7EBF", value: p.total.line || "-", desc: "\u603B\u5206\u7EBF" });
      points.push({ label: "\u5927\u7403\u8D54\u7387", value: p.total.overOdds || "-", desc: "Over \u8D54\u7387" });
      points.push({ label: "\u5C0F\u7403\u8D54\u7387", value: p.total.underOdds || "-", desc: "Under \u8D54\u7387" });
      points.push({ label: "\u8D8B\u52BF", value: parseFloat(p.total.line) > 2.5 ? "\u504F\u5411\u5927\u7403" : "\u504F\u5411\u5C0F\u7403", desc: "\u5E02\u573A\u9884\u671F" });
    }
    kp.innerHTML = points.map((pt, i) => {
      const icons = ["trending_up", "sports_soccer", "balance", "sports_soccer"];
      const icon = icons[i % icons.length];
      return `
        <div class="key-point">
            <div class="key-point__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    ${icon === "trending_up" ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' : '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="12" y1="2" x2="12" y2="22"/>'}
                </svg>
            </div>
            <div class="key-point__content">
                <div class="key-point__label">${pt.label}</div>
                <div class="key-point__value">${escapeHTML(pt.value)}</div>
                <div class="key-point__desc">${pt.desc}</div>
            </div>
        </div>
    `;
    }).join("");
  }
  /**
   * 生成热门预测列表（按热度排序，最多15条）
   * 热度计算：基础50 + Sharp Money + 信心 + 价值投注 + 即将开赛加分
   * @returns {Array} 热门预测数组
   */
  function generateHotPredictions() {
    const predictions = [];
    const now = /* @__PURE__ */ new Date();
    predMatchOddsMap2.forEach((entry, matchId) => {
      if (!entry || !entry.prediction) return;
      const pred = entry.prediction;
      const oddsInfo = entry.oddsInfo;
      const matchSrc = _predEspnMatches2 && _predEspnMatches2.length > 0 ? _predEspnMatches2 : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
      const match = matchSrc.find((m) => m.id === matchId);
      if (!match) return;
      if (match.status === "finished") return;
      let heat = 50;
      if (pred.movement && pred.movement.isSharp) heat += 15;
      if (pred.movement && pred.movement.homeShift) heat += Math.min(10, Math.abs(pred.movement.homeShift));
      if (pred.confidence >= 70) heat += 10;
      if (pred.confidence >= 80) heat += 5;
      if (pred.valueBets && pred.valueBets.length > 0) heat += 10;
      if (pred.isAggregated) heat += 5;
      const localTime = getLocalMatchTime(match.date, match.time || "12:00", match.venue, match.timeUTC);
      const daysUntilMatch = (localTime.date - now) / (1e3 * 60 * 60 * 24);
      if (daysUntilMatch <= 1) heat += 15;
      else if (daysUntilMatch <= 3) heat += 10;
      else if (daysUntilMatch <= 7) heat += 5;
      heat = Math.min(99, Math.max(30, Math.round(heat)));
      let accuracy = pred.confidence || 50;
      if (pred.isAggregated) accuracy += 5;
      if (pred.movement && pred.movement.isSharp) accuracy += 3;
      accuracy = Math.min(95, Math.max(40, Math.round(accuracy)));
      const expertViews = {
        "home": ["\u4E3B\u961F\u4F18\u52BF\u660E\u663E\uFF0C\u6709\u671B\u53D6\u80DC", "\u4E3B\u573A\u6C14\u52BF\u52A0\u6301\uFF0C\u770B\u597D\u4E3B\u961F", "\u4E3B\u961F\u9635\u5BB9\u9F50\u6574\uFF0C\u72B6\u6001\u6B63\u4F73"],
        "away": ["\u5BA2\u961F\u5B9E\u529B\u5360\u4F18\uFF0C\u6709\u671B\u5BA2\u573A\u53D6\u80DC", "\u5BA2\u961F\u8FD1\u671F\u72B6\u6001\u706B\u70ED\uFF0C\u770B\u597D\u5BA2\u80DC", "\u5BA2\u961F\u7ECF\u9A8C\u4E30\u5BCC\uFF0C\u5BA2\u573A\u4F5C\u6218\u80FD\u529B\u5F3A"],
        "draw": ["\u53CC\u65B9\u5B9E\u529B\u63A5\u8FD1\uFF0C\u5E73\u5C40\u53EF\u80FD\u6027\u5927", "\u52BF\u5747\u529B\u654C\u7684\u6BD4\u8D5B\uFF0C\u96BE\u4EE5\u5206\u51FA\u80DC\u8D1F", "\u4E24\u961F\u98CE\u683C\u76F8\u514B\uFF0C\u9884\u8BA1\u5E73\u5C40\u6536\u573A"]
      };
      const viewPool = expertViews[pred.favorite] || expertViews["draw"];
      const expertView = pred.recommendationTemplate || viewPool[Math.floor(Math.random() * viewPool.length)];
      const experts = ["\u674E\u660E", "\u738B\u78CA", "\u5F20\u4F1F", "\u9648\u521A", "\u5218\u6D0B", "\u8D75\u5F3A", "\u5B59\u9E4F", "\u5468\u6D9B", "\u5434\u660A", "\u9EC4\u4F1F"];
      const expert = experts[Math.floor(Math.random() * experts.length)];
      const stageName = getStageName(match.stage) + (match.group ? " \xB7 " + match.group + "\u7EC4" : "");
      predictions.push({
        home: match.homeTeam,
        away: match.awayTeam,
        date: match.date,
        stage: stageName,
        homeWin: pred.homeWin,
        draw: pred.draw,
        awayWin: pred.awayWin,
        accuracy,
        heat,
        expert,
        expertView,
          confidence: pred.confidence,
        overround: pred.overround,
        movement: pred.movement,
        valueBets: pred.valueBets,
        providerCount: pred.providerCount,
        isAggregated: pred.isAggregated
      });
    });
    predictions.sort((a, b) => b.heat - a.heat);
    return predictions.slice(0, 15);
  }
  var hotPredictions = generateHotPredictions;
  /**
   * 导出分析数据为 JSON 文件（含赔率数据和预测结果）
   */
  function anaExportData() {
    const data = {
      exportTime: (/* @__PURE__ */ new Date()).toISOString(),
      oddsData: anaAllOddsData,
      predictions: hotPredictions()
    };
    // 构建 JSON Blob 并触发下载
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldcup-analysis-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  var anaEventListenersSetup = false;
  /** 设置分析页面的事件监听器（提供商标签切换、赔率类型筛选、导出按钮） */
  function setupAnalysisEventListeners() {
    if (anaEventListenersSetup) return;
    anaEventListenersSetup = true;
    const providerTabs = document.getElementById("providerTabs");
    if (providerTabs) {
      providerTabs.addEventListener("click", (e) => {
        if (!e.target.classList.contains("provider-tabs__btn")) return;
        providerTabs.querySelectorAll(".provider-tabs__btn").forEach((b) => {
          b.classList.remove("provider-tabs__btn--active");
          b.setAttribute("aria-selected", "false");
        });
        e.target.classList.add("provider-tabs__btn--active");
        e.target.setAttribute("aria-selected", "true");
        renderOddsTrend();
      });
    }
    const filterOddsType = document.getElementById("filterOddsType");
    if (filterOddsType) {
      filterOddsType.addEventListener("change", () => {
        renderOddsTrend();
      });
    }
    const btnExport = document.getElementById("btnExport");
    if (btnExport) btnExport.addEventListener("click", anaExportData);
  }
  /** 初始化分析区域 */
  function initAnalysisSection() {
    initOddsModule();
  }

    /* ================================================================
   * 模块：应用初始化 (app)
   * 视图切换、自动刷新按钮绑定、移动端菜单、DOM 加载入口
   * ================================================================ */
  /**
   * 切换视图（隐藏其他视图，激活目标视图，触发对应初始化逻辑）
   * @param {string} viewName - 视图名称（schedule/standings/predictions/analysis）
   */
  function switchView(viewName) {
    ["schedule", "standings", "predictions", "analysis"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    const filtersSection = document.getElementById("view-schedule-filters");
    if (filtersSection) filtersSection.classList.add("hidden");
    const viewElement = document.getElementById(viewName);
    if (viewElement) viewElement.classList.remove("hidden");
    if (viewName === "schedule" && filtersSection) {
      filtersSection.classList.remove("hidden");
    }
    document.querySelectorAll(".nav__link").forEach((link) => {
      link.classList.remove("nav__link--active");
      if (link.getAttribute("href") === "#" + viewName) {
        link.classList.add("nav__link--active");
      }
    });
    if (viewName === "predictions") {
      loadAndBuildPredictions().catch((e) => console.error("[switchView] 加载预测失败:", e.message || e));
      setupPredFilters();
    } else if (viewName === "standings") {
      if (typeof renderStandings === "function") {
        renderStandings(true).catch((e) => console.error("[switchView] 渲染积分榜失败:", e.message || e));
      }
    } else if (viewName === "schedule") {
      if (typeof renderSchedule === "function") {
        renderSchedule().catch((e) => console.error("[switchView] 渲染赛程失败:", e.message || e));
      }
    } else if (viewName === "analysis") {
      setupAnalysisEventListeners();
      initAnalysisSection();
    }
    if (viewName === "standings" || viewName === "analysis") return;
    startAutoRefresh(viewName);
  }
  /**
   * 执行赛程自动刷新
   * @returns {Promise<void>}
   */
  async function runScheduleAutoRefresh() {
    setAutoRefreshIndicatorState(true);
    try {
      await renderSchedule(null, true);
      if (typeof updateMatchCount === "function") {
        updateMatchCount();
      }
      // 同步刷新积分榜数据，确保两个视图数据一致
      await renderStandings(true);
    } catch (e) {
      console.error("[runScheduleAutoRefresh] 刷新赛程失败:", e.message || e);
    } finally {
      setAutoRefreshIndicatorState(false);
    }
  }
  /**
   * 执行分析页面自动刷新（清空缓存后重新加载）
   * @returns {Promise<void>}
   */
  async function runAnalysisAutoRefresh() {
    const btn = document.getElementById("btnRefreshAna");
    const prevDisabled = btn ? btn.disabled : false;
    if (btn) {
      btn.classList.add("btn-refresh--spinning");
      btn.disabled = true;
    }
    try {
      espnCache.invalidate();
      matchOddsCache.invalidate();
      if (typeof anaFetchScoreboardWithOdds === "function") {
        await anaFetchScoreboardWithOdds();
      }
      if (typeof initAnalysisSection === "function") {
        initAnalysisSection();
      }
    } catch (e) {
      console.error("[runAnalysisAutoRefresh] 刷新分析数据失败:", e.message || e);
    } finally {
      if (btn) {
        btn.classList.remove("btn-refresh--spinning");
        btn.disabled = prevDisabled;
      }
    }
  }
  /** 设置各视图的刷新按钮点击事件 */
  function setupAutoRefreshButtons() {
    const scheduleBtn = document.getElementById("btnRefreshSchedule");
    if (scheduleBtn) {
      scheduleBtn.addEventListener("click", () => {
        scheduleBtn.classList.add("btn-refresh--spinning");
        runScheduleAutoRefresh().catch((e) => console.error("[refresh] 刷新赛程失败:", e.message || e));
        setTimeout(() => scheduleBtn.classList.remove("btn-refresh--spinning"), 800);
        resetAutoRefreshTimer();
      });
    }
    const standingsBtn = document.getElementById("btnRefreshStandings");
    if (standingsBtn) {
      standingsBtn.addEventListener("click", async () => {
        standingsBtn.classList.add("btn-refresh--spinning");
        await renderStandings(true);
        standingsBtn.classList.remove("btn-refresh--spinning");
      });
    }
    const anaBtn = document.getElementById("btnRefreshAna");
    if (anaBtn) {
      anaBtn.addEventListener("click", async () => {
        anaBtn.classList.add("btn-refresh--spinning");
        await runAnalysisAutoRefresh();
        anaBtn.classList.remove("btn-refresh--spinning");
      });
    }
  }
  /** 设置移动端汉堡菜单的展开/收起切换 */
  function setupMobileMenu() {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileNav = document.getElementById("mainNav");
    mobileBtn.addEventListener("click", () => {
      mobileBtn.classList.toggle("header__mobile-btn--active");
      mobileNav.classList.toggle("nav--active");
      const expanded = mobileBtn.classList.contains("header__mobile-btn--active");
      mobileBtn.setAttribute("aria-expanded", expanded);
    });
  }
  document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("click", function(e) {
      const navLink = e.target.closest(".nav__link[data-view]");
      if (navLink) {
        e.preventDefault();
        const viewName = navLink.getAttribute("data-view");
        if (viewName) {
          switchView(viewName);
        }
      }
    });
    setupFilters();
    setupMobileMenu();
    setupModal();
    setupAutoRefreshButtons();
    setRefreshHandler("schedule", runScheduleAutoRefresh);
    setRefreshHandler("standings", runScheduleAutoRefresh);
    updateMatchCount();
    switchView("schedule");
    setupPredFilters();
    // 后台轮询已取消：刷新按钮的自动倒计时（30秒）负责触发视图更新
  });
})();
