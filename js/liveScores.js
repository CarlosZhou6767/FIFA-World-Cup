/**
 * @fileoverview 实时比分模块 —— 通过 ESPN API 轮询世界杯实时比分，
 * 管理本地缓存与 TTL 过期策略，支持自动刷新倒计时与页面可见性感知，
 * 并将标准化后的比分数据同步到全局 WORLD_CUP_DATA。
 */
window.App = window.App || {};
window.App.liveScores = window.App.liveScores || {};

/** ESPN 世界杯比分板 API 基础地址 */
const ESPN_API_BASE = window.CONFIG.ESPN_API_BASE;

/** 轮询间隔，30 秒（同时作为缓存 TTL 上限） */
const POLL_INTERVAL_MS = window.CONFIG.AUTO_REFRESH_INTERVAL;

/** ESPN 原始状态 → 内部统一状态映射表 */
const STATUS_MAP = window.CONFIG.ESPN_STATUS_MAP;

/** 本届世界杯参赛队伍缩写集合，用于过滤非目标赛事 */
const trackedTeamAbbrs = new Set();
if (typeof WORLD_CUP_DATA !== 'undefined' && Array.isArray(WORLD_CUP_DATA.teams)) {
    WORLD_CUP_DATA.teams.forEach(t => {
        if (t && t.id) trackedTeamAbbrs.add(t.id.toUpperCase());
    });
}


/**
 * 解析比赛双方队伍缩写及比分
 * @param {Object} competition - ESPN 赛事竞争对象
 * @returns {Object|null} 包含 homeAbbr/awayAbbr/homeScore/awayScore 的对象，解析失败返回 null
 */
function parseCompetitors(competition) {
    const list = (competition && competition.competitors) || [];
    const home = list.find(c => c.homeAway === 'home');
    const away = list.find(c => c.homeAway === 'away');
    if (!home || !away) return null;
    const homeAbbr = (home.team && (home.team.abbreviation || home.team.id)) || '';
    const awayAbbr = (away.team && (away.team.abbreviation || away.team.id)) || '';
    return {
        homeAbbr: String(homeAbbr).toUpperCase(),
        awayAbbr: String(awayAbbr).toUpperCase(),
        homeScore: parseInt(home.score, 10) || 0,
        awayScore: parseInt(away.score, 10) || 0,
    };
}

/**
 * 判断赛事是否属于 2026 世界杯
 * 返回 season.year === 2026，否则回退为 true（不阻塞 UI）
 */
function isMatchInOurWorldCup(event) {
    return !event.season || event.season.year === 2026;
}

/**
 * 将 ESPN 赛事数据标准化为内部统一格式
 * 主体委托给 apiClient.js 的 transformEspnEvent 以消除重复解析逻辑，
 * 仅保留 liveScores.js 特有的队伍过滤和字段映射
 * @param {Object} event - ESPN 赛事对象
 * @returns {Object|null} 标准化后的比赛对象，不属于本届世界杯或队伍不在跟踪列表则返回 null
 */
function standardizeEvent(event) {
    if (!isMatchInOurWorldCup(event)) return null;
    const competition = (event.competitions && event.competitions[0]) || null;
    if (!competition) return null;

    const comp = parseCompetitors(competition);
    if (!comp) return null;
    // 过滤掉不在参赛队伍集合中的占位队伍
    if (trackedTeamAbbrs.size && (!trackedTeamAbbrs.has(comp.homeAbbr) || !trackedTeamAbbrs.has(comp.awayAbbr))) {
        return null;
    }

    const date = (event.date || '').slice(0, 10);
    const venueId = competition.venue && competition.venue.id ? String(competition.venue.id) : null;

    // 委托给 apiClient.js 的 transformEspnEvent（如果已加载），获取共享解析结果
    let homeScore = null, awayScore = null, status = 'scheduled', minute = null;
    let espnStatusName = '', espnStatusDesc = '';
    if (typeof window.__espnHelpers?.transformEspnEvent === 'function') {
        const shared = window.__espnHelpers.transformEspnEvent(event, 0);
        if (shared) {
            homeScore = shared.homeScore;
            awayScore = shared.awayScore;
            status = shared.status;
            minute = shared.minute;
            espnStatusName = shared._espnStatusName || '';
            espnStatusDesc = shared._espnStatusDesc || '';
        }
    } else {
        // apiClient.js 未加载时的独立回退解析
        status = (function() {
            const st = competition.status;
            if (!st) return 'scheduled';
            const state = (st.type && st.type.state) || '';
            const name = (st.type && st.type.name) || '';
            if (STATUS_MAP[state]) return STATUS_MAP[state];
            if (STATUS_MAP[name]) return STATUS_MAP[name];
            if (state === 'post' || state === 'in' || state === 'pre') return state === 'in' ? 'live' : (state === 'post' ? 'finished' : 'scheduled');
            return 'scheduled';
        })();
        minute = (function() {
            const st = competition.status;
            if (!st || st.type?.state !== 'in') return null;
            if (st.displayClock && window.CONFIG.MINUTE_REGEX.test(String(st.displayClock).replace("'", ''))) return String(st.displayClock);
            if (st.period && typeof st.period === 'number') {
                const pm = st.period <= 2 ? (st.period - 1) * 45 : 90 + (st.period - 3) * 15;
                return `${Math.min(pm + (Math.floor(st.clock / 60) || 0), 120)}'`;
            }
            return "进行中";
        })();
        const et = competition.status?.type || {};
        espnStatusName = et.name || '';
        espnStatusDesc = et.description || et.name || '';
    }

    return {
        espnEventId: event.id,
        date: date,
        homeAbbr: comp.homeAbbr,
        awayAbbr: comp.awayAbbr,
        homeScore: homeScore,
        awayScore: awayScore,
        status: status,
        minute: minute,
        venueId: venueId,
        _espnStatusName: espnStatusName,
        _espnStatusDesc: espnStatusDesc,
        updatedAt: Date.now(),
    };
}

/**
 * 本地缓存对象
 * - matches: 以 espnEventId 为键的 Map，存储标准化后的比赛数据
 * - lastFetch: 上次成功拉取的时间戳，用于 TTL 过期判断
 * - inFlight: 当前进行中的请求 Promise，防止并发堆积
 * - listeners: 比分更新回调列表
 * - abortController: 请求中断控制器，用于取消上一次未完成的请求
 */
const cache = {
    matches: new Map(),
    lastFetch: 0,
    inFlight: null,
    listeners: [],
    abortController: null,
};

/**
 * 从 ESPN API 获取实时比分数据
 * 采用单次日期范围查询（20260611-20260730）替代按天拆分查询，减少 API 调用次数
 * @param {Object} [options] - 选项
 * @param {boolean} [options.force=false] - 是否强制刷新（忽略缓存 TTL）
 * @returns {Promise<Array>} 标准化后的比赛数据列表
 */
async function fetchAllCurrentScores({ force = false } = {}) {
    const now = Date.now();
    // 防止并发堆积：若已有进行中的请求，直接复用其 Promise
    if (cache.inFlight) return cache.inFlight;
    // 缓存 TTL 判断：未过期且非强制刷新时直接返回缓存
    if (!force && now - cache.lastFetch < POLL_INTERVAL_MS) {
        return Array.from(cache.matches.values());
    }

    if (cache.abortController) {
        try { cache.abortController.abort(); } catch(e) {}
    }
    cache.abortController = new AbortController();
    var signal = cache.abortController.signal;

    cache.inFlight = (async () => {
        // 单次日期范围查询优化：一次性拉取整个赛程，避免按天拆分产生多次 API 调用
        const startDate = '20260611';
        const endDate = '20260730';
        const dateRange = `${startDate}-${endDate}`;

        try {
            // 复用 apiClient.js 的 espnCache，避免重复 API 请求
            let data;
            if (typeof window.espnCache !== 'undefined' && window.espnCache.fetch) {
                data = await window.espnCache.fetch(dateRange, 200, force);
            } else {
                const url = `${ESPN_API_BASE}/scoreboard?dates=${dateRange}&limit=200`;
                const resp = await fetch(url, { cache: force ? 'no-store' : 'default', signal: signal });
                if (!resp.ok) return [];
                data = await resp.json();
            }
            const events = Array.isArray(data.events) ? data.events : [];
            const standardized = events.map(standardizeEvent).filter(Boolean);

            // 整体替换缓存（Map 无容量上限，赛事总量有限无需 LRU 淘汰）
            cache.matches = new Map();
            standardized.forEach(item => cache.matches.set(item.espnEventId, item));
            cache.lastFetch = Date.now();
            return standardized;
        } catch (err) {
            if (err.name === 'AbortError') return [];
            return [];
        }
    })();

    try {
        return await cache.inFlight;
    } finally {
        cache.inFlight = null;
        cache.abortController = null;
    }
}

/**
 * 注册比分更新回调监听器
 * @param {Function} callback - 比分更新时的回调函数，接收最新比赛列表作为参数
 * @returns {Function} 注销函数，调用后移除该监听器，防止内存泄漏
 */
function onLiveScoresUpdate(callback) {
    if (typeof callback === 'function') {
        cache.listeners.push(callback);
    }
    return function offLiveScoresUpdate() {
        const idx = cache.listeners.indexOf(callback);
        if (idx !== -1) cache.listeners.splice(idx, 1);
    };
}

/**
 * 通知所有已注册的监听器
 * @param {Array} latestScores - 最新的标准化比赛数据列表
 */
function notifyListeners(latestScores) {
    // 复制数组防止回调中修改 listeners 导致遍历异常
    [...cache.listeners].forEach(cb => {
        try { cb(latestScores); } catch (e) { console.error("[LiveScores] 监听器异常:", e.message || e); }
    });
}

/**
 * 将实时比分数据同步到全局 WORLD_CUP_DATA.matches
 * 匹配策略：优先按日期+主客队精确匹配，淘汰赛 TBD 队伍通过日期+场馆 fallback 匹配
 * @param {Array} latestScores - 标准化后的实时比赛数据列表
 * @returns {Object} 更新结果 { updated: number, total: number }
 */
async function applyLiveScoresToWorldCup(latestScores) {
    if (typeof WORLD_CUP_DATA === 'undefined' || !Array.isArray(WORLD_CUP_DATA.matches)) {
        return { updated: 0, total: 0 };
    }
    if (!Array.isArray(latestScores) || latestScores.length === 0) {
        return { updated: 0, total: 0 };
    }

    // 构建双向索引：home|away 和 away|home 均可命中
    const indexByPair = new Map();
    latestScores.forEach(s => {
        const key1 = `${s.date}|${s.homeAbbr}|${s.awayAbbr}`;
        const key2 = `${s.date}|${s.awayAbbr}|${s.homeAbbr}`;
        indexByPair.set(key1, s);
        indexByPair.set(key2, s);
    });

    let updated = 0;
    WORLD_CUP_DATA.matches.forEach(match => {
        if (!match || match.status === 'finished') return;
        const homeId = String(match.homeTeam).toUpperCase();
        const awayId = String(match.awayTeam).toUpperCase();
        let live = null;

        // 优先：按日期+主客队精确匹配
        const key = `${match.date}|${homeId}|${awayId}`;
        live = indexByPair.get(key);

        // 淘汰赛 TBD fallback：TBD 占位队伍无法精确匹配，改用日期+场馆匹配
        if (!live && (homeId === 'TBD' || awayId === 'TBD') && match.venue) {
            const venueId = String(match.venue);
            live = latestScores.find(s => s.date === match.date && s.venueId === venueId);
        }

        if (!live) return;
        const prevStatus = match.status;
        match.status = live.status;
        match._espnStatusName = live._espnStatusName || '';
        match._espnStatusDesc = live._espnStatusDesc || live._espnStatusName || '';
        const hs = Number(live.homeScore);
        const as = Number(live.awayScore);
        match.homeScore = (live.homeScore != null && !isNaN(hs)) ? hs : null;
        match.awayScore = (live.awayScore != null && !isNaN(as)) ? as : null;
        match.minute = live.minute || null;
        match.lastUpdated = live.updatedAt;
        // 淘汰赛 TBD 替换：用 ESPN 实际队伍缩写替换占位 TBD
        if (homeId === 'TBD' && live.homeAbbr) match.homeTeam = live.homeAbbr;
        if (awayId === 'TBD' && live.awayAbbr) match.awayTeam = live.awayAbbr;
        if (prevStatus !== live.status) {
            updated++;
        }
    });

    return { updated, total: WORLD_CUP_DATA.matches.length };
}

/** 轮询定时器 ID（保留以避免外部误引用） */
let pollTimer = null;
/** 页面可见性变化处理函数引用（保留以避免外部误引用） */
let visibilityHandler = null;

/**
 * 停止实时比分轮询，清理定时器和事件监听
 */
function stopLivePolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
    }
}

window.LiveScores = {
    fetchAllCurrentScores,
    applyLiveScoresToWorldCup,
    stopLivePolling,
    onLiveScoresUpdate,
    POLL_INTERVAL_MS,
};
window.App.liveScores.LiveScores = LiveScores;
