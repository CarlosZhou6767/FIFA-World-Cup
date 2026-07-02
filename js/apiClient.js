/**
 * @fileoverview ESPN API 客户端模块
 * @description 数据获取、转换、缓存
 */
(function() {
  window.App = window.App || {};
  window.App.api = window.App.api || {};
  /** ESPN 比赛记分板 API 端点地址 */
  var ESPN_API = window.CONFIG.ESPN_API;

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
    _abortControllers: {},
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
        if (now - entry.timestamp < this.TTL) return entry.data;
      }
      if (this._inFlight.has(key)) return this._inFlight.get(key);
      // 按 key 独立管理 AbortController，避免并发请求互相 abort
      if (this._abortControllers[key]) {
        try { this._abortControllers[key].abort(); } catch(e) {}
      }
      var controller = new AbortController();
      this._abortControllers[key] = controller;
      var signal = controller.signal;
      const cacheOpt = forceRefresh ? "reload" : "default";
      const promise = fetch(`${ESPN_API}?dates=${dateRange}&limit=${limit}`, { cache: cacheOpt, signal: signal }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then((data) => {
        this._store.set(key, { data, timestamp: Date.now() });
        this._inFlight.delete(key);
        delete this._abortControllers[key];
        this._evict();
        return data;
      }).catch((err) => {
        this._inFlight.delete(key);
        delete this._abortControllers[key];
        if (err.name === 'AbortError') return null;
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
      // 扩大日期范围到 ±2 天，覆盖时区差异（北京时间比 UTC 快 8 小时）
      const d = /* @__PURE__ */ new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T00:00:00Z`);
      const prev = new Date(d.getTime() - 2 * 864e5);
      const next = new Date(d.getTime() + 2 * 864e5);
      const fmt = (dt) => `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
      const dateRange = `${fmt(prev)}-${fmt(next)}`;
      const data = await espnCache.fetch(dateRange, 150);
      if (!data) return { event: null, _ts: Date.now() };
      // 查找本地比赛对象，用于计算预期 UTC 时间（球队 + 比赛时间双校验）
      const localMatch = window.MATCH_INDEX_BY_ID ? window.MATCH_INDEX_BY_ID.get(matchId) : null;
      let expectedUtcMs = null;
      if (localMatch && window.getLocalMatchTime) {
        try {
          const lt = window.getLocalMatchTime(localMatch.date, localMatch.time, localMatch.venue, localMatch.timeUTC);
          // getLocalMatchTime 返回北京时间，反推 UTC：北京 - 8h
          expectedUtcMs = lt.date.getTime() - 8 * 3600 * 1000;
        } catch (e) { /* 计算失败时仅按球队匹配 */ }
      }
      // 球队匹配候选列表（可能有多场同对阵比赛，需用时间二次确认）
      const candidates = (data.events || []).filter((ev) => {
        const comp = ev.competitions && ev.competitions[0];
        if (!comp) return false;
        const cs = comp.competitors || [];
        const h = cs.find((c) => c.homeAway === "home");
        const a = cs.find((c) => c.homeAway === "away");
        if (!h || !a) return false;
        const espnHome = (h.team.abbreviation || "").toUpperCase();
        const espnAway = (a.team.abbreviation || "").toUpperCase();
        const homeId = window.TEAM_MAP[espnHome] || espnHome;
        const awayId = window.TEAM_MAP[espnAway] || espnAway;
        if (homeTeam && awayTeam) {
          return homeId === homeTeam && awayId === awayTeam || homeId === awayTeam && awayId === homeTeam;
        }
        return false;
      });
      // 时间二次确认：选择与预期 UTC 时间最接近的事件（±4 小时容差）
      let event = null;
      if (candidates.length === 1) {
        event = candidates[0];
      } else if (candidates.length > 1) {
        if (expectedUtcMs !== null) {
          let bestDiff = Infinity;
          candidates.forEach((ev) => {
            const evMs = new Date(ev.date).getTime();
            const diff = Math.abs(evMs - expectedUtcMs);
            if (diff < bestDiff && diff <= 4 * 3600 * 1000) {
              bestDiff = diff;
              event = ev;
            }
          });
        }
        // 时间校验失败时回退到第一个候选
        if (!event) event = candidates[0];
      }
      // scoreboard 端点返回的 competitions[0].odds 通常为 [null]，
      // 需通过 summary 端点获取完整赔率数据
      if (event && event.id) {
        try {
          const summaryUrl = `${window.CONFIG.ESPN_API_BASE}/summary?event=${event.id}`;
          const summaryResp = await fetch(summaryUrl, { cache: "default" });
          if (summaryResp.ok) {
            const summary = await summaryResp.json();
            const headerComp = summary && summary.header && summary.header.competitions && summary.header.competitions[0];
            const odds = summary && summary.odds;
            if (headerComp && odds && odds.length > 0) {
              event = {
                id: event.id,
                date: event.date,
                competitions: [{
                  ...headerComp,
                  odds: odds
                }]
              };
            }
          }
        } catch (e) {
          // summary 调用失败时回退到 scoreboard 事件（可能无赔率数据）
        }
      }
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


  /** 获取全局世界杯数据（通过 window 对象访问以兼容 ES Module） */
  var WC_DATA = () => window.WORLD_CUP_DATA;
  /** 获取全局日期-队伍索引（通过 window 对象访问以兼容 ES Module） */
  var DATE_TEAM_IDX = () => window.MATCH_INDEX_BY_DATE_TEAMS;

  var parsePlaceholderAbbr = function(abbr) { return window.parsePlaceholderAbbr(abbr); };

  /**
   * 从 ESPN 事件 notes 中提取小组标识（A-L）
   * 支持 "Group X" 和 "X组" 两种格式
   * @param {Array<Object>} notes - ESPN notes 数组
   * @returns {string|null} 小组字母（大写），未找到返回 null
   */
  function extractGroupFromNotes(notes) {
    for (var i = 0; i < notes.length; i++) {
        var text = (notes[i].type || "") + " " + (notes[i].text || "");
        var gMatch = text.match(/Group\s+([A-L])/i);
        if (gMatch) return gMatch[1].toUpperCase();
        var gMatch2 = text.match(/([A-L])\s*组/i);
        if (gMatch2) return gMatch2[1].toUpperCase();
    }
    return null;
  }

  /**
   * 检测 ESPN 事件的比赛阶段和分组
   * 优先从 notes 中提取分组信息（小组赛），再按日期判断淘汰赛阶段
   * @param {Object} espnEvent - ESPN 事件对象
   * @returns {Object} { stage: string, group: string|null }
   */
  function detectStageAndGroup(espnEvent) {
    var dateStr = (espnEvent.date || "").slice(0, 10);
    var d = new Date(espnEvent.date || dateStr);
    var month = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    var slug = (espnEvent.season && espnEvent.season.slug || "").toLowerCase();
    var slugToStage = window.CONFIG.SLUG_TO_STAGE;
    var notes = espnEvent.notes || [];
    var group = extractGroupFromNotes(notes);
    if (slugToStage[slug]) {
        return { stage: slugToStage[slug], group: group };
    }
    if (group) return { stage: "group", group: group };
    if (month === 7 && day >= 5 && day <= 8) return { stage: "round16", group: null };
    if (month === 7 && (day === 10 || day === 11 || day === 12)) return { stage: "quarterfinal", group: null };
    if (month === 7 && (day === 15 || day === 16)) return { stage: "semifinal", group: null };
    if (month === 7 && day >= 18 && day <= 19) {
        var hour = d.getUTCHours();
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
    let homeId = window.TEAM_MAP[homeAbbr] || homeAbbr;
    let awayId = window.TEAM_MAP[awayAbbr] || awayAbbr;
    const dateObj = new Date(espnEvent.date);
    // 转换为北京时间（UTC+8）日期，与本地数据保持一致
    var bjDate = new Date(dateObj.getTime() + 8 * 3600 * 1000);
    const dateStr = bjDate.toISOString().slice(0, 10);
    const timeStr = bjDate.toISOString().slice(11, 16);
    const espnVenueId = comp.venue && comp.venue.id || "";
    let venueId = window.ESPN_VENUE_IDS.has(espnVenueId) ? espnVenueId : "";
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
      const homeIsReal = window.TEAM_INDEX.has(homeId);
      const awayIsReal = window.TEAM_INDEX.has(awayId);
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


  /**
   * 从 ESPN API 获取赛程数据（带缓存），失败时回退到本地数据
   * @param {boolean} [forceRefresh=false] - 是否强制刷新
   * @returns {Promise<Array>} 比赛数组
   */
  async function fetchScheduleFromESPNCached(forceRefresh = false) {
    try {
      const dates = window.CONFIG.TOURNAMENT_DATE_RANGE;
      const json = await espnCache.fetch(dates, 200, forceRefresh);
      if (!json) return WC_DATA().matches;
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

  /**
   * 从 ESPN 事件中解析赔率数据（独赢、让球、大小球）
   * 按提供商名称分类（draftkings/bet365/caesars/betfair/unibet/main）
   * @param {Object} event - ESPN 事件对象
   * @returns {Object|null} 赔率信息对象，无赔率数据返回 null
   */
  function parseOddsFromEspnEvent(event) {
    if (!event) return null;
    const comp = event.competitions && event.competitions[0];
    if (!comp) return null;
    const oddsArr = comp.odds || [];
    if (oddsArr.length === 0) return null;
    const competitors = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
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
      if (!o) return;
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
        // ESPN API 返回的 line 带前缀（如 "o2.5"/"u2.5"），需去除前缀提取数字
        const rawLine = o.total.over?.close?.line ?? null;
        const rawLineOpen = o.total.over?.open?.line ?? null;
        const parseLine = (s) => {
          if (s == null) return null;
          const m = String(s).match(/-?\d+\.?\d*/);
          return m ? parseFloat(m[0]) : null;
        };
        provider.total = {
          line: parseLine(rawLine),
          overOdds: o.total.over?.close?.odds ?? null,
          underOdds: o.total.under?.close?.odds ?? null,
          lineOpen: parseLine(rawLineOpen),
          overOddsOpen: o.total.over?.open?.odds ?? null,
          underOddsOpen: o.total.under?.open?.odds ?? null
        };
      }
      // 半场盘口（如果API返回）
      if (o.halfTime || o.firstHalf) {
        const ht = o.halfTime || o.firstHalf;
        provider.halfTime = {
          home: ht.home?.close?.odds ?? null,
          away: ht.away?.close?.odds ?? null,
          draw: ht.draw?.close?.odds ?? null
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
    if (Object.keys(result.providers).length === 0) return null;
    return result;
  }

  // 导出
  window.espnCache = espnCache;
  window.matchOddsCache = matchOddsCache;
  window.detectStageAndGroup = detectStageAndGroup;
  window.parseEspnStatus = parseEspnStatus;
  window.parseEspnScores = parseEspnScores;
  window.transformEspnEvent = transformEspnEvent;
  window.__espnHelpers = { transformEspnEvent: transformEspnEvent };
  window.fetchScheduleFromESPNCached = fetchScheduleFromESPNCached;
  window.parseOddsFromEspnEvent = parseOddsFromEspnEvent;
})();
