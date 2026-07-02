/**
 * @fileoverview 预测分析视图模块
 * @description 预测卡片渲染、弹窗、筛选
 */
(function() {
  window.App = window.App || {};
  window.App.predictions = window.App.predictions || {};
  var _predEspnMatches2 = [];
  var _predStats = null;
  var _predActiveFilter = 'all';
  var predMatchOddsMap2 = new Map();
  var predFiltersSetup = false;
  var _oddsModalClosing = false;
  var _hasRenderedPredictions = false;
  var _lastPredKey = "";

  /** Poisson 概率计算（模块级共享，避免 inferPredictedScore 和 inferGoalDistribution 重复定义） */
  function poissonP(k, lambda) {
    var r = 1;
    for (var i = 2; i <= k; i++) r *= i;
    return Math.pow(lambda, k) * Math.exp(-lambda) / r;
  }

  /**
   * 双变量泊松模型核心函数（v2 优化版）
   * 改进点：
   * 1. Dixon-Coles 低比分修正：独立泊松低估 0-0/1-0/0-1，引入相关参数 ρ 修正
   * 2. λ 分配融入平局概率：用 logit 变换将 homeWin/draw/awayWin 三方向全部纳入
   * 3. 让球盘与独赢概率权重自适应：基于让球线大小动态调整
   * 融合大小球盘口（定总量）+ 让球盘（定净胜差）+ 独赢概率（定分配）
   * @param {Object} pred - 预测对象（需含 overUnder, spread, homeWin, awayWin）
   * @returns {Object|null} { lambdaHome, lambdaAway, scoreMatrix, totalProbs, topScores, source }
   */
  function computePoissonModel(pred) {
    if (!pred) return null;
    if (!pred.overUnder || pred.overUnder.line == null || pred.overUnder.line <= 0) return null;
    var lambdaTotal = pred.overUnder.line;

    // 让球盘信号（可选）：主队净胜球预期
    var spreadDiff = null;
    if (pred.spread && pred.spread.line != null) {
      spreadDiff = -pred.spread.line;
    }

    // 独赢概率信号：融入平局概率的改进分配
    // 旧版只用 homeWin/(homeWin+awayWin)，忽略平局信息
    // 新版：用 logit(homeWin - awayWin) 映射到 [-1, 1] 区间
    var mlRatio = 0.5;
    if (pred.homeWin != null && pred.awayWin != null) {
      var diff = (pred.homeWin - pred.awayWin) / 100;
      // tanh 映射：差异越大越接近 ±1，平局概率高时 diff 趋近 0
      mlRatio = 0.5 + 0.5 * Math.tanh(diff * 2);
    }

    // 自适应权重：让球线越大（实力差距越大），让球盘信号越可信
    var w = 0.6;
    var hasSpread = spreadDiff !== null && !isNaN(spreadDiff);
    if (hasSpread) {
      var absSpread = Math.abs(spreadDiff);
      // 让球线 ≥1.5 时权重提升至 0.7，≤0.5 时降至 0.45
      w = absSpread >= 1.5 ? 0.7 : absSpread <= 0.5 ? 0.45 : 0.6;
    } else {
      w = 0;
    }

    var mlDiff = (2 * mlRatio - 1) * lambdaTotal;
    var expectedDiff = hasSpread ? (w * spreadDiff + (1 - w) * mlDiff) : mlDiff;

    var lambdaHome = (lambdaTotal + expectedDiff) / 2;
    var lambdaAway = (lambdaTotal - expectedDiff) / 2;
    lambdaHome = Math.max(0.15, lambdaHome);
    lambdaAway = Math.max(0.15, lambdaAway);

    // Dixon-Coles 相关参数 ρ：修正低比分相关性
    // ρ > 0 时增大 0-0 和 1-1 概率，减小 1-0 和 0-1 概率
    // 经验值 ρ ≈ -0.1 ~ 0.1，这里基于 λ 动态计算
    var rho = -0.05 * Math.exp(-Math.abs(lambdaHome - lambdaAway) / 2);

    // 生成 7×7 比分概率矩阵（0-6 × 0-6），应用 Dixon-Coles 修正
    var maxGoals = 6;
    var scoreMatrix = [];
    var totalProbs = new Array(maxGoals * 2 + 1).fill(0);
    var allScores = [];
    for (var h = 0; h <= maxGoals; h++) {
      var row = [];
      for (var a = 0; a <= maxGoals; a++) {
        var p = poissonP(h, lambdaHome) * poissonP(a, lambdaAway);
        // Dixon-Coles 修正：仅对 (0,0), (0,1), (1,0), (1,1) 四个低比分格子生效
        if (h <= 1 && a <= 1) {
          var dcFactor = 1;
          if (h === 0 && a === 0) dcFactor = 1 - lambdaHome * lambdaAway * rho;
          else if (h === 0 && a === 1) dcFactor = 1 + lambdaHome * rho;
          else if (h === 1 && a === 0) dcFactor = 1 + lambdaAway * rho;
          else if (h === 1 && a === 1) dcFactor = 1 - rho;
          p = Math.max(0, p * dcFactor);
        }
        row.push(p);
        var total = h + a;
        if (total < totalProbs.length) totalProbs[total] += p;
        allScores.push({ score: h + " - " + a, prob: p, total: total });
      }
      scoreMatrix.push(row);
    }

    // 归一化 totalProbs
    var totalSum = totalProbs.reduce(function(s, v) { return s + v; }, 0);
    if (totalSum > 0) {
      totalProbs = totalProbs.map(function(v) { return v / totalSum; });
    }

    // Top 5 比分
    allScores.sort(function(x, y) { return y.prob - x.prob; });
    var topScores = allScores.slice(0, 5).map(function(x) {
      return { score: x.score, prob: Math.round(x.prob * 100) + "%" };
    });

    var sourceParts = [];
    sourceParts.push("大小球" + lambdaTotal);
    if (hasSpread) sourceParts.push("让球盘");
    if (pred.homeWin != null) sourceParts.push("独赢概率");
    sourceParts.push("Dixon-Coles");
    var source = "双变量泊松（" + sourceParts.join("+") + "）";

    return {
      lambdaHome: Math.round(lambdaHome * 100) / 100,
      lambdaAway: Math.round(lambdaAway * 100) / 100,
      scoreMatrix: scoreMatrix,
      totalProbs: totalProbs,
      topScores: topScores,
      source: source
    };
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
    var getRank = function(teamId) {
      if (typeof window.WORLD_CUP_DATA !== "undefined") {
        var team = window.WORLD_CUP_DATA.teams.find(function(t) { return t.id === teamId; });
        if (team && team.rank) return team.rank;
      }
      return null;
    };
    return {
      hasOdds: false,
      homeWin: null,
      draw: null,
      awayWin: null,
      overUnder: null,
      spread: null,
      favorite: null,
      confidence: null,
      recommendation: null,
      recommendationTemplate: null,
      oddsSource: null,
      overround: 0,
      movement: null,
      valueBets: [],
      providerCount: 0,
      isAggregated: false,
      homeRank: getRank(match.homeTeam),
      awayRank: getRank(match.awayTeam),
      homeAdvProb: null,
      awayAdvProb: null
    };
  }

  var _isLoadingPredictions = false; // 并发锁，防止快速切换视图导致竞态
  var _predLoadAbort = null; // AbortController，视图切换时取消请求

  /**
   * 加载比赛数据并构建所有预测（先设回退预测，再异步更新赔率预测）
   * @returns {Promise<void>}
   */
  async function loadAndBuildPredictions() {
    const container = document.getElementById("predMatchesContainer");
    if (!container) return;
    // 并发锁：若上一次加载未完成，取消旧的并重新开始
    if (_isLoadingPredictions) {
      if (_predLoadAbort) { try { _predLoadAbort.abort(); } catch(e){} }
    }
    _isLoadingPredictions = true;
    _predLoadAbort = new AbortController();
    const myAbort = _predLoadAbort;
    predMatchOddsMap2.clear();
    // 加载期间显示骨架占位，避免空白和后续闪烁
    if (!_hasRenderedPredictions) {
      const skeleton = document.createElement("div");
      skeleton.className = "pred-loading";
      skeleton.innerHTML = '<div class="pred-loading__spinner"></div><p>正在加载预测数据…</p>';
      container.replaceChildren(skeleton);
    }
    let matches = await window.fetchScheduleFromESPNCached();
    // 若已被新请求取消，直接返回
    if (myAbort.signal.aborted) { _isLoadingPredictions = false; return; }
    if (!matches || matches.length === 0) matches = window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
    _predEspnMatches2 = matches;
    // 为所有真实队伍比赛（含已完赛）构建 fallback 预测，已完赛比赛也显示在列表中
    const allRealMatches = matches.filter(window.isMatchWithRealTeams);
    allRealMatches.forEach((match) => {
      const fallback = buildPredFallback(match);
      fallback.homeAdvProb = null;
      fallback.awayAdvProb = null;
      predMatchOddsMap2.set(match.id, { oddsInfo: null, prediction: fallback });
    });
    updatePredStats({ total: allRealMatches.length, withOdds: 0 });
    // 仅未完赛比赛需要异步获取赔率数据
    const pendingMatches = allRealMatches.filter((m) => m.status !== "finished");
    let withOddsCount = 0;
    const promises = pendingMatches.map(async (match) => {
      try {
        const dateStr = match.date.replace(/-/g, "");
        const cached = await window.matchOddsCache.fetch(match.id, dateStr, match.homeTeam, match.awayTeam);
        // 若已被取消，丢弃旧请求结果
        if (myAbort.signal.aborted) return;
        const matchedEvent = window.verifyMatchTeams(cached.event, match.homeTeam, match.awayTeam, window.TEAM_MAP);
        if (matchedEvent) {
          const oddsInfo = window.parseOddsFromEspnEvent(matchedEvent);
          if (!oddsInfo) return;
          const prediction = window.derivePredictionFromOdds(oddsInfo, match);
          if (prediction) {
            prediction.homeAdvProb = null;
            prediction.awayAdvProb = null;
            predMatchOddsMap2.set(match.id, { oddsInfo, prediction });
            withOddsCount++;
          }
        }
      } catch (e) {
        if (myAbort.signal.aborted) return; // 取消导致的错误忽略
        console.error("[loadAndBuildPredictions] 获取赔率失败:", e.message || e);
      }
    });
    await Promise.all(promises);
    if (myAbort.signal.aborted) { _isLoadingPredictions = false; return; }
    // 所有赔率数据就绪后一次性渲染，避免中间态闪烁
    renderPredictionsList();
    updatePredStats({ total: allRealMatches.length, withOdds: withOddsCount });
    _isLoadingPredictions = false;
  }

  /**
   * 更新预测页面的统计数字（待预测比赛数、有赔率数、更新时间）
   * @param {Object} [overrides] - 覆盖值 { total, withOdds }
   */
  function updatePredStats(overrides) {
    const totalEl = document.getElementById("phTotalMatches"), oddsEl = document.getElementById("phWithOdds"), updateEl = document.getElementById("phLastUpdate");
    const allMatches = _predEspnMatches2 && _predEspnMatches2.length > 0 ? _predEspnMatches2 : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : [];
    const defaultTotal = allMatches.filter(window.isMatchWithRealTeams).length;
    if (totalEl) totalEl.textContent = overrides && overrides.total !== void 0 ? overrides.total : defaultTotal;
    if (oddsEl) oddsEl.textContent = overrides && overrides.withOdds !== void 0 ? overrides.withOdds : 0;
    if (updateEl) {
      const now = new Date();
      updateEl.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    const statsEl = document.getElementById("predHeroStats");
    if (statsEl) {
      statsEl.classList.remove("pred-hero__stats--updated");
      void statsEl.offsetWidth;
      statsEl.classList.add("pred-hero__stats--updated");
      setTimeout(() => statsEl.classList.remove("pred-hero__stats--updated"), 450);
    }
  }

  /**
   * 获取筛选后的预测比赛列表（仅真实队伍，按赛程方式排序：未完赛在前、已完赛在末尾）
   * @returns {Array} 排序后的比赛数组
   */
  function getPredFilteredMatches() {
    let matches = _predEspnMatches2 && _predEspnMatches2.length > 0 ? [..._predEspnMatches2] : [...window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : []];
    matches = matches.filter(window.isMatchWithRealTeams);
    // 预计算北京时间排序键，避免 sort 中重复调用 getLocalMatchTime
    matches = matches.map((m) => {
      const localTime = window.getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      const sortKey = localTime.date.toISOString().slice(0, 10) + localTime.date.toISOString().slice(11, 16);
      return { match: m, sortKey, isFinished: m.status === "finished" };
    });
    // 排序：未完赛在前（按时间升序），已完赛在末尾（按时间升序），与赛程视图一致
    matches.sort((a, b) => {
      if (a.isFinished !== b.isFinished) return a.isFinished ? 1 : -1;
      return a.sortKey.localeCompare(b.sortKey);
    });
    return matches.map((e) => e.match);
  }

  /**
   * 渲染预测比赛列表（按日期分组，首次渲染播放入场动画）
   */
  function renderPredictionsList() {
    const container = document.getElementById("predMatchesContainer");
    if (!container) return;
    const matches = getPredFilteredMatches();
    if (matches.length === 0) {
      _lastPredKey = "";
      const empty = document.createElement("div");
      empty.className = "pred-empty";
      empty.textContent = "暂无符合条件的比赛";
      container.replaceChildren(empty);
      return;
    }
    // 内容去重指纹：比赛 ID+赔率来源+预测方向+信心值变化才触发重渲染
    const key = matches.map((m) => {
      const entry = predMatchOddsMap2.get(m.id);
      const pred = entry && entry.prediction;
      return m.id + "|" + (m.status || "") + "|" + (entry && entry.oddsInfo ? "1" : "0") + "|" + (pred ? pred.topOutcome : "") + "|" + (pred ? Math.round(pred.confidence || 0) : 0);
    }).join(",");
    if (key === _lastPredKey && container.children.length > 0) return;
    _lastPredKey = key;
    // 预计算本地时间，避免后续重复调用
    const grouped = {};
    matches.forEach((m) => {
      const localTime = window.getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      const beijingDateStr = localTime.date.toISOString().slice(0, 10);
      if (!grouped[beijingDateStr]) grouped[beijingDateStr] = [];
      grouped[beijingDateStr].push(m);
    });
    // 首次渲染播放入场动画；后续渲染跳过入场动画避免频闪
    if (_hasRenderedPredictions) {
      container.classList.add("skip-enter-animation");
    } else {
      container.classList.remove("skip-enter-animation");
      _hasRenderedPredictions = true;
    }
    const htmlParts = [];
    // 排序：未完赛日期在前（按时间升序），已完赛日期在后（按时间升序），与赛程视图一致
    const todayStr = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
    const dates = Object.keys(grouped);
    const upcoming = dates.filter(d => d >= todayStr).sort();
    const finished = dates.filter(d => d < todayStr).sort();
    const sortedDates = [...upcoming, ...finished];
    sortedDates.forEach((date) => {
      const dateObj = new Date(date + "T00:00:00Z"), dateLabel = window.formatDate2(dateObj);
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
  }

  /**
   * 根据预测数据推断最可能比分（双变量泊松模型）
   * 数据来源：大小球盘口（定总量）+ 让球盘（定净胜差）+ 独赢概率（定分配）
   * @param {Object} pred - 预测对象
   * @param {number} homeRank - 主队FIFA排名（保留兼容，内部不使用）
   * @param {number} awayRank - 客队FIFA排名（保留兼容，内部不使用）
   * @returns {Object|null} { score, prob, top3, lambda, source }
   */
  function inferPredictedScore(pred, homeRank, awayRank, poissonModel) {
    var model = poissonModel || computePoissonModel(pred);
    if (!model || !model.topScores || model.topScores.length === 0) return null;
    var best = model.topScores[0];
    var top3 = model.topScores.slice(0, 3);
    return {
      score: best.score,
      prob: best.prob,
      top3: top3,
      lambda: { home: model.lambdaHome, away: model.lambdaAway },
      source: model.source
    };
  }
/**
   * 推断半场胜平负概率
   * 优先使用 API 返回的半场盘口赔率（若存在），否则使用全场概率衰减模型
   * 动态衰减系数：基于期望进球数（大小球盘口）和热门程度（max(homeWin, awayWin)）
   * @param {Object} pred - 预测对象
   * @returns {Object|null} { home: number, draw: number, away: number, source: string }
   */
  function inferHalfTime(pred) {
    if (!pred || pred.homeWin == null || pred.awayWin == null) return null;

    // 方案 A：API 返回了半场盘口，直接使用（保留以兼容未来数据源）
    if (pred.halfTimeOdds) {
      var ht = pred.halfTimeOdds;
      if (ht.home && ht.away) {
        var homeImp = window.oddsToImpliedProb(ht.home);
        var awayImp = window.oddsToImpliedProb(ht.away);
        var drawImp = ht.draw ? window.oddsToImpliedProb(ht.draw) : null;
        if (homeImp && awayImp) {
          var total = homeImp + awayImp + (drawImp || 0);
          if (total > 0) {
            return {
              home: Math.round(homeImp / total * 100),
              draw: drawImp ? Math.round(drawImp / total * 100) : Math.max(0, 100 - Math.round(homeImp / total * 100) - Math.round(awayImp / total * 100)),
              away: Math.round(awayImp / total * 100),
              source: "半场盘口"
            };
          }
        }
      }
    }

    // 方案 B：半场衰减模型（从全场概率推导）
    // 动态衰减系数：基于期望进球数（大小球盘口）和热门程度
    // 足球统计实证：约 65% 的全场胜队在半场已领先（静态基线）
    // 改进：热门方越强 → 半场领先概率越高；期望进球越多 → 平局越容易被打破
    var fullHome = pred.homeWin / 100;
    var fullAway = pred.awayWin / 100;
    var fullDraw = 1 - fullHome - fullAway;
    if (fullDraw < 0) fullDraw = 0;

    // 期望进球总量（大小球盘口），默认 2.5
    var lambdaTotal = (pred.overUnder && pred.overUnder.line != null && pred.overUnder.line > 0)
      ? pred.overUnder.line : 2.5;
    // 热门程度：max(homeWin, awayWin)，范围约 0.33 ~ 0.95
    var favStrength = Math.max(fullHome, fullAway);

    // 动态保留系数（全场胜→半场领先）：0.45 ~ 0.82
    // 基线 0.50 + 热门强度贡献 0.30*favStrength + 进球总量贡献 0.04*(λ-2.5)
    var retention = 0.50 + 0.30 * favStrength + 0.04 * (lambdaTotal - 2.5);
    retention = Math.max(0.45, Math.min(0.82, retention));

    // 动态平局转换系数（全场平→半场某队领先，分给主/客各一半）：0.05 ~ 0.25
    // 基线 0.10 + 进球贡献 0.04*(λ-2.5) + 热门贡献 0.05*(fav-0.5)
    var drawConv = 0.10 + 0.04 * (lambdaTotal - 2.5) + 0.05 * (favStrength - 0.5);
    drawConv = Math.max(0.05, Math.min(0.25, drawConv));

    var ht_home = fullHome * retention + fullDraw * drawConv;
    var ht_away = fullAway * retention + fullDraw * drawConv;
    var ht_draw = 1 - ht_home - ht_away;
    if (ht_draw < 0) ht_draw = 0;

    // 归一化
    var sum = ht_home + ht_away + ht_draw;
    if (sum > 0) {
      ht_home = ht_home / sum;
      ht_away = ht_away / sum;
      ht_draw = ht_draw / sum;
    }

    return {
      home: Math.round(ht_home * 100),
      draw: Math.round(ht_draw * 100),
      away: Math.round(ht_away * 100),
      source: "全场概率衰减模型（动态系数）"
    };
  }
  /**
   * 推断总进球数概率分布（双变量泊松模型）
   * 数据来源：computePoissonModel 的 totalProbs + 大小球盘口对齐校验
   * @param {Object} pred - 预测对象
   * @param {Object|null} poissonModel - 预计算的 Poisson 模型（可选，避免重复计算）
   * @returns {Object|null} { exact, top3, overUnderAlign, lambda, source }
   */
  function inferGoalDistribution(pred, poissonModel) {
    var model = poissonModel || computePoissonModel(pred);
    if (!model || !model.totalProbs) return null;
    var totalProbs = model.totalProbs;
    var line = pred.overUnder.line;

    // 精确到每个球数的概率，取 Top 3
    var goalsList = [];
    for (var g = 0; g < totalProbs.length; g++) {
      if (totalProbs[g] > 0) {
        goalsList.push({ goals: g, prob: totalProbs[g] });
      }
    }
    goalsList.sort(function(a, b) { return b.prob - a.prob; });
    var top3 = goalsList.slice(0, 3).map(function(x) {
      return { goals: x.goals, prob: Math.round(x.prob * 100) };
    });

    // 与 over/under 赔率对齐校验
    var ouProbs = inferOverUnderProb(pred.overUnder);
    var overUnderAlign = true;
    if (ouProbs) {
      var lineInt = Math.floor(line);
      var poissonOver = 0;
      for (var j = lineInt + 1; j < totalProbs.length; j++) poissonOver += totalProbs[j];
      poissonOver = poissonOver * 100;
      if (Math.abs(poissonOver - ouProbs.overPct) > 10) overUnderAlign = false;
    }

    return {
      exact: Math.round(line),
      top3: top3,
      overUnderAlign: overUnderAlign,
      lambda: { home: model.lambdaHome, away: model.lambdaAway },
      source: model.source
    };
  }
  /**
   * 计算大小球隐含概率
   * @param {Object} ou - overUnder 对象
   * @returns {Object|null} { overPct: number, underPct: number }
   */
  function inferOverUnderProb(ou) {
    if (!ou || !ou.overOdds || !ou.underOdds) return null;
    const overImp = window.oddsToImpliedProb(ou.overOdds);
    const underImp = window.oddsToImpliedProb(ou.underOdds);
    if (!overImp || !underImp) return null;
    const total = overImp + underImp;
    return {
      overPct: Math.round(overImp / total * 100),
      underPct: Math.round(underImp / total * 100)
    };
  }
  /**
   * 计算预测卡片所需的所有数据
   * @param {Object} match - 比赛对象
   * @returns {Object} 卡片数据对象
   */
  function computePredCardData(match) {
    const home = window.getTeamById(match.homeTeam, match._homeName);
    const away = window.getTeamById(match.awayTeam, match._awayName);
    const venue = window.getVenueById(match.venue);
    const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const stage = window.getStageName(match.stage) + (match.group ? " · " + match.group + "组" : "");
    const entry = predMatchOddsMap2.get(match.id);
    const pred = entry ? entry.prediction : null;
    const hasOdds = !!(entry && entry.oddsInfo !== null && pred && pred.hasOdds !== false);
    const isFinished = match.status === "finished";
    const isLive = match.status === "live" || match.status === "halftime";
    const hasScore = isFinished || isLive;
    const confClass = pred && pred.confidence >= 65 ? "high" : pred && pred.confidence >= 50 ? "med" : "low";
    // 一次性计算 Poisson 模型并缓存，避免 inferPredictedScore 和 inferGoalDistribution 重复计算
    const poissonModel = pred && pred.overUnder && pred.overUnder.line != null ? computePoissonModel(pred) : null;
    const predictedScore = inferPredictedScore(pred, home.rank, away.rank, poissonModel);
    const halfTime = inferHalfTime(pred);
    const ouData = pred && pred.overUnder ? pred.overUnder : null;
    const ouProbs = inferOverUnderProb(ouData);
    const goalDist = inferGoalDistribution(pred, poissonModel);
    return { home, away, venue, localTime, stage, pred, hasOdds, isFinished, isLive, hasScore, confClass, predictedScore, halfTime, ouData, ouProbs, goalDist };
  }
  /**
   * 构建单个预测比赛卡片的 HTML
   * @param {Object} match - 比赛对象
   * @returns {string} 卡片 HTML 字符串
   */
  function buildPredMatchCard(match) {
    const d = computePredCardData(match);
    const { home, away, pred, isFinished, isLive, hasScore, confClass, predictedScore, halfTime, ouData, goalDist } = d;
    const { localTime, stage } = d;
    let valueBetBadge = pred && pred.valueBets && pred.valueBets.length > 0 ? `<div class="pmc-card__value-bet">💎 +${pred.valueBets.reduce((a, b) => a.edge > b.edge ? a : b).edge}%</div>` : "";
    let sourceBadge = pred && pred.isAggregated ? `<div class="pmc-card__aggregated">📊 ${pred.providerCount}源</div>` : "";
    let scoreHtml = hasScore ? `<div class="pmc-card__score"><span class="pmc-card__score-num">${match.homeScore || 0}</span><span class="pmc-card__score-sep">-</span><span class="pmc-card__score-num">${match.awayScore || 0}</span></div>` : "";
    let probDetail = pred && !isFinished ? (pred.homeWin == null ? `
      <div class="pmc-card__prob-detail pmc-card__prob-empty">暂无赔率数据</div>
    ` : `
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
    `) : "";
    let confidenceBadge = pred && !isFinished && pred.homeWin != null && pred.confidence != null ? `
      <div class="pmc-card__confidence-bar">
        <div class="pmc-card__confidence-track">
          <div class="pmc-card__confidence-fill pmc-card__confidence-fill--${confClass}" style="width: ${pred.confidence}%"></div>
        </div>
        <span class="pmc-card__confidence-text">信心 ${pred.confidence}%</span>
      </div>
    ` : "";
    let clickHint = isFinished ? '<span class="pmc-card__click-hint">已完赛 · 查看赔率回顾 →</span>' : (!isLive ? '<span class="pmc-card__click-hint">点击查看赔率详情 →</span>' : '');
    let liveBadge = isLive ? `<div class="pmc-card__live-indicator">🔴 ${window.escapeHTML(window.getDetailedStatus(match))}${match.status === "live" && match.minute ? " " + match.minute : ""}</div>` : "";
    const dataSideHtml = pred && !isFinished ? `
      <div class="pmc-card__data-side">
        <div class="pmc-card__data-cell">
          <span class="pmc-card__data-label">预测胜负</span>
          ${pred.homeWin == null ? `<div class="pmc-card__prob-empty">暂无赔率数据</div>` : `
          <div class="pmc-card__prob-bars">
            <div class="pmc-card__prob-bar-row">
              <span class="pmc-card__prob-bar-label">主</span>
              <div class="pmc-card__prob-bar-track"><div class="pmc-card__prob-bar-fill pmc-card__prob-bar-fill--home" style="width:${pred.homeWin}%"></div></div>
              <span class="pmc-card__prob-bar-num">${pred.homeWin}%</span>
            </div>
            <div class="pmc-card__prob-bar-row">
              <span class="pmc-card__prob-bar-label">平</span>
              <div class="pmc-card__prob-bar-track"><div class="pmc-card__prob-bar-fill pmc-card__prob-bar-fill--draw" style="width:${pred.draw || 0}%"></div></div>
              <span class="pmc-card__prob-bar-num">${pred.draw || 0}%</span>
            </div>
            <div class="pmc-card__prob-bar-row">
              <span class="pmc-card__prob-bar-label">客</span>
              <div class="pmc-card__prob-bar-track"><div class="pmc-card__prob-bar-fill pmc-card__prob-bar-fill--away" style="width:${pred.awayWin}%"></div></div>
              <span class="pmc-card__prob-bar-num">${pred.awayWin}%</span>
            </div>
          </div>`}
        </div>
        <div class="pmc-card__data-cell">
          <span class="pmc-card__data-label">预测比分</span>
          <span class="pmc-card__data-value pmc-card__data-value--highlight${predictedScore ? '' : ' pmc-card__data-value--empty'}">${predictedScore ? predictedScore.score : '--'}</span>
          <span class="pmc-card__data-sub">概率 ${predictedScore ? predictedScore.prob : '--'}</span>
        </div>
        <div class="pmc-card__data-cell">
          <span class="pmc-card__data-label">预测总进球</span>
          <span class="pmc-card__data-value${goalDist ? '' : ' pmc-card__data-value--empty'}">${goalDist && goalDist.top3 && goalDist.top3.length > 0 ? goalDist.top3[0].goals + ' 球' : (ouData ? ouData.line + ' 球' : '--')}</span>
          <div class="pmc-card__goal-dist">
            ${goalDist && goalDist.top3 ? goalDist.top3.map(function(item) {
              return '<div class="pmc-card__goal-dist-row"><span class="pmc-card__goal-dist-label">' + item.goals + '球</span><div class="pmc-card__goal-dist-track"><div class="pmc-card__goal-dist-fill" style="width:' + item.prob + '%"></div></div><span class="pmc-card__goal-dist-num">' + item.prob + '%</span></div>';
            }).join('') : ''}
          </div>
        </div>
        <div class="pmc-card__data-cell">
          <span class="pmc-card__data-label">半场胜平负</span>
          <div class="pmc-card__half-pills">
            ${halfTime ? `<span class="pmc-card__half-pill">主胜 ${halfTime.home}%</span><span class="pmc-card__half-pill pmc-card__half-pill--gray">平 ${halfTime.draw}%</span><span class="pmc-card__half-pill pmc-card__half-pill--red">客胜 ${halfTime.away}%</span>` : `<span class="pmc-card__data-value--empty">--</span>`}
          </div>
        </div>
      </div>
    ` : '';
    return `<div class="pmc-card pmc-card--clickable ${isLive ? "pmc-card--live" : ""} ${isFinished ? "pmc-card--finished" : ""}" data-match-id="${match.id}">
      <div class="pmc-card__top-bar">
        <span class="pmc-card__stage-badge">${window.escapeHTML(stage)}</span>
        ${liveBadge}
        <span class="pmc-card__time-capsule">
          <span class="match-card__tz">${window.formatTime(localTime.date)} ${localTime.timezone}</span>
        </span>
      </div>
      <div class="pmc-card__main-body">
        <div class="pmc-card__match-side">
          <div class="pmc-card__teams-row">
            <div class="pmc-card__team-block pmc-card__team-block--home">
              <span class="pmc-card__flag">${window.buildFlagHtml(home.flag, home.name)}</span>
              <span class="pmc-card__team-name">${window.escapeHTML(home.name)}</span>
              <span class="pmc-card__team-rank">FIFA #${home.rank || '?'}</span>
            </div>
            <div class="pmc-card__vs-center">
              ${scoreHtml || '<span class="pmc-card__vs-text">VS</span>'}
              ${probDetail}
            </div>
            <div class="pmc-card__team-block pmc-card__team-block--away">
              <span class="pmc-card__flag">${window.buildFlagHtml(away.flag, away.name)}</span>
              <span class="pmc-card__team-name">${window.escapeHTML(away.name)}</span>
              <span class="pmc-card__team-rank">FIFA #${away.rank || '?'}</span>
            </div>
          </div>
        </div>
        ${dataSideHtml}
      </div>
      <div class="pmc-card__footer">
        ${confidenceBadge}
        <div class="pmc-card__smart-tags">
          ${valueBetBadge}${sourceBadge}
        </div>
        ${clickHint}
      </div>
    </div>`;
  }

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
        window.espnCache.invalidate();
        window.matchOddsCache.invalidate();
        refreshBtn.classList.add("btn-refresh--spinning");
        await loadAndBuildPredictions();
        refreshBtn.classList.remove("btn-refresh--spinning");
        if (window.autoRefreshCurrentView === "predictions") {
          window.resetAutoRefreshTimer();
        }
      });
    }
  }

  /**
   * 显示比赛详情弹窗
   * @param {Object} match - 比赛对象
   */
  function showMatchDetails(match) {
    const modal = document.getElementById("matchModal");
    const details = document.getElementById("matchDetails");
    const homeTeam = window.getTeamById(match.homeTeam, match._homeName);
    const awayTeam = window.getTeamById(match.awayTeam, match._awayName);
    const venue = window.getVenueById(match.venue);
    const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const hasScore = match.status === "finished" || match.status === "live" || match.status === "halftime";
    const liveBadge = (match.status === "live" || match.status === "halftime") ? '<span class="live-dot" aria-label="直播中"></span>' : "";
    const statusText = (match.status === "live" && match.minute) ? `${window.getDetailedStatus(match)} ${match.minute}` : window.getDetailedStatus(match);
    const homeFlagHtml = homeTeam.isPlaceholder ? '<div class="modal-hero__flag-placeholder">?</div>' : `<div class="modal-hero__flag-emoji">${window.buildFlagHtml(homeTeam.flag, homeTeam.name)}</div>`;
    const awayFlagHtml = awayTeam.isPlaceholder ? '<div class="modal-hero__flag-placeholder">?</div>' : `<div class="modal-hero__flag-emoji">${window.buildFlagHtml(awayTeam.flag, awayTeam.name)}</div>`;
    const homeNameClass = homeTeam.isPlaceholder ? "modal-hero__name modal-hero__name--placeholder" : "modal-hero__name";
    const awayNameClass = awayTeam.isPlaceholder ? "modal-hero__name modal-hero__name--placeholder" : "modal-hero__name";
    details.innerHTML = `
        <h2 id="matchModalTitle" class="modal-hero__title">
            ${window.escapeHTML(window.getStageName(match.stage))}${match.group ? " - " + window.escapeHTML(match.group) + "组" : ""}
        </h2>
        <div class="modal-hero__teams">
            <div class="modal-hero__team">
                ${homeFlagHtml}
                <div class="${homeNameClass}">${window.escapeHTML(homeTeam.name)}</div>
            </div>
            <div class="modal-hero__vs-section">
                <div class="modal-hero__vs-score-text">
                    ${hasScore ? `${window.escapeHTML(match.homeScore)} - ${window.escapeHTML(match.awayScore)}` : "VS"}
                </div>
                <div class="modal-hero__status-badge"><span class="match-card__time-status match-card__time-status--${match.status}">${liveBadge}${window.escapeHTML(statusText)}</span></div>
            </div>
            <div class="modal-hero__team">
                ${awayFlagHtml}
                <div class="${awayNameClass}">${window.escapeHTML(awayTeam.name)}</div>
            </div>
        </div>
        <div class="modal-dashboard__info-wrapper">
            <div class="match-modal-info modal-dashboard__info-grid">
                <div class="modal-dashboard__info-label">比赛时间：</div>
                <div>${window.formatDate2(localTime.date)} <span class="match-card__tz">${window.formatTime(localTime.date)} ${window.escapeHTML(localTime.timezone)}</span></div>
                <div class="modal-dashboard__info-label">场馆时间：</div>
                <div>${window.formatDate2(localTime.originalDate)} <span class="match-card__tz">${window.formatTime(localTime.originalDate)} ${window.escapeHTML(localTime.originalTimezoneUTC)}</span></div>
                <div class="modal-dashboard__info-label">比赛场地：</div>
                <div>${window.escapeHTML(venue.name)} <span class="modal-dashboard__info-detail">(${window.escapeHTML(venue.country)}·${window.escapeHTML(venue.city)})</span></div>
                <div class="modal-dashboard__info-label">球场容量：</div>
                <div>${venue.capacity.toLocaleString()} 人</div>
                <div class="modal-dashboard__info-label">比赛阶段：</div>
                <div>${window.escapeHTML(window.getStageName(match.stage))}${match.group ? " - " + window.escapeHTML(match.group) + "组" : ""}</div>
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
    const home = window.getTeamById(match.homeTeam, match._homeName);
    const away = window.getTeamById(match.awayTeam, match._awayName);
    title.textContent = `${home.name} vs ${away.name}`;
    modal.classList.add("modal--active");
    document.body.style.overflow = "hidden";
    body.innerHTML = `
        <div class="modal-loading">
            <div class="pred-spinner"></div>
            <span>正在从 ESPN 拉取该场比赛赔率...</span>
        </div>
    `;
    try {
      const dateStr = match.date.replace(/-/g, "");
      const cached = await window.matchOddsCache.fetch(numericId, dateStr, match.homeTeam, match.awayTeam);
      const event = cached.event;
      const matchedEvent = window.verifyMatchTeams(event, match.homeTeam, match.awayTeam, window.TEAM_MAP, match);
      if (!matchedEvent) {
        body.innerHTML = `
                <div class="modal-no-data">
                    <div class="modal-no-data__icon">📭</div>
                    <div class="modal-no-data__title">暂无赔率数据</div>
                    <div class="modal-no-data__desc">该场比赛尚未开放投注，赔率通常在比赛前 7 天左右公布。请稍后回来查看。</div>
                </div>
            `;
        return;
      }
      const oddsInfo = window.parseOddsFromEspnEvent(matchedEvent);
      if (!oddsInfo) {
        body.innerHTML = `
                <div class="modal-no-data">
                    <div class="modal-no-data__icon">📭</div>
                    <div class="modal-no-data__title">暂无赔率数据</div>
                    <div class="modal-no-data__desc">该场比赛尚未开放投注，赔率通常在比赛前 7 天左右公布。请稍后回来查看。</div>
                </div>
            `;
        return;
      }
      const prediction = window.derivePredictionFromOdds(oddsInfo, match) || buildPredFallback(match);
      const payload = { event: matchedEvent, oddsInfo, prediction };
      renderModalContent(match, payload);
    } catch (e) {
      console.error("[openMatchOddsModal] 加载赔率失败:", e.message || e);
      body.innerHTML = `
            <div class="modal-no-data">
                <div class="modal-no-data__icon">⚠️</div>
                <div class="modal-no-data__title">加载失败</div>
                <div class="modal-no-data__desc">网络异常或接口暂时不可用：${window.escapeHTML(e.message || String(e))}</div>
            </div>
        `;
    }
  }

  /**
   * 渲染弹窗 Hero 头图区
   */
  function renderModalHero(match, home, away, venue, localTime, stage) {
    return `
        <div class="modal-hero">
            <div class="modal-hero__teams">
                <div class="modal-hero__team">
                    <span class="modal-hero__flag">${window.buildFlagHtml(home.flag, home.name)}</span>
                    <div class="modal-hero__name">${window.escapeHTML(home.name)}</div>
                    <div class="modal-hero__rank">FIFA #${home.rank || "-"}</div>
                </div>
                <div class="modal-hero__vs">VS</div>
                <div class="modal-hero__team">
                    <span class="modal-hero__flag">${window.buildFlagHtml(away.flag, away.name)}</span>
                    <div class="modal-hero__name">${window.escapeHTML(away.name)}</div>
                    <div class="modal-hero__rank">FIFA #${away.rank || "-"}</div>
                </div>
            </div>
            <div class="modal-hero__meta">
                <span>⏰ ${window.formatTime(localTime.date)} ${localTime.timezone}</span>
                <span>🏟 ${window.escapeHTML(venue.country)}·${window.escapeHTML(venue.city)}</span>
                <span>🏆 ${window.escapeHTML(stage)}</span>
            </div>
        </div>
    `;
  }

  /**
   * 渲染弹窗绿色概率仪表板
   */
  function renderModalDashboard(prediction, provider) {
    if (!prediction || prediction.hasOdds === false || prediction.homeWin == null) {
      return `
            <div class="modal-dashboard">
                <div class="modal-dashboard__empty">暂无赔率数据</div>
            </div>
        `;
    }
    const mlOdds = provider && provider.moneyline;
    const mlHome = mlOdds ? window.formatDecimalOdds(mlOdds.home) : "-";
    const mlDraw = mlOdds ? window.formatDecimalOdds(mlOdds.draw) : "-";
    const mlAway = mlOdds ? window.formatDecimalOdds(mlOdds.away) : "-";
    return `
            <div class="modal-dashboard">
                <div class="modal-dashboard__grid">
                    <div class="modal-dashboard__cell">
                        <div class="modal-dashboard__cell-label">主胜概率</div>
                        <div class="modal-dashboard__cell-value">${Math.round(prediction.homeWin)}%</div>
                        <div class="modal-dashboard__cell-odds">赔率 ${mlHome}</div>
                    </div>
                    <div class="modal-dashboard__cell">
                        <div class="modal-dashboard__cell-label">平局概率</div>
                        <div class="modal-dashboard__cell-value">${Math.round(prediction.draw || 0)}%</div>
                        <div class="modal-dashboard__cell-odds">赔率 ${mlDraw}</div>
                    </div>
                    <div class="modal-dashboard__cell">
                        <div class="modal-dashboard__cell-label">客胜概率</div>
                        <div class="modal-dashboard__cell-value">${Math.round(prediction.awayWin)}%</div>
                        <div class="modal-dashboard__cell-odds">赔率 ${mlAway}</div>
                    </div>
                </div>
                <div class="modal-dashboard__prob-bar">
                    <div class="modal-dashboard__prob-bar__home" style="width:${Math.round(prediction.homeWin)}%"></div>
                    ${prediction.draw !== null ? `<div class="modal-dashboard__prob-bar__draw" style="width:${Math.round(prediction.draw)}%"></div>` : ""}
                    <div class="modal-dashboard__prob-bar__away" style="width:${Math.round(prediction.awayWin)}%"></div>
                </div>
                <div class="modal-dashboard__recommendation">
                    💡 推荐：${window.escapeHTML(prediction.recommendation || "")} | 信心 ${Math.round(prediction.confidence || 0)}%
                </div>
            </div>
        `;
  }

  /**
   * 渲染弹窗 Bento 2x2 网格
   */
  function renderModalBento(prediction, predictedScore, halfTime, goalDist) {
    // 左上 - 本场预测：胜平负
    let wltCard = `
            <div class="modal-bento__card">
                <div class="modal-bento__card-title">🎯 本场预测：胜平负</div>
        `;
    if (prediction && prediction.homeWin != null) {
      wltCard += `
                <div class="modal-bento__bars">
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">主胜</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(prediction.homeWin)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(prediction.homeWin)}%</span>
                    </div>
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">平局</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(prediction.draw || 0)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(prediction.draw || 0)}%</span>
                    </div>
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">客胜</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(prediction.awayWin)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(prediction.awayWin)}%</span>
                    </div>
                </div>
        `;
    } else {
      wltCard += `<div class="modal-bento__empty">暂无数据</div>`;
    }
    wltCard += `</div>`;

    // 右上 - 预测比分
    let scoreCard = `
            <div class="modal-bento__card">
                <div class="modal-bento__card-title">⚽ 预测比分</div>
        `;
    if (predictedScore && predictedScore.top3 && predictedScore.top3.length > 0) {
      scoreCard += `<div class="modal-bento__bars">`;
      predictedScore.top3.forEach(item => {
        const probNum = parseInt(item.prob, 10) || 0;
        scoreCard += `
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">${window.escapeHTML(item.score)}</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${probNum}%"></div></div>
                        <span class="modal-bento__bar-num">${window.escapeHTML(item.prob)}</span>
                    </div>
          `;
      });
      scoreCard += `</div>`;
    } else {
      scoreCard += `<div class="modal-bento__empty">暂无数据</div>`;
    }
    scoreCard += `</div>`;

    // 左下 - 进球分布
    let goalCard = `
            <div class="modal-bento__card">
                <div class="modal-bento__card-title">⚽ 进球分布</div>
        `;
    if (goalDist && goalDist.top3 && goalDist.top3.length > 0) {
      goalCard += `<div class="modal-bento__bars">`;
      goalDist.top3.forEach(function(item) {
        goalCard += `
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">${item.goals}球</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${item.prob}%"></div></div>
                        <span class="modal-bento__bar-num">${item.prob}%</span>
                    </div>
        `;
      });
      goalCard += `</div>`;
    } else {
      goalCard += `<div class="modal-bento__empty">暂无数据</div>`;
    }
    goalCard += `</div>`;

    // 右下 - 半场预测
    let halfCard = `
            <div class="modal-bento__card">
                <div class="modal-bento__card-title">⏱ 半场预测</div>
        `;
    if (halfTime) {
      halfCard += `
                <div class="modal-bento__bars">
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">主胜</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(halfTime.home)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(halfTime.home)}%</span>
                    </div>
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">平局</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(halfTime.draw)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(halfTime.draw)}%</span>
                    </div>
                    <div class="modal-bento__bar-row">
                        <span class="modal-bento__bar-label">客胜</span>
                        <div class="modal-bento__bar-track"><div class="modal-bento__bar-fill" style="width:${Math.round(halfTime.away)}%"></div></div>
                        <span class="modal-bento__bar-num">${Math.round(halfTime.away)}%</span>
                    </div>
                </div>
        `;
    } else {
      halfCard += `<div class="modal-bento__empty">暂无数据</div>`;
    }
    halfCard += `</div>`;

    return `
            <div class="modal-bento">
                ${wltCard}
                ${scoreCard}
                ${goalCard}
                ${halfCard}
            </div>
        `;
  }

  /**
   * 渲染信心值计算过程区块
   * @param {Object} pred - 预测数据，含 confidenceBreakdown
   * @returns {string} HTML 字符串
   */
  function renderModalConfidence(pred) {
    if (!pred || !pred.confidenceBreakdown) {
      return `
            <div class="modal-confidence modal-confidence__empty">暂无信心值数据</div>
        `;
    }
    var b = pred.confidenceBreakdown;
    var meta = b._meta || {};
    var probs = meta.probs || {};

    function valClass(v) { return v >= 0 ? 'modal-confidence__value--positive' : 'modal-confidence__value--negative'; }
    function valStr(v) { return (v >= 0 ? '+' : '') + v; }

    var adjustedRaw = Math.round((b.rawConfidence + b.signalAdjust) * 10) / 10;

    return `
        <div class="modal-confidence">
            <div class="modal-confidence__header">
                <span class="modal-confidence__title">信心值计算过程</span>
                <span class="modal-confidence__final">最终 ${b.finalConfidence}</span>
            </div>

            <div class="modal-confidence__section modal-confidence__section--base">
                <div class="modal-confidence__section-title">基础信心（信息熵模型）</div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">概率分布</span>
                    <span class="modal-confidence__value">主胜 ${probs.home || 0}% | 平 ${probs.draw || 0}% | 客胜 ${probs.away || 0}%</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">信息熵 H</span>
                    <span class="modal-confidence__value">${b.entropy} bit</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">最大熵 H_max</span>
                    <span class="modal-confidence__value">${b.H_max} bit</span>
                </div>
                <div class="modal-confidence__row modal-confidence__row--highlight">
                    <span class="modal-confidence__label">基础信心</span>
                    <span class="modal-confidence__value">(1 - H/H_max) × 100 = ${b.rawConfidence}</span>
                </div>
            </div>

            <div class="modal-confidence__section modal-confidence__section--signal">
                <div class="modal-confidence__section-title">信号调整</div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">赔率变动</span>
                    <span class="modal-confidence__value ${valClass(b.signalBreakdown.movement)}">${valStr(b.signalBreakdown.movement)}</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">跨市场一致性</span>
                    <span class="modal-confidence__value ${valClass(b.signalBreakdown.crossMarket)}">${valStr(b.signalBreakdown.crossMarket)}</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">价值投注</span>
                    <span class="modal-confidence__value ${valClass(b.signalBreakdown.valueBet)}">${valStr(b.signalBreakdown.valueBet)}</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">排名辅助</span>
                    <span class="modal-confidence__value ${valClass(b.signalBreakdown.rank || 0)}">${valStr(b.signalBreakdown.rank || 0)}</span>
                </div>
                <div class="modal-confidence__row modal-confidence__row--highlight">
                    <span class="modal-confidence__label">信号调整合计</span>
                    <span class="modal-confidence__value ${valClass(b.signalAdjust)}">${valStr(b.signalAdjust)}</span>
                </div>
            </div>

            <div class="modal-confidence__section modal-confidence__section--quality">
                <div class="modal-confidence__section-title">数据质量因子</div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">overround</span>
                    <span class="modal-confidence__value">${meta.overround || 0}% → 衰减 ${b.qualityBreakdown.overroundFactor}</span>
                </div>
                <div class="modal-confidence__row">
                    <span class="modal-confidence__label">providers</span>
                    <span class="modal-confidence__value">${meta.providerCount || 0}家 → 满质量 ${b.qualityBreakdown.providerFactor}</span>
                </div>
                <div class="modal-confidence__row modal-confidence__row--highlight">
                    <span class="modal-confidence__label">质量因子</span>
                    <span class="modal-confidence__value">${b.qualityBreakdown.overroundFactor} × ${b.qualityBreakdown.providerFactor} = ${b.qualityFactor}</span>
                </div>
            </div>

            <div class="modal-confidence__section modal-confidence__section--final">
                <div class="modal-confidence__section-title">最终计算</div>
                <div class="modal-confidence__formula">
                    (${b.rawConfidence} + ${valStr(b.signalAdjust)}) × ${b.qualityFactor}
                </div>
                <div class="modal-confidence__formula modal-confidence__formula--result">
                    = ${adjustedRaw} × ${b.qualityFactor} = ${b.finalConfidence}
                </div>
                <div class="modal-confidence__formula--note">
                    公式：confidence = clamp(rawConfidence + signalAdjust, 0, 100) × qualityFactor
                </div>
            </div>
        </div>
    `;
  }

  /**
   * 渲染弹窗赔率变动趋势
   */
  function renderModalMovement(provider) {
    if (!provider) {
      return `
            <div class="modal-movement">
                <div class="modal-movement__empty">暂无数据</div>
            </div>
        `;
    }
    const ml = provider.moneyline;
    const sp = provider.spread;
    const tt = provider.total;
    const mlHasOpen = ml && (ml.homeOpen != null || ml.drawOpen != null || ml.awayOpen != null);
    const spHasOpen = sp && (sp.homeLineOpen != null || sp.homeOddsOpen != null);
    const ttHasOpen = tt && (tt.lineOpen != null || tt.overOddsOpen != null);
    if (!mlHasOpen && !spHasOpen && !ttHasOpen) {
      return `
            <div class="modal-movement">
                <div class="modal-movement__empty">暂无数据</div>
            </div>
        `;
    }

    const mlHomeOpen = ml && ml.homeOpen != null ? window.formatDecimalOdds(ml.homeOpen) : "-";
    const mlHomeClose = ml && ml.home != null ? window.formatDecimalOdds(ml.home) : "-";
    const mlDrawOpen = ml && ml.drawOpen != null ? window.formatDecimalOdds(ml.drawOpen) : "-";
    const mlDrawClose = ml && ml.draw != null ? window.formatDecimalOdds(ml.draw) : "-";
    const mlAwayOpen = ml && ml.awayOpen != null ? window.formatDecimalOdds(ml.awayOpen) : "-";
    const mlAwayClose = ml && ml.away != null ? window.formatDecimalOdds(ml.away) : "-";

    const spHomeLine = sp && sp.homeLine != null ? window.escapeHTML(String(sp.homeLine)) : "-";
    const spHomeOddsOpen = sp && sp.homeOddsOpen != null ? window.formatDecimalOdds(sp.homeOddsOpen) : "-";
    const spHomeOddsClose = sp && sp.homeOdds != null ? window.formatDecimalOdds(sp.homeOdds) : "-";
    const spAwayLine = sp && sp.awayLine != null ? window.escapeHTML(String(sp.awayLine)) : "-";
    const spAwayOddsOpen = sp && sp.awayOddsOpen != null ? window.formatDecimalOdds(sp.awayOddsOpen) : "-";
    const spAwayOddsClose = sp && sp.awayOdds != null ? window.formatDecimalOdds(sp.awayOdds) : "-";

    const ttLine = tt && tt.line != null ? window.escapeHTML(String(tt.line)) : "-";
    const ttOverOpen = tt && tt.overOddsOpen != null ? window.formatDecimalOdds(tt.overOddsOpen) : "-";
    const ttOverClose = tt && tt.overOdds != null ? window.formatDecimalOdds(tt.overOdds) : "-";
    const ttUnderOpen = tt && tt.underOddsOpen != null ? window.formatDecimalOdds(tt.underOddsOpen) : "-";
    const ttUnderClose = tt && tt.underOdds != null ? window.formatDecimalOdds(tt.underOdds) : "-";

    return `
            <div class="modal-movement">
                <div class="modal-movement__grid">
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">独赢·主胜</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${mlHomeOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${mlHomeClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">独赢·平局</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${mlDrawOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${mlDrawClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">独赢·客胜</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${mlAwayOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${mlAwayClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">让球·主让 ${spHomeLine !== "-" ? "(" + spHomeLine + ")" : ""}</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${spHomeOddsOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${spHomeOddsClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">让球·客受 ${spAwayLine !== "-" ? "(" + spAwayLine + ")" : ""}</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${spAwayOddsOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${spAwayOddsClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell modal-movement__cell--center">
                        <div class="modal-movement__cell-label">盘口</div>
                        <div class="modal-movement__cell-line">${spHomeLine}</div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">大小球·大 ${ttLine !== "-" ? "(" + ttLine + ")" : ""}</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${ttOverOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${ttOverClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell">
                        <div class="modal-movement__cell-label">大小球·小 ${ttLine !== "-" ? "(" + ttLine + ")" : ""}</div>
                        <div class="modal-movement__cell-odds">
                            <span class="open">${ttUnderOpen}</span>
                            <span class="arrow">→</span>
                            <span class="close">${ttUnderClose}</span>
                        </div>
                    </div>
                    <div class="modal-movement__cell modal-movement__cell--center">
                        <div class="modal-movement__cell-label">盘口</div>
                        <div class="modal-movement__cell-line">${ttLine}球</div>
                    </div>
                </div>
            </div>
        `;
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
    const home = window.getTeamById(match.homeTeam, match._homeName);
    const away = window.getTeamById(match.awayTeam, match._awayName);
    const venue = window.getVenueById(match.venue);
    const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const stage = window.getStageName(match.stage) + (match.group ? " · " + match.group + "组" : "");
    const provider = oddsInfo.providers.draftkings || oddsInfo.providers.bet365 || oddsInfo.providers.caesars || oddsInfo.providers.betfair || oddsInfo.providers.unibet || null;
    const predictedScore = prediction ? inferPredictedScore(prediction, home.rank, away.rank) : null;
    const halfTime = prediction ? inferHalfTime(prediction) : null;
    const goalDist = prediction ? inferGoalDistribution(prediction) : null;

    body.innerHTML = `
        ${renderModalHero(match, home, away, venue, localTime, stage)}
        ${renderModalDashboard(prediction, provider)}
        ${renderModalConfidence(prediction)}
        ${renderModalBento(prediction, predictedScore, halfTime, goalDist)}
        ${renderModalMovement(provider)}
    `;
  }

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
    if (!modal || !closeBtn) return;
    const overlay = modal.querySelector(".modal__overlay");
    if (!overlay) return;
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

  // 导出
  window.buildPredFallback = buildPredFallback;
  window.loadAndBuildPredictions = loadAndBuildPredictions;
  window.updatePredStats = updatePredStats;
  window.getPredFilteredMatches = getPredFilteredMatches;
  window.renderPredictionsList = renderPredictionsList;
  window.buildPredMatchCard = buildPredMatchCard;
  window.setupPredFilters = setupPredFilters;
  window.showMatchDetails = showMatchDetails;
  window.openMatchOddsModal = openMatchOddsModal;
  window.renderModalContent = renderModalContent;
  window.closeOddsModal = closeOddsModal;
  window.setupModal = setupModal;

  window.App.predictions.buildPredFallback = buildPredFallback;
  window.App.predictions.loadAndBuildPredictions = loadAndBuildPredictions;
  window.App.predictions.updatePredStats = updatePredStats;
  window.App.predictions.getPredFilteredMatches = getPredFilteredMatches;
  window.App.predictions.renderPredictionsList = renderPredictionsList;
  window.App.predictions.buildPredMatchCard = buildPredMatchCard;
  window.App.predictions.setupPredFilters = setupPredFilters;
  window.App.predictions.showMatchDetails = showMatchDetails;
  window.App.predictions.openMatchOddsModal = openMatchOddsModal;
  window.App.predictions.renderModalContent = renderModalContent;
  window.App.predictions.renderModalConfidence = renderModalConfidence;
  window.App.predictions.closeOddsModal = closeOddsModal;
  window.App.predictions.setupModal = setupModal;
  // 暴露内部 Map 和 matches 数组，供 oddsEngine.generateHotPredictions 共享数据
  window.App.predictions.getMap = function() { return predMatchOddsMap2; };
  window.App.predictions.getMatches = function() { return _predEspnMatches2; };
})();