/**
 * @fileoverview 工具函数模块
 * @description 纯工具函数，无依赖，可安全地最先加载
 */
(function() {
  window.App = window.App || {};
  window.App.utils = window.App.utils || {};

  var _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /**
   * HTML 实体转义，防止 XSS
   * @param {string|null} str - 待转义的字符串
   * @returns {string} 转义后的字符串，null/undefined 返回空字符串
   */
  function escapeHTML(str) {
    if (str == null) return ""; // null/undefined 返回空字符串，防止后续操作报错
    if (typeof str !== "string") str = String(str);
    return str.replace(/[&<>"']/g, function(c) { return _escapeMap[c]; });
  }
  /**
   * 构建国旗图片 HTML（支持 2x/3x 高清源）
   * @param {string} url - 国旗图片基础 URL（40x30 尺寸）
   * @param {string} name - 队伍名称（用于 alt 属性）
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
   * 使用 Map 索引实现 O(1) 查找，避免每次渲染都线性扫描 teams 数组
   * @param {string} teamId - 队伍 ID
   * @param {string} [fallbackName] - 找不到时的回退名称
   * @returns {Object} 队伍对象（含 id, name, flag, isPlaceholder 字段）
   */
  var _teamMap = null;
  function getTeamById(teamId, fallbackName) {
    if (typeof WORLD_CUP_DATA === "undefined") return { id: teamId, name: fallbackName || teamId, flag: "", isPlaceholder: true };
    if (!_teamMap) {
      _teamMap = new Map();
      WORLD_CUP_DATA.teams.forEach(function(t) { _teamMap.set(t.id, t); });
    }
    var team = _teamMap.get(teamId);
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
    var venueMap = window.VENUE_BY_ID;
    var venue = venueMap ? venueMap.get(venueId) : WORLD_CUP_DATA.venues.find(function(v) { return v.id === venueId; });
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
    return window.TEAM_INDEX.has(home) && window.TEAM_INDEX.has(away);
  }
  /**
   * 判断比赛是否为淘汰赛占位比赛（双方或一方为占位符）
   * 淘汰赛阶段的队伍尚未确定，显示"小组赛X组第N名"之类的占位符
   * @param {Object} match - 比赛对象
   * @returns {boolean} 是淘汰赛占位比赛返回 true
   */
  function isKnockoutPlaceholder(match) {
    const stage = (match.stage || "").toLowerCase();
    const home = String(match.homeTeam || "").toUpperCase();
    const away = String(match.awayTeam || "").toUpperCase();
    // 淘汰赛占位判断：队伍ID为TBD/W开头的占位符、或名称为中文占位文本
    const isTBD = home === "TBD" || away === "TBD" || /^W\d+$/.test(home) || /^W\d+$/.test(away);
    const name = ((match._homeName || "") + (match._awayName || ""));
    return isTBD || name.includes("\u5C0F\u7EC4\u8D5B");
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
    if (total <= 0) return null;
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
      city: "\u5317\u4EAC", // "北京"
      originalDate: localDate,
      originalTimezone: tz.name || "UTC",
      originalTimezoneUTC: utcOffsetStr,
      originalCity: tz.city || ""
    };
  }

  // 导出到全局
  window.escapeHTML = escapeHTML;
  window.buildFlagHtml = buildFlagHtml;
  window.formatDate2 = formatDate2;
  window.formatTime = formatTime;
  window.translateDetailsToChinese = translateDetailsToChinese;
  window.parsePlaceholderAbbr = parsePlaceholderAbbr;
  window.getTeamById = getTeamById;
  window.getVenueById = getVenueById;
  window.getStageName = getStageName;
  window.getStatusText = getStatusText;
  window.getDetailedStatus = getDetailedStatus;
  window.isMatchWithRealTeams = isMatchWithRealTeams;
  window.isKnockoutPlaceholder = isKnockoutPlaceholder;
  window.normalizeProbabilities = normalizeProbabilities;
  window.americanToDecimal = americanToDecimal;
  window.formatDecimalOdds = formatDecimalOdds;
  window.oddsToImpliedProb = oddsToImpliedProb;
  window.getVenueTimezone = getVenueTimezone;
  window.getLocalMatchTime = getLocalMatchTime;

  window.App.utils.escapeHTML = escapeHTML;
  window.App.utils.buildFlagHtml = buildFlagHtml;
  window.App.utils.formatDate2 = formatDate2;
  window.App.utils.formatTime = formatTime;
  window.App.utils.translateDetailsToChinese = translateDetailsToChinese;
  window.App.utils.parsePlaceholderAbbr = parsePlaceholderAbbr;
  window.App.utils.getTeamById = getTeamById;
  window.App.utils.getVenueById = getVenueById;
  window.App.utils.getStageName = getStageName;
  window.App.utils.getStatusText = getStatusText;
  window.App.utils.getDetailedStatus = getDetailedStatus;
  window.App.utils.isMatchWithRealTeams = isMatchWithRealTeams;
  window.App.utils.isKnockoutPlaceholder = isKnockoutPlaceholder;
  window.App.utils.normalizeProbabilities = normalizeProbabilities;
  window.App.utils.americanToDecimal = americanToDecimal;
  window.App.utils.formatDecimalOdds = formatDecimalOdds;
  window.App.utils.oddsToImpliedProb = oddsToImpliedProb;
  window.App.utils.getVenueTimezone = getVenueTimezone;
  window.App.utils.getLocalMatchTime = getLocalMatchTime;
})();