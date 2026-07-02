/**
 * @fileoverview 赔率引擎和分析模块
 * @description 赔率聚合、趋势分析、图表渲染
 */
(function() {
  window.App = window.App || {};
  window.App.odds = window.App.odds || {};

  /* ================================================================
   * 赔率引擎核心函数 (使用 window.xxx 工具函数)
   * ================================================================ */

  /* ================================================================
   * 变量定义
   * ================================================================ */
  var anaChartInstances = {};
  var anaAllOddsData = [];
  var anaEventListenersSetup = false;
  // 图表颜色缓存：避免每次绘图都调 getComputedStyle 触发强制同步样式重算
  var _chartColorCache = null;
  function getChartColors() {
    if (_chartColorCache) return _chartColorCache;
    var root = document.documentElement;
    var cs = getComputedStyle(root);
    _chartColorCache = {
      home: cs.getPropertyValue("--secondary-color").trim() || "#d4a843",
      away: cs.getPropertyValue("--status-live").trim() || "#ef4444",
      draw: cs.getPropertyValue("--text-light").trim() || "#94a3b8"
    };
    return _chartColorCache;
  }
  // predMatchOddsMap2 和 _predEspnMatches2 移至 window.App.predictions 共享命名空间
  // generateHotPredictions 通过 window.App.predictions.getMap() 访问数据

  /* ================================================================
   * 赔率引擎核心函数
   * ================================================================ */

  /**
   * 生成推荐文案模板
   * @param {string} favorite - 看好方（"home"/"away"/"draw"）
   * @param {string|null} homeOdds - 主胜美式赔率
   * @param {string|null} drawOdds - 平局美式赔率
   * @param {string|null} awayOdds - 客胜美式赔率
   * @returns {Object|null} 推荐模板对象
   */
  function generateRecommendationTemplate(favorite, homeOdds, drawOdds, awayOdds) {
    var teamName = "", americanOdds = null;
    if (favorite === "home") {
      teamName = "\u4E3B\u80DC"; // "主胜"
      americanOdds = homeOdds;
    } else if (favorite === "away") {
      teamName = "\u5BA2\u80DC"; // "客胜"
      americanOdds = awayOdds;
    } else if (favorite === "draw") {
      teamName = "\u5E73\u5C40"; // "平局"
      americanOdds = drawOdds;
    }
    if (!americanOdds) return null;
    var decimalOdds = window.americanToDecimal(americanOdds);
    if (!decimalOdds) return null;
    return { text: "\u770B\u597D" + teamName + "\uFF0C\u5BF9\u5E94\u7684\u8D54\u7387\u4E3A" + decimalOdds + "\uFF08\u56FD\u5185\u8D54\u7387\uFF09", teamName: teamName, americanOdds: americanOdds, decimalOdds: decimalOdds }; // "看好{teamName}，对应的赔率为{decimalOdds}（国内赔率）"
  }

  /**
   * 聚合多个提供商的赔率数据，取各方向隐含概率的中位数
   * @param {Object} oddsInfo - parseOddsFromEspnEvent 返回的赔率信息
   * @returns {Object|null} 聚合后的赔率对象（含 _aggProbs），无数据返回 null
   */
  function aggregateOdds(oddsInfo) {
    var providers = Object.entries(oddsInfo.providers).filter(function(entry) {
      return entry[1].moneyline;
    });
    if (providers.length === 0) return null;
    if (providers.length === 1) {
      var p = providers[0][1];
      var hp = window.oddsToImpliedProb(p.moneyline.home), dp = window.oddsToImpliedProb(p.moneyline.draw), ap = window.oddsToImpliedProb(p.moneyline.away);
      return { name: p.name, providerCount: 1, _aggProbs: { home: hp, draw: dp, away: ap }, spread: p.spread || null, total: p.total || null };
    }
    // 动态权重：基于市场共识偏差计算（偏差越低权重越高）
    // 1) 计算各方向所有提供商隐含概率的平均值
    var probList = [];
    providers.forEach(function(entry) {
      var p = entry[1];
      var hp = window.oddsToImpliedProb(p.moneyline.home), dp = window.oddsToImpliedProb(p.moneyline.draw), ap = window.oddsToImpliedProb(p.moneyline.away);
      if (hp !== null && ap !== null) {
        probList.push({ key: entry[0], hp: hp, dp: dp, ap: ap });
      }
    });
    if (probList.length === 0) return null;
    var avgHome = 0, avgAway = 0, avgDrawSum = 0, avgDrawCnt = 0;
    probList.forEach(function(item) {
      avgHome += item.hp;
      avgAway += item.ap;
      if (item.dp !== null) { avgDrawSum += item.dp; avgDrawCnt++; }
    });
    avgHome /= probList.length;
    avgAway /= probList.length;
    var avgDraw = avgDrawCnt > 0 ? avgDrawSum / avgDrawCnt : null;
    // 2) 每个提供商计算与平均值的偏差，权重 = exp(-deviation * 2)
    // 3) 归一化权重使其和为 1
    var weights = [];
    var wSum = 0;
    probList.forEach(function(item) {
      var dev = Math.abs(item.hp - avgHome) + Math.abs(item.ap - avgAway);
      if (avgDraw !== null && item.dp !== null) dev += Math.abs(item.dp - avgDraw);
      dev = dev / 3; // 三方向平均偏差
      var w = Math.exp(-dev * 2);
      weights.push(w);
      wSum += w;
    });
    if (wSum === 0) return null;
    var wHomeSum = 0, wDrawSum = 0, wAwaySum = 0, wTotal = 0;
    probList.forEach(function(item, i) {
      var w = weights[i] / wSum; // 归一化
      wHomeSum += item.hp * w;
      wAwaySum += item.ap * w;
      if (item.dp !== null) wDrawSum += item.dp * w;
      wTotal += w;
    });
    if (wTotal === 0) return null;
    var providerObjs = providers.map(function(entry) { return entry[1]; });
    return {
      name: providerObjs.map(function(p) { return p.name; }).join(" / ") + " (\u52A0\u6743\u805A\u5408)", // "加权聚合"
      providerCount: providers.length,
      _aggProbs: {
        home: +(wHomeSum / wTotal).toFixed(1),
        draw: wDrawSum > 0 ? +(wDrawSum / wTotal).toFixed(1) : null,
        away: +(wAwaySum / wTotal).toFixed(1)
      },
      spread: providerObjs.find(function(p) { return p.spread; })?.spread || null,
      total: providerObjs.find(function(p) { return p.total; })?.total || null
    };
  }

  /**
   * 移除庄家利润（overround），还原真实概率
   * @param {number} homeProb - 主胜隐含概率
   * @param {number|null} drawProb - 平局隐含概率
   * @param {number} awayProb - 客胜隐含概率
   * @returns {Object} { home, draw, away, overround(庄家利润率%) }
   */
  function removeOverround(homeProb, drawProb, awayProb) {
    var total = (homeProb || 0) + (drawProb || 0) + (awayProb || 0);
    if (total <= 0) return { home: homeProb, draw: drawProb, away: awayProb, overround: 0 };
    var factor = total / 100;
    return {
      home: +(homeProb / factor).toFixed(2),
      draw: drawProb != null ? +(drawProb / factor).toFixed(2) : null,
      away: +(awayProb / factor).toFixed(2),
      overround: +((factor - 1) * 100).toFixed(2)
    };
  }

  /**
   * 分析赔率变动，检测 Sharp Money（大额资金流向）
   * @param {Object} ml - 独赢赔率对象（含 open/close 字段）
   * @returns {Object|null} { homeShift, awayShift, isSharp, direction }
   */
  function analyzeOddsMovement(ml) {
    if (!ml || !ml.homeOpen || !ml.home) return null;
    var homeOpen = window.oddsToImpliedProb(ml.homeOpen), homeClose = window.oddsToImpliedProb(ml.home);
    var awayOpen = window.oddsToImpliedProb(ml.awayOpen), awayClose = window.oddsToImpliedProb(ml.away);
    if (homeOpen === null || homeClose === null) return null;
    var homeShift = homeClose - homeOpen, awayShift = awayClose != null && awayOpen != null ? awayClose - awayOpen : 0;
    var maxShift = Math.max(Math.abs(homeShift), Math.abs(awayShift));
    // 相对阈值：以隐含概率为基准计算变动百分比
    // 使用开盘隐含概率作为基准（避免除零）
    var baseProb = Math.max(homeOpen, Math.abs(awayOpen || 0), 1);
    var shiftPct = (maxShift / baseProb) * 100;
    var magnitude = "stable";
    if (shiftPct > 10) magnitude = "extreme";
    else if (shiftPct > 5) magnitude = "sharp";
    else if (shiftPct > 0) magnitude = "moderate";
    var direction = "stable";
    if (homeShift > 0) direction = "favor_home";
    else if (homeShift < 0) direction = "favor_away";
    var reverseSignal = false;
    if (homeShift > 1 && awayShift > 1) {
      reverseSignal = true;
      direction = "favor_draw";
    }
    var fundType = shiftPct > 5 ? "sharp" : "public";
    return {
      homeShift: +homeShift.toFixed(1),
      awayShift: +awayShift.toFixed(1),
      isSharp: shiftPct > 5,
      magnitude: magnitude,
      direction: direction,
      reverseSignal: reverseSignal,
      fundType: fundType,
      signalStrength: Math.min(10, Math.round(shiftPct))
    };
  }

  /**
   * 应用赔率变动修正到预测概率
   * 将 open→close 的变动方向/幅度量化为概率修正因子
   * 使用 tanh sigmoid 阻尼函数：小幅变动线性响应，大幅变动平滑饱和
   * @param {Object} norm - 归一化概率 { home, draw, away }
   * @param {Object} movement - analyzeOddsMovement 返回的变动对象
   * @returns {Object} { home, draw, away, movementFactor, wasAdjusted }
   */
  function applyMovementAdjustment(norm, movement) {
    if (!movement || !norm) return { home: norm.home, draw: norm.draw, away: norm.away, movementFactor: 0, wasAdjusted: false };
    var homeShift = movement.homeShift || 0;
    // sigmoid 阻尼：tanh 映射替代线性 min(5, |shift|*0.3)
    // 优势：小幅变动近似线性响应，大幅变动平滑饱和（避免硬截断）
    // maxAdjust=5，scale=0.2：|shift|=1→~1.0, |shift|=5→~3.8, |shift|=10→~4.8, |shift|≥20→~5.0
    var absShift = Math.abs(homeShift);
    var adjustment = 5 * Math.tanh(absShift * 0.2);
    // 方向：正 homeShift 利好主队，负 homeShift 利好客队
    var movementFactor = homeShift > 0 ? +adjustment : homeShift < 0 ? -adjustment : 0;
    if (movementFactor === 0) return { home: norm.home, draw: norm.draw, away: norm.away, movementFactor: 0, wasAdjusted: false };
    var adjHome = norm.home + movementFactor;
    var adjAway = norm.away - movementFactor * 0.8;
    // draw 可能为 null（淘汰赛无平局赔率），跳过 draw 调整避免 NaN
    var adjDraw = (norm.draw !== null && norm.draw !== undefined) ? norm.draw - movementFactor * 0.2 : null;
    var total = adjHome + adjAway + (adjDraw !== null ? adjDraw : 0);
    if (total <= 0) return { home: norm.home, draw: norm.draw, away: norm.away, movementFactor: 0, wasAdjusted: false };
    return {
      home: Math.round(adjHome / total * 100),
      draw: Math.round(adjDraw / total * 100),
      away: Math.round(adjAway / total * 100),
      movementFactor: movementFactor,
      wasAdjusted: true
    };
  }

  /**
   * 跨市场交叉验证：让球盘和大小球对胜负倾向的信号
   * @param {Object} spread - 让球盘数据
   * @param {Object} total - 大小球数据
   * @param {string} [mlFavorite] - 独赢盘热门方 ("home"/"away"/"draw")，用于计算不一致度
   * @returns {Object} { spreadSignal, totalLean, penalty, inconsistencyDegree }
   */
  function crossMarketAdjust(spread, total, mlFavorite) {
    var result = { spreadSignal: null, totalLean: null, penalty: 0, inconsistencyDegree: 0 };
    var spreadLine = null;
    if (spread && spread.homeLine != null) {
      var line = parseFloat(spread.homeLine);
      if (!isNaN(line)) {
        spreadLine = line;
        result.spreadSignal = line < -0.5 ? "favor_home" : line > 0.5 ? "favor_away" : "neutral";
      }
    }
    if (total && total.line != null) {
      var line = parseFloat(total.line);
      if (!isNaN(line)) result.totalLean = line >= 2.5 ? "high_scoring" : "low_scoring";
    }
    // 动态惩罚：基于独赢盘热门与让球盘信号的不一致程度
    // inconsistencyDegree: 0 (一致) ~ 1.5+ (强不一致)，由让球盘线值与方向冲突程度决定
    if (result.spreadSignal && result.spreadSignal !== "neutral" && mlFavorite) {
      var mlFav = mlFavorite === "home" ? "favor_home" : mlFavorite === "away" ? "favor_away" : "neutral";
      if (mlFav !== "neutral" && result.spreadSignal !== mlFav) {
        // 不一致：让球盘线值越大，不一致程度越高
        var absLine = Math.abs(spreadLine || 0);
        result.inconsistencyDegree = Math.min(1.5, 0.5 + absLine / 2);
      }
    }
    // 动态惩罚 = min(15, inconsistencyDegree * 10)
    result.penalty = Math.min(15, result.inconsistencyDegree * 10);
    return result;
  }

  /**
   * 计算信心值及其完整分解（基于信息熵模型）
   * 公式：confidence = clamp(rawConfidence + signalAdjust, 0, 100) × qualityFactor
   * @param {Object} norm - 归一化概率 {home, draw, away}（百分数 0-100）
   * @param {number} overround - 庄家利润率
   * @param {Object|null} movement - analyzeOddsMovement 输出
   * @param {Object|null} crossMarket - crossMarketAdjust 输出
   * @param {Array} valueBets - detectValueBet 输出（数组）
   * @param {number} providerCount - 数据提供商数量
   * @returns {Object} confidenceBreakdown
   */
  function calibrateConfidence(norm, overround, movement, crossMarket, valueBets, providerCount, homeRank, awayRank) {
    // 边界：无概率数据
    if (!norm || norm.home == null || norm.away == null) {
      return { rawConfidence: 0, entropy: 0, H_max: 1.585, signalAdjust: 0,
        signalBreakdown: { movement: 0, crossMarket: 0, valueBet: 0, rank: 0 },
        qualityFactor: 0, qualityBreakdown: { overroundFactor: 0, providerFactor: 0 },
        finalConfidence: 0, _meta: { overround: overround || 0, providerCount: providerCount || 0, probs: { home: 0, draw: 0, away: 0 } } };
    }

    // === 1. 基础信心：信息熵归一化 ===
    var pH = Math.max(0, norm.home) / 100;
    var pD = Math.max(0, norm.draw || 0) / 100;
    var pA = Math.max(0, norm.away) / 100;
    var pSum = pH + pD + pA;
    if (pSum <= 0) {
      return { rawConfidence: 0, entropy: 0, H_max: 1.585, signalAdjust: 0,
        signalBreakdown: { movement: 0, crossMarket: 0, valueBet: 0, rank: 0 },
        qualityFactor: 0, qualityBreakdown: { overroundFactor: 0, providerFactor: 0 },
        finalConfidence: 0, _meta: { overround: overround || 0, providerCount: providerCount || 0, probs: { home: norm.home, draw: norm.draw || 0, away: norm.away } } };
    }
    pH = pH / pSum; pD = pD / pSum; pA = pA / pSum;

    // 安全熵计算：0 × log(0) 按 0 处理
    function safeEntropy(p) { return p <= 0 ? 0 : -p * Math.log2(p); }
    var H = safeEntropy(pH) + safeEntropy(pD) + safeEntropy(pA);
    var H_max = Math.log2(3); // ≈ 1.585
    var rawConfidence = (1 - H / H_max) * 100;

    // 确定最高概率方向（用于信号对齐判断）
    var topOutcome = (norm.home >= (norm.draw || 0) && norm.home >= norm.away) ? "favor_home"
                   : (norm.away >= (norm.draw || 0)) ? "favor_away" : "favor_draw";

    // === 2. 信号调整 ===
    // 2.1 赔率变动信号（-7.5 ~ +15）
    var movementSignal = 0;
    if (movement && movement.magnitude) {
      var baseScore = { extreme: 15, sharp: 10, moderate: 6, stable: 0 }[movement.magnitude] || 0;
      var directionBonus = (movement.direction && movement.direction === topOutcome) ? 0 : -baseScore * 0.5;
      movementSignal = baseScore + directionBonus;
    }

    // 2.2 跨市场一致性信号（-9 ~ +10）
    var crossMarketSignal = 0;
    if (crossMarket && typeof crossMarket.inconsistencyDegree === 'number') {
      var normalizedInconsistency = Math.min(1, crossMarket.inconsistencyDegree);
      var consistencyScore = (1 - normalizedInconsistency) * 10;
      crossMarketSignal = consistencyScore >= 5 ? consistencyScore : -consistencyScore * 0.6;
    }

    // 2.3 价值投注信号（-5 ~ +10）
    var valueBetSignal = 0;
    if (valueBets && valueBets.length > 0) {
      var maxEdge = 0;
      var topValueBetType = null;
      valueBets.forEach(function(v) {
        if (v.edge > maxEdge) { maxEdge = v.edge; topValueBetType = v.type; }
      });
      var vbDirection = topValueBetType === "home" ? "favor_home"
                      : topValueBetType === "away" ? "favor_away" : "favor_draw";
      var alignment = (vbDirection === topOutcome) ? 1 : -0.5;
      valueBetSignal = Math.min(10, maxEdge * 2) * alignment;
    }

    // 2.4 FIFA 排名辅助信号（-8 ~ +8）
    // 排名差 ≥3 才产生信号；与赔率热门一致时提升信心，冲突时降低信心
    var rankSignal = 0;
    if (homeRank && awayRank && homeRank > 0 && awayRank > 0) {
      var rankDiff = awayRank - homeRank; // 正数=主队排名靠前（实力更强）
      var rankDirection = rankDiff > 3 ? "favor_home"
                        : rankDiff < -3 ? "favor_away" : "neutral";
      if (rankDirection !== "neutral" && topOutcome !== "favor_draw") {
        var absRankDiff = Math.abs(rankDiff);
        if (rankDirection === topOutcome) {
          rankSignal = Math.min(8, absRankDiff * 0.5);
        } else {
          rankSignal = -Math.min(8, absRankDiff * 0.4);
        }
      }
    }

    var signalAdjust = movementSignal + crossMarketSignal + valueBetSignal + rankSignal;

    // === 3. 数据质量因子（平滑改进版） ===
    var ovr = (typeof overround === 'number') ? overround : 5;
    var pCount = (typeof providerCount === 'number') ? providerCount : 0;
    // overround 因子：指数从 1.5 降至 1.2，减少高 overround 时的过度惩罚
    var overroundFactor = Math.pow(1 - ovr / 100, 1.2);
    // provider 因子：用 sigmoid 平滑替代硬截断 min(1, pCount/4)
    // 2 家 → ~0.82，3 家 → ~0.95，4 家 → ~0.98
    var providerFactor = 1 / (1 + Math.exp(-(pCount - 2) * 1.2));
    var qualityFactor = Math.max(0.15, overroundFactor * providerFactor);

    // === 3.5 Brier 惩罚：对极端概率分布施加微调 ===
    // Brier Score = Σ(p_i - o_i)²，其中 o_i 为实际结果（这里用 top outcome = 1）
    // 高 Brier（概率分散）→ 惩罚；低 Brier（概率集中）→ 无影响
    var topProb = Math.max(pH, pD, pA);
    var brierPenalty = (1 - topProb) * (1 - topProb) * 3; // 最多约 3 分惩罚
    if (topProb < 0.4) brierPenalty *= 1.5; // 概率极分散时加倍惩罚

    // === 4. 最终计算 ===
    var adjustedRaw = Math.max(0, Math.min(100, rawConfidence + signalAdjust - brierPenalty));
    var finalConfidence = Math.round(Math.max(0, Math.min(100, adjustedRaw * qualityFactor)));

    return {
      rawConfidence: Math.round(rawConfidence * 10) / 10,
      entropy: Math.round(H * 1000) / 1000,
      H_max: Math.round(H_max * 1000) / 1000,
      signalAdjust: Math.round(signalAdjust * 10) / 10,
      signalBreakdown: {
        movement: Math.round(movementSignal * 10) / 10,
        crossMarket: Math.round(crossMarketSignal * 10) / 10,
        valueBet: Math.round(valueBetSignal * 10) / 10,
        rank: Math.round(rankSignal * 10) / 10
      },
      qualityFactor: Math.round(qualityFactor * 100) / 100,
      qualityBreakdown: {
        overroundFactor: Math.round(overroundFactor * 100) / 100,
        providerFactor: Math.round(providerFactor * 100) / 100
      },
      brierPenalty: Math.round(brierPenalty * 10) / 10,
      finalConfidence: finalConfidence,
      _meta: {
        overround: ovr,
        providerCount: pCount,
        probs: { home: norm.home, draw: norm.draw || 0, away: norm.away }
      }
    };
  }

  /**
   * 检测价值投注（Value Bet）
   * @param {Object} trueProbs - 移除利润后的真实概率 { home, draw, away }
   * @param {Object} ml - 独赢赔率对象
   * @returns {Array} 价值投注数组
   */
  function detectValueBet(trueProbs, ml) {
    if (!ml || !trueProbs) return [];
    var valueBets = [];
    // 动态阈值：基于 overround，最低 0.03（提高门槛减少噪音）
    var threshold = Math.max(0.03, (trueProbs.overround || 0) / 8);
    function check(type, trueProb, americanOdds) {
      if (trueProb === null || !americanOdds) return;
      var n = parseInt(americanOdds, 10);
      if (isNaN(n)) return;
      var decimalOdds = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
      var edge = trueProb / 100 * decimalOdds - 1;
      if (edge > threshold) {
        // Kelly 比例：f = (b*p - q) / b，其中 b = decimalOdds-1, p = trueProb/100, q = 1-p
        var b = decimalOdds - 1;
        var p = trueProb / 100;
        var q = 1 - p;
        var kelly = b > 0 ? (b * p - q) / b : 0;
        // 1/4 Kelly 建议下注比例（保守策略）
        var kellyFraction = Math.max(0, Math.min(0.25, kelly * 0.25));
        valueBets.push({
          type: type,
          edge: +(edge * 100).toFixed(1),
          trueProb: +trueProb.toFixed(1),
          decimalOdds: +decimalOdds.toFixed(2),
          kelly: +(kelly * 100).toFixed(1),
          kellyFraction: +(kellyFraction * 100).toFixed(1)
        });
      }
    }
    check("home", trueProbs.home, ml.home);
    check("draw", trueProbs.draw, ml.draw);
    check("away", trueProbs.away, ml.away);
    return valueBets;
  }

  /**
   * 从赔率数据推导完整预测结果
   * @param {Object} oddsInfo - parseOddsFromEspnEvent 返回的赔率信息
   * @param {Object} [match] - 比赛对象，用于提取 FIFA 排名
   * @returns {Object|null} 完整预测对象
   */
  function derivePredictionFromOdds(oddsInfo, match) {
    if (!oddsInfo || !oddsInfo.providers) return null;
    var aggProvider = aggregateOdds(oddsInfo);
    if (!aggProvider) return null;
    var rawProvider = oddsInfo.providers.draftkings || oddsInfo.providers.bet365 || oddsInfo.providers.caesars || oddsInfo.providers.main;
    var pred = { homeWin: null, draw: null, awayWin: null, overUnder: null, spread: null, favorite: null, confidence: null, recommendation: "", recommendationTemplate: null, oddsSource: aggProvider.name || "\u5E02\u573A\u8D54\u7387", overround: 0, movement: null, valueBets: [], providerCount: aggProvider.providerCount || 1, isAggregated: (aggProvider.providerCount || 1) > 1, homeAdvProb: null, awayAdvProb: null }; // "市场赔率"
    var aggProbs = aggProvider._aggProbs;
    if (aggProbs && aggProbs.home !== null && aggProbs.away !== null) {
      var trueProbs = removeOverround(aggProbs.home, aggProbs.draw, aggProbs.away);
      pred.overround = trueProbs.overround;
      var norm = window.normalizeProbabilities(trueProbs.home, trueProbs.draw, trueProbs.away);
      if (!norm) {
        pred.homeWin = null;
        pred.draw = null;
        pred.awayWin = null;
      } else {
        pred.homeWin = norm.home;
        pred.draw = norm.draw;
        pred.awayWin = norm.away;
        pred.movement = analyzeOddsMovement(rawProvider?.moneyline || {});
        var adjProbs = applyMovementAdjustment(norm, pred.movement);
        pred.adjustedProbs = adjProbs;
        if (adjProbs.wasAdjusted) {
          pred.homeWin = adjProbs.home;
          pred.draw = adjProbs.draw;
          pred.awayWin = adjProbs.away;
        }
        var crossResult = crossMarketAdjust(aggProvider.spread, aggProvider.total);
        pred.crossMarket = crossResult;
        pred.favorite = pred.homeWin > (pred.awayWin || 0) ? "home" : (pred.awayWin || 0) > pred.homeWin ? "away" : "draw";
        // 若让球盘与独赢盘方向冲突，基于 favorite 重新计算 crossMarket（inconsistencyDegree 会更新）
        if (crossResult.spreadSignal) {
          var spreadFav = crossResult.spreadSignal, mlFav = pred.favorite === "home" ? "favor_home" : pred.favorite === "away" ? "favor_away" : "neutral";
          if (spreadFav !== "neutral" && mlFav !== "neutral" && spreadFav !== mlFav) {
            var recalcedCross = crossMarketAdjust(aggProvider.spread, aggProvider.total, pred.favorite);
            pred.crossMarket = recalcedCross;
          }
        }
        // 价值投注（用于信心值计算）
        pred.valueBets = detectValueBet(trueProbs, rawProvider?.moneyline || {});
        // 提取 FIFA 排名（用于信心值排名辅助信号）
        var homeRank = null, awayRank = null;
        if (match) {
          var homeTeam = window.getTeamById(match.homeTeam, match._homeName);
          var awayTeam = window.getTeamById(match.awayTeam, match._awayName);
          homeRank = homeTeam ? homeTeam.rank : null;
          awayRank = awayTeam ? awayTeam.rank : null;
        }
        // 信心值计算（信息熵模型，传入所有中间结果，零重复计算）
        var confidenceData = calibrateConfidence(
          { home: pred.homeWin, draw: pred.draw, away: pred.awayWin },
          pred.overround,
          pred.movement,
          pred.crossMarket,
          pred.valueBets,
          pred.providerCount,
          homeRank,
          awayRank
        );
        pred.confidence = confidenceData.finalConfidence;
        pred.confidenceBreakdown = confidenceData;
        var template = generateRecommendationTemplate(pred.favorite, rawProvider?.moneyline?.home, rawProvider?.moneyline?.draw, rawProvider?.moneyline?.away);
        if (pred.confidence >= 70) {
          pred.recommendation = pred.favorite === "home" ? "\u4E3B\u80DC" : pred.favorite === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40"; // "主胜" / "客胜" / "平局"
          if (template) pred.recommendationTemplate = template.text;
        } else if (pred.confidence >= 55) {
          pred.recommendation = pred.favorite === "home" ? "\u4E3B\u80DC\uFF08\u5C0F\u4F18\uFF09" : pred.favorite === "away" ? "\u5BA2\u80DC\uFF08\u5C0F\u4F18\uFF09" : "\u5E73\u5C40\u503E\u5411"; // "主胜（小优）" / "客胜（小优）" / "平局倾向"
          if (template) pred.recommendationTemplate = template.text;
        } else {
          pred.recommendation = "\u6BD4\u8D5B\u60AC\u5FF5\u8F83\u5927"; // "比赛悬念较大"
          pred.recommendationTemplate = null;
        }
        if (pred.valueBets.length > 0) {
          var bestBet = pred.valueBets.reduce(function(a, b) { return a.edge > b.edge ? a : b; });
          var betName = bestBet.type === "home" ? "\u4E3B\u80DC" : bestBet.type === "away" ? "\u5BA2\u80DC" : "\u5E73\u5C40"; // "主胜" / "客胜" / "平局"
          pred.recommendationTemplate = "\uD83D\uDCA1 \u4EF7\u503C\u673A\u4F1A\uFF1A" + betName + " edge +" + bestBet.edge + "%\uFF08\u771F\u5B9E\u6982\u7387" + bestBet.trueProb + "% vs \u8D54\u7387\u9690\u542B" + (100 / bestBet.decimalOdds).toFixed(1) + "%\uFF09"; // "💡 价值机会：{betName} edge +x%（真实概率x% vs 赔率隐含x%）"
        }
      }
    }
    var totalProvider = (rawProvider && rawProvider.total) ? rawProvider : (aggProvider.total ? aggProvider : null);
    if (!totalProvider && oddsInfo.providers) {
      var providersArr = Object.values(oddsInfo.providers);
      totalProvider = providersArr.find(function(p) { return p && p.total && p.total.line != null; }) || null;
    }
    if (totalProvider && totalProvider.total) {
      var line = parseFloat(totalProvider.total.line);
      if (!isNaN(line)) {
        var overStr = totalProvider.total.overOdds ? window.formatDecimalOdds(totalProvider.total.overOdds) : "";
        var underStr = totalProvider.total.underOdds ? window.formatDecimalOdds(totalProvider.total.underOdds) : "";
        pred.overUnder = { line: line, overOdds: totalProvider.total.overOdds || null, underOdds: totalProvider.total.underOdds || null, lean: line >= 2.5 ? "over" : "under", description: "\u5927\u5C0F\u7403" + line + "\u7403" + (overStr && underStr ? " (" + overStr + "/" + underStr + ")" : "") }; // "大小球{x}球"
      }
    }
    var spreadProvider = (rawProvider && rawProvider.spread) ? rawProvider : (aggProvider.spread ? aggProvider : rawProvider || aggProvider);
    if (spreadProvider && spreadProvider.spread) {
      var hl = parseFloat(spreadProvider.spread.homeLine);
      if (!isNaN(hl)) {
        var spreadOdds = spreadProvider.spread.homeOdds ? window.formatDecimalOdds(spreadProvider.spread.homeOdds) : "";
        pred.spread = { line: hl, description: hl < 0 ? "\u4E3B\u961F\u8BA9" + Math.abs(hl) + "\u7403" + (spreadOdds ? " (" + spreadOdds + ")" : "") : "\u5BA2\u961F\u8BA9" + hl + "\u7403" + (spreadOdds ? " (" + spreadOdds + ")" : "") }; // "主队让x球" / "客队让x球"
      }
    }
    // 提取半场盘口数据（如果API返回）
    var htProvider = (rawProvider && rawProvider.halfTime) ? rawProvider : (aggProvider.halfTime ? aggProvider : null);
    if (htProvider && htProvider.halfTime) {
      pred.halfTimeOdds = htProvider.halfTime;
    }
    return pred;
  }

  /* ================================================================
   * 分析模块：图表 & 趋势
   * ================================================================ */

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
      var dates = anaBuildDateRangeStr();
      var data = await window.espnCache.fetch(dates, 200);
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
    var base = new Date();
    var start = new Date(base);
    start.setDate(start.getDate() - 7);
    var end = new Date(base);
    end.setDate(end.getDate() + 80);
    return start.toISOString().slice(0, 10).replace(/-/g, "") + "-" + end.toISOString().slice(0, 10).replace(/-/g, "");
  }

  /**
   * 保存当前赔率为历史快照到 localStorage
   * @param {string|number} matchId - 比赛 ID
   * @param {Object} oddsInfo - 赔率信息对象
   * @param {string} provider - 提供商键名
   * @param {string} oddsType - 赔率类型
   */
  function saveOddsSnapshot(matchId, oddsInfo, provider, oddsType) {
    if (!matchId || !oddsInfo) return;
    var p = oddsInfo.providers[provider];
    if (!p) return;
    try {
      var key = 'oddsHistory_' + matchId;
      var history = [];
      try {
        var raw = localStorage.getItem(key);
        if (raw) history = JSON.parse(raw);
      } catch (e) { console.warn('[saveOddsSnapshot] JSON\u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u7A7A\u6570\u7EC4:', e.message); history = []; } // "解析失败，使用空数组"
      if (!Array.isArray(history)) history = [];
      var today = new Date().toISOString().slice(0, 10);
      var homeDec, awayDec, drawDec;
      if (oddsType === 'moneyline' && p.moneyline) {
        homeDec = anaAmericanToDecimal(p.moneyline.home) || 0;
        awayDec = anaAmericanToDecimal(p.moneyline.away) || 0;
        drawDec = anaAmericanToDecimal(p.moneyline.draw) || 0;
      } else {
        return;
      }
      if (!homeDec || !awayDec) return;
      var snapshot = {
        date: today,
        homeOdds: homeDec,
        awayOdds: awayDec,
        drawOdds: drawDec,
        homeProb: +(100 / homeDec).toFixed(1),
        awayProb: +(100 / awayDec).toFixed(1),
        drawProb: +(100 / drawDec).toFixed(1),
        provider: provider,
        oddsType: oddsType
      };
      var existingIdx = history.findIndex(function(h) { return h.date === today && h.provider === provider && h.oddsType === oddsType; });
      if (existingIdx >= 0) {
        history[existingIdx] = snapshot;
      } else {
        history.push(snapshot);
      }
      if (history.length > 60) history = history.slice(-60);
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.error('[saveOddsSnapshot] localStorage 写入失败:', e);
    }
  }

  /**
   * 从 localStorage 加载指定比赛的历史赔率快照
   * @param {string|number} matchId - 比赛 ID
   * @returns {Array} 历史快照数组
   */
  function loadOddsHistory(matchId) {
    if (!matchId) return [];
    try {
      var raw = localStorage.getItem('oddsHistory_' + matchId);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 生成赔率趋势模拟数据（14天时间窗口，带随机抖动和收敛）
   * @param {Object} oddsInfo - 赔率信息对象
   * @param {string} provider - 提供商键名
   * @param {string} oddsType - 赔率类型
   * @returns {Array|null} 趋势数据点数组
   */
  function anaGenerateTrendData(oddsInfo, provider, oddsType) {
    var p = oddsInfo.providers[provider];
    if (!p) return null;
    var matchId = oddsInfo.eventId;
    var history = matchId ? loadOddsHistory(matchId) : [];
    if (oddsType === 'moneyline') {
      history = history.filter(function(h) { return h.provider === provider && h.oddsType === oddsType; });
    } else {
      history = [];
    }
    var points = [];
    var baseDate = new Date(oddsInfo.date);
    if (oddsType === 'moneyline' && p.moneyline) {
      var openHome = p.moneyline.homeOpen ? anaAmericanToDecimal(p.moneyline.homeOpen) : null;
      var openAway = p.moneyline.awayOpen ? anaAmericanToDecimal(p.moneyline.awayOpen) : null;
      var openDraw = p.moneyline.drawOpen ? anaAmericanToDecimal(p.moneyline.drawOpen) : null;
      if (openHome && openAway) {
        var openDate = new Date(baseDate);
        openDate.setDate(openDate.getDate() - 14);
        points.push({
          date: openDate.toISOString().slice(0, 10),
          home: openHome,
          away: openAway,
          draw: openDraw,
          isOpen: true
        });
      }
    }
    var today = new Date().toISOString().slice(0, 10);
    var matchDate = oddsInfo.date || '';
    history.forEach(function(h) {
      if (h.date === today) return;
      if (h.date < matchDate) return;
      points.push({
        date: h.date,
        home: h.homeOdds,
        away: h.awayOdds,
        draw: h.drawOdds,
        isSnapshot: true
      });
    });
    if (oddsType === 'moneyline' && p.moneyline) {
      var curHome = anaAmericanToDecimal(p.moneyline.home);
      var curAway = anaAmericanToDecimal(p.moneyline.away);
      var curDraw = anaAmericanToDecimal(p.moneyline.draw);
      if (curHome && curAway) {
        points.push({
          date: today,
          home: curHome,
          away: curAway,
          draw: curDraw,
          isCurrent: true
        });
      }
    } else if (oddsType === 'spread' && p.spread) {
      var spHome = parseFloat(p.spread.homeLine);
      var spAway = parseFloat(p.spread.awayLine);
      if (!isNaN(spHome) && !isNaN(spAway)) {
        points.push({
          date: today,
          home: spHome,
          away: spAway,
          draw: 0,
          isCurrent: true
        });
      }
    } else if (oddsType === 'total' && p.total) {
      var totLine = parseFloat(p.total.line);
      if (!isNaN(totLine)) {
        points.push({
          date: today,
          home: totLine,
          away: totLine,
          draw: 0,
          isCurrent: true
        });
      }
    } else {
      return null;
    }
    points.sort(function(a, b) { return a.date.localeCompare(b.date); });
    var unique = [];
    var seen = new Set();
    for (var i = points.length - 1; i >= 0; i--) {
      if (!seen.has(points[i].date)) {
        seen.add(points[i].date);
        unique.unshift(points[i]);
      }
    }
    if (unique.length >= 2 && unique.length < 3) {
      var first = unique[0];
      var last = unique[unique.length - 1];
      var midDate = new Date((new Date(first.date).getTime() + new Date(last.date).getTime()) / 2);
      unique.splice(1, 0, {
        date: midDate.toISOString().slice(0, 10),
        home: +((first.home + last.home) / 2).toFixed(3),
        away: +((first.away + last.away) / 2).toFixed(3),
        draw: first.draw && last.draw ? +((first.draw + last.draw) / 2).toFixed(3) : null,
        isInterpolated: true
      });
    }
    return unique.length >= 2 ? unique : null;
  }

  /**
   * 美式赔率转十进制赔率（分析模块专用，默认返回 2）
   * @param {string|number} american - 美式赔率
   * @returns {number} 十进制赔率
   */
  function anaAmericanToDecimal(american) {
    if (!american && american !== 0) return null;
    var n = parseInt(american, 10);
    if (isNaN(n)) return null;
    if (n > 0) return +(n / 100 + 1).toFixed(3);
    return +(100 / Math.abs(n) + 1).toFixed(3);
  }

  /**
   * 初始化赔率分析模块（填充比赛选择器、设置默认提示）
   * @returns {Promise<void>}
   */
  async function initOddsModule() {
    var select = document.getElementById("oddsMatchSelect");
    var chartWrap = document.getElementById("oddsTrendChart")?.parentElement;
    var kp = document.getElementById("oddsKeyPoints");
    if (!select) return;
    select.innerHTML = '<option value="">-- \u8BF7\u9009\u62E9\u6BD4\u8D5B --</option>'; // "请选择比赛"
    anaAllOddsData = [];
    if (kp) kp.innerHTML = "";
    if (chartWrap && !document.getElementById("oddsEmptyHint")) {
      var empty = document.createElement("div");
      empty.id = "oddsEmptyHint";
      empty.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text-tertiary);text-align:center;padding:24px;";
      empty.innerHTML = '\u003Cdiv style="font-size:36px;opacity:0.6;">\uD83D\uDCCA\u003C/div>\u003Cdiv style="font-size:14px;font-weight:600;color:var(--text-secondary);">\u9009\u62E9\u4E00\u573A\u6BD4\u8D5B\u67E5\u770B\u8D54\u7387\u8D8B\u52BF\u003C/div>\u003Cdiv style="font-size:12px;color:#64748b;">\u4ECE\u4E0A\u65B9\u4E0B\u62C9\u6846\u4E2D\u9009\u62E9\u6BD4\u8D5B\uFF0C\u6216\u5207\u6362\u5230\u9884\u6D4B\u5206\u6790\u9875\u9762\u6D4F\u89C8\u6240\u6709\u6BD4\u8D5B\u003C/div>'; // "选择一场比赛查看赔率趋势" / "从上方下拉框中选择比赛，或切换到预测分析页面浏览所有比赛"
      chartWrap.style.position = "relative";
      chartWrap.appendChild(empty);
    }
    var canvas = document.getElementById("oddsTrendChart");
    // 移除 canvas.style.opacity 闪烁：先降透明度再恢复会造成视觉闪烁
    var wcData = window.WORLD_CUP_DATA;
    if (!wcData || !wcData.matches) return;
    var matches = [].concat(wcData.matches).filter(function(m) { return window.isMatchWithRealTeams(m); });
    var enriched = matches.map(function(m) {
      var localTime = window.getLocalMatchTime(m.date, m.time, m.venue, m.timeUTC);
      var sortKey = localTime.date.toISOString().slice(0, 10) + localTime.date.toISOString().slice(11, 16);
      var beijingDateStr = localTime.date.toISOString().slice(0, 10);
      return { match: m, sortKey: sortKey, beijingDateStr: beijingDateStr };
    });
    enriched.sort(function(a, b) { return a.sortKey.localeCompare(b.sortKey); });
    if (enriched.length === 0) return;
    // 使用 DocumentFragment 批量插入 option，避免逐个 appendChild 触发回流
    var optFragment = document.createDocumentFragment();
    enriched.forEach(function(item) {
      var match = item.match, beijingDateStr = item.beijingDateStr;
      var home = typeof window.getTeamById === "function" ? window.getTeamById(match.homeTeam, match._homeName) : null;
      var away = typeof window.getTeamById === "function" ? window.getTeamById(match.awayTeam, match._awayName) : null;
      var opt = document.createElement("option");
      opt.value = match.id;
      opt.textContent = (home ? home.name : match.homeTeam) + " vs " + (away ? away.name : match.awayTeam) + " \u00B7 " + beijingDateStr; // "·"
      opt.dataset.matchId = match.id;
      optFragment.appendChild(opt);
    });
    select.appendChild(optFragment);
    select.onchange = function() {
      var matchId = select.value;
      if (!matchId) return;
      loadAndRenderAnalysisMatch(matchId);
    };
    var anaCovered = document.getElementById("anaCoveredMatches");
    if (anaCovered) anaCovered.textContent = matches.length;
  }

  /**
   * 加载并渲染指定比赛的赔率分析
   * @param {string|number} matchId - 比赛 ID
   * @returns {Promise<void>}
   */
  async function loadAndRenderAnalysisMatch(matchId) {
    var match = window.MATCH_INDEX_BY_ID ? window.MATCH_INDEX_BY_ID.get(Number(matchId)) : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches.find(function(m) { return m.id === Number(matchId); }) : null;
    if (!match) return;
    var empty = document.getElementById("oddsEmptyHint");
    if (empty) empty.remove();
    var chartWrap = document.getElementById("oddsTrendChart")?.parentElement;
    var kp = document.getElementById("oddsKeyPoints");
    if (kp) kp.innerHTML = '<div class="modal-loading"><div class="pred-spinner"></div><span>\u52A0\u8F7D\u8BE5\u573A\u6BD4\u8D5B\u8D54\u7387...</span></div>'; // "加载该场比赛赔率..."
    var payload = null;
    try {
      var dateStr = match.date.replace(/-/g, "");
      var cached = await window.matchOddsCache.fetch(Number(matchId), dateStr, match.homeTeam, match.awayTeam);
      var matchedEvent = window.verifyMatchTeams(cached.event, match.homeTeam, match.awayTeam, window.TEAM_MAP, match);
      payload = { event: matchedEvent, match: match };
    } catch (e) {
      console.error("[loadAndRenderAnalysisMatch] \u52A0\u8F7D\u8D54\u7387\u5931\u8D25:", e.message || e); // "加载赔率失败"
      if (kp) kp.innerHTML = '<p style="color:var(--accent-color);text-align:center;">\u52A0\u8F7D\u5931\u8D25\uFF1A' + window.escapeHTML(e.message || String(e)) + '</p>'; // "加载失败："
      return;
    }
    if (!payload.event) {
      if (kp) kp.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:24px;">\u8BE5\u573A\u6BD4\u8D5B\u6682\u65E0\u8D54\u7387\u6570\u636E</p>'; // "该场比赛暂无赔率数据"
      anaAllOddsData = [];
      anaDestroyChart("oddsTrend");
      return;
    }
    var oddsInfo = window.parseOddsFromEspnEvent(payload.event);
    if (!oddsInfo) {
      if (kp) kp.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;padding:24px;">\u8BE5\u573A\u6BD4\u8D5B\u6682\u65E0\u8D54\u7387\u6570\u636E</p>'; // "该场比赛暂无赔率数据"
      anaAllOddsData = [];
      anaDestroyChart("oddsTrend");
      return;
    }
    anaAllOddsData = [oddsInfo];
    var providerTabs2 = document.getElementById("providerTabs");
    if (providerTabs2) {
      var buttons = providerTabs2.querySelectorAll(".provider-tabs__btn");
      var firstVisible = null;
      buttons.forEach(function(btn) {
        var key = btn.dataset.provider;
        var hasData = key && oddsInfo.providers && oddsInfo.providers[key];
        btn.style.display = hasData ? "" : "none";
        if (hasData && !firstVisible) firstVisible = btn;
      });
      var active = providerTabs2.querySelector(".provider-tabs__btn--active");
      if (active && active.style.display === "none" && firstVisible) {
        active.classList.remove("provider-tabs__btn--active");
        active.setAttribute("aria-selected", "false");
        firstVisible.classList.add("provider-tabs__btn--active");
        firstVisible.setAttribute("aria-selected", "true");
      }
    }
    var activeProvider = (document.querySelector("#providerTabs .provider-tabs__btn.provider-tabs__btn--active")?.dataset.provider) || "draftkings";
    if (!oddsInfo.providers[activeProvider]) {
      activeProvider = Object.keys(oddsInfo.providers)[0] || "draftkings";
    }
    if (typeof anaRenderKeyPoints === "function") anaRenderKeyPoints(oddsInfo, activeProvider, "moneyline");
    if (typeof anaGenerateTrendData === "function") {
      var trend = anaGenerateTrendData(oddsInfo, activeProvider, "moneyline");
      if (trend) anaDrawQuickTrend(trend, oddsInfo);
    }
    try {
      var matchIdNum = Number(matchId);
      if (!isNaN(matchIdNum)) {
        saveOddsSnapshot(matchIdNum, oddsInfo, 'draftkings', 'moneyline');
      }
    } catch (e) { console.warn('[saveOddsSnapshot] \u4FDD\u5B58\u5931\u8D25:', e.message); } // "保存失败"
  }

  /**
   * 快速绘制赔率趋势图（Chart.js 折线图）
   * @param {Array} trend - 趋势数据点数组
   * @param {Object} oddsInfo - 赔率信息对象
   */
  function anaDrawQuickTrend(trend, oddsInfo) {
    var ctx = document.getElementById("oddsTrendChart");
    if (!ctx) return;
    anaDestroyChart("oddsTrend");
    var labels = trend.map(function(p) { return p.date.slice(5); });
    var chartColors = getChartColors();
    anaChartInstances["oddsTrend"] = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: oddsInfo.homeName || "\u4E3B\u80DC", // "主胜"
            data: trend.map(function(p) { return p.home; }),
            borderColor: chartColors.home,
            backgroundColor: chartColors.home + "18",
            fill: true,
            tension: 0.35,
            pointRadius: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              if (!p) return 3;
              if (p.isOpen) return 8;
              if (p.isCurrent) return 6;
              return 3;
            },
            pointHoverRadius: 8,
            pointBackgroundColor: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              return p && p.isOpen ? '#fff' : chartColors.home;
            },
            pointBorderColor: chartColors.home,
            pointBorderWidth: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              return p && p.isOpen ? 3 : 2;
            },
            borderWidth: 2.5,
            yAxisID: 'y'
          },
          {
            label: oddsInfo.awayName || "\u5BA2\u80DC", // "客胜"
            data: trend.map(function(p) { return p.away; }),
            borderColor: chartColors.away,
            backgroundColor: chartColors.away + "14",
            fill: true,
            tension: 0.35,
            pointRadius: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              if (!p) return 3;
              if (p.isOpen) return 8;
              if (p.isCurrent) return 6;
              return 3;
            },
            pointHoverRadius: 8,
            pointBackgroundColor: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              return p && p.isOpen ? '#fff' : chartColors.away;
            },
            pointBorderColor: chartColors.away,
            pointBorderWidth: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              return p && p.isOpen ? 3 : 2;
            },
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: "\u5E73\u5C40", // "平局"
            data: trend.map(function(p) { return p.draw !== null ? p.draw : null; }),
            borderColor: chartColors.draw,
            backgroundColor: "transparent",
            fill: false,
            tension: 0.35,
            pointRadius: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              if (!p || p.draw === null) return 0;
              if (p.isOpen) return 7;
              if (p.isCurrent) return 5;
              return 2;
            },
            pointHoverRadius: 7,
            pointBackgroundColor: function(ctx2) {
              var idx = ctx2.dataIndex;
              var p = trend[idx];
              return p && p.isOpen ? '#fff' : chartColors.draw;
            },
            pointBorderColor: chartColors.draw,
            pointBorderWidth: 2,
            borderWidth: 1.5,
            borderDash: [6, 4],
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 16,
              font: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 12 }
            }
          },
          tooltip: {
            backgroundColor: "rgba(26,54,93,0.95)",
            padding: 14,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                var label = context.dataset.label || '';
                var val = context.parsed.y;
                if (!val) return label + ': -';
                var prob = (100 / val).toFixed(1);
                return label + ': ' + val.toFixed(2) + ' (' + prob + '%)';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            position: 'left',
            title: {
              display: true,
              text: '\u8D54\u7387 (\u5341\u8FDB\u5236)', // "赔率 (十进制)"
              font: { size: 12 }
            },
            ticks: {
              font: { size: 11 },
              callback: function(value) {
                return value.toFixed(2);
              }
            },
            grid: { color: "rgba(0,0,0,0.05)" }
          },
          yProb: {
            position: 'right',
            title: {
              display: true,
              text: '\u9690\u542B\u6982\u7387 (%)', // "隐含概率 (%)"
              font: { size: 12 }
            },
            ticks: {
              font: { size: 11 },
              callback: function(value) {
                return value + '%';
              }
            },
            grid: { display: false },
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }

  /**
   * 渲染赔率趋势图（根据当前选中的提供商和赔率类型）
   */
  function renderOddsTrend() {
    if (anaAllOddsData.length === 0) return;
    var oddsInfo = anaAllOddsData[0];
    var provider = (document.querySelector("#providerTabs .provider-tabs__btn.provider-tabs__btn--active")?.dataset.provider) || "draftkings";
    var oddsType = document.getElementById("filterOddsType")?.value || "moneyline";
    var trend = anaGenerateTrendData(oddsInfo, provider, oddsType);
    if (!trend) {
      anaDestroyChart("oddsTrend");
      var kp = document.getElementById("oddsKeyPoints");
      if (kp) kp.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;">\u8BE5\u6BD4\u8D5B\u6682\u65E0\u6B64\u7C7B\u578B\u8D54\u7387\u6570\u636E</p>'; // "该比赛暂无此类型赔率数据"
      return;
    }
    var labels = trend.map(function(p) { return p.date.slice(5); });
    var datasets = [];
    var teamLabel = oddsType === "total" ? { home: "\u5927\u7403", away: "\u5C0F\u7403" } : { home: oddsInfo.homeName, away: oddsInfo.awayName }; // "大球" / "小球"
    var chartColors = getChartColors();
    datasets.push({
      label: teamLabel.home,
      data: trend.map(function(p) { return p.home; }),
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
      data: trend.map(function(p) { return p.away; }),
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
        label: "\u5E73\u5C40", // "平局"
        data: trend.map(function(p) { return p.draw; }),
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
    var ctx = document.getElementById("oddsTrendChart");
    if (!ctx) return;
    anaChartInstances["oddsTrend"] = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: { labels: labels, datasets: datasets },
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
              font: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 12, weight: "500" },
              color: "#64748b"
            }
          },
          tooltip: {
            backgroundColor: "rgba(15,23,42,0.92)",
            titleFont: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 13, weight: "600" },
            bodyFont: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 12 },
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
              font: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 11 },
              color: "#64748b",
              maxRotation: 0,
              padding: 8
            },
            border: { display: false }
          },
          y: {
            grid: { color: "rgba(148,163,184,0.08)", drawBorder: false },
            title: {
              display: true,
              text: oddsType === "moneyline" ? "\u8D54\u7387 (\u5341\u8FDB\u5236)" : oddsType === "spread" ? "\u8BA9\u7403\u6570" : "\u8FDB\u7403\u6570", // "赔率 (十进制)" / "让球数" / "进球数"
              font: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 11, weight: "500" },
              color: "#64748b",
              padding: { top: 0, bottom: 12 }
            },
            ticks: {
              font: { family: "'Noto Sans SC', 'Microsoft YaHei', sans-serif", size: 11 },
              color: "#64748b",
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
    var p = oddsInfo.providers[provider];
    var kp = document.getElementById("oddsKeyPoints");
    if (!kp) return;
    if (!p || oddsType !== 'moneyline' || !p.moneyline) {
      kp.innerHTML = '';
      return;
    }
    var ml = p.moneyline;
    var homeDec = anaAmericanToDecimal(ml.home) || 2;
    var awayDec = anaAmericanToDecimal(ml.away) || 2;
    var drawDec = anaAmericanToDecimal(ml.draw) || 2;
    var homeProb = (100 / homeDec).toFixed(1);
    var awayProb = (100 / awayDec).toFixed(1);
    var drawProb = (100 / drawDec).toFixed(1);
    var overround = (+homeProb + +awayProb + +drawProb - 100).toFixed(1);
    var overroundLabel = '\u6B63\u5E38'; // "正常"
    var overroundClass = 'normal';
    if (+overround > 8) { overroundLabel = '\u504F\u9AD8'; overroundClass = 'high'; } // "偏高"
    if (+overround > 15) { overroundLabel = '\u5F02\u5E38'; overroundClass = 'abnormal'; } // "异常"
    function openVal(val) { return val ? anaAmericanToDecimal(val) : null; }
    var homeOpen = openVal(ml.homeOpen);
    var awayOpen = openVal(ml.awayOpen);
    var drawOpen = openVal(ml.drawOpen);
    function diffHtml(current, open) {
      if (open === null || open === undefined) return '<span class="key-point__diff">--</span>';
      var diff = (current - open);
      if (Math.abs(diff) < 0.01) return '<span class="key-point__diff key-point__diff--flat">\u2212</span>'; // "−"（减号）
      var sign = diff > 0 ? '+' : '';
      var cls = diff > 0 ? 'up' : 'down';
      var arrow = diff > 0 ? '\u2191' : '\u2193'; // "↑" / "↓"
      return '<span class="key-point__diff key-point__diff--' + cls + '">' + arrow + ' ' + sign + diff.toFixed(2) + '</span>';
    }
    kp.innerHTML =
      '<div class="key-point">' +
        '<div class="key-point__label">' + window.escapeHTML(oddsInfo.homeName) + '</div>' +
        '<div class="key-point__odds">' + homeDec.toFixed(2) + '</div>' +
        '<div class="key-point__prob">' + homeProb + '%</div>' +
        diffHtml(homeDec, homeOpen) +
      '</div>' +
      '<div class="key-point">' +
        '<div class="key-point__label">\u5E73\u5C40</div>' + // "平局"
        '<div class="key-point__odds">' + drawDec.toFixed(2) + '</div>' +
        '<div class="key-point__prob">' + drawProb + '%</div>' +
        diffHtml(drawDec, drawOpen) +
      '</div>' +
      '<div class="key-point">' +
        '<div class="key-point__label">' + window.escapeHTML(oddsInfo.awayName) + '</div>' +
        '<div class="key-point__odds">' + awayDec.toFixed(2) + '</div>' +
        '<div class="key-point__prob">' + awayProb + '%</div>' +
        diffHtml(awayDec, awayOpen) +
      '</div>' +
      '<div class="key-point key-point--overround">' +
        '<div class="key-point__label">\u5E84\u5BB6\u5229\u6DA6\u7387</div>' + // "庄家利润率"
        '<div class="key-point__odds">' + overround + '%</div>' +
        '<div class="key-point__prob key-point__prob--' + overroundClass + '">' + overroundLabel + '</div>' +
        '<div class="key-point__desc">\u6B63\u5E38\u8303\u56F4 < 8%</div>' + // "正常范围"
      '</div>';
  }

  /**
   * 生成热门预测列表（按热度排序，最多15条）
   * @returns {Array} 热门预测数组
   */
  function generateHotPredictions() {
    var predictions = [];
    var now = new Date();
    // 从 window.App.predictions 共享命名空间获取数据
    var sharedMap = (window.App && window.App.predictions && window.App.predictions.getMap) ? window.App.predictions.getMap() : null;
    var sharedMatches = (window.App && window.App.predictions && window.App.predictions.getMatches) ? window.App.predictions.getMatches() : null;
    if (!sharedMap || sharedMap.size === 0) return predictions;
    sharedMap.forEach(function(entry, matchId) {
      if (!entry || !entry.prediction) return;
      var pred = entry.prediction;
      var oddsInfo = entry.oddsInfo;
      var matchSrc = (sharedMatches && sharedMatches.length > 0 ? sharedMatches : window.WORLD_CUP_DATA ? window.WORLD_CUP_DATA.matches : []);
      var match = matchSrc.find(function(m) { return m.id === matchId; });
      if (!match) return;
      if (match.status === "finished") return;
      var heat = 50;
      if (pred.movement && pred.movement.isSharp) heat += 15;
      if (pred.movement && pred.movement.homeShift) heat += Math.min(10, Math.abs(pred.movement.homeShift));
      if (pred.confidence >= 70) heat += 10;
      if (pred.confidence >= 80) heat += 5;
      if (pred.valueBets && pred.valueBets.length > 0) heat += 10;
      if (pred.isAggregated) heat += 5;
      var localTime = window.getLocalMatchTime(match.date, match.time || "12:00", match.venue, match.timeUTC);
      var daysUntilMatch = (localTime.date - now) / (1000 * 60 * 60 * 24);
      if (daysUntilMatch <= 1) heat += 15;
      else if (daysUntilMatch <= 3) heat += 10;
      else if (daysUntilMatch <= 7) heat += 5;
      heat = Math.min(99, Math.max(30, Math.round(heat)));
      var accuracy = pred.confidence || 50;
      if (pred.isAggregated) accuracy += 5;
      if (pred.movement && pred.movement.isSharp) accuracy += 3;
      accuracy = Math.min(95, Math.max(40, Math.round(accuracy)));
      // 基于真实数据生成摘要（移除所有伪造专家内容）
      var teamName = pred.favorite === "home" ? match.homeTeam : pred.favorite === "away" ? match.awayTeam : "\u5E73\u5C40"; // "平局"
      var summaries = [];
      // 最高信心
      if (pred.confidence != null) {
        summaries.push("\u6700\u9AD8\u4FE1\u5FC3: " + teamName + " (" + pred.confidence + "%)"); // "最高信心"
      }
      // 最大价值
      if (pred.valueBets && pred.valueBets.length > 0) {
        var bestBet = pred.valueBets.reduce(function(a, b) { return a.edge > b.edge ? a : b; });
        var bestBetTeam = bestBet.type === "home" ? match.homeTeam : bestBet.type === "away" ? match.awayTeam : "\u5E73\u5C40"; // "平局"
        summaries.push("\u6700\u5927\u4EF7\u503C: " + bestBetTeam + " edge +" + bestBet.edge + "%"); // "最大价值"
      }
      // 赔率异动
      if (pred.movement && pred.movement.homeShift != null && pred.movement.homeShift !== 0) {
        var shiftTeam = pred.movement.homeShift > 0 ? match.homeTeam : match.awayTeam;
        summaries.push("\u8D54\u7387\u5F02\u52A8: " + shiftTeam + " \u8D54\u7387\u53D8\u52A8" + Math.abs(pred.movement.homeShift).toFixed(1) + "%"); // "赔率异动" / "赔率变动"
      }
      var expertView = summaries.length > 0 ? summaries.join("\uFF1B") : "\u6682\u65E0\u70ED\u95E8\u9884\u6D4B"; // "；" / "暂无热门预测"
      var stageName = window.getStageName(match.stage) + (match.group ? " \u00B7 " + match.group + "\u7EC4" : ""); // "· x组"
      predictions.push({
        home: match.homeTeam,
        away: match.awayTeam,
        date: match.date,
        stage: stageName,
        homeWin: pred.homeWin,
        draw: pred.draw,
        awayWin: pred.awayWin,
        accuracy: accuracy,
        heat: heat,
        expertView: expertView,
        confidence: pred.confidence,
        overround: pred.overround,
        movement: pred.movement,
        valueBets: pred.valueBets,
        providerCount: pred.providerCount,
        isAggregated: pred.isAggregated
      });
    });
    predictions.sort(function(a, b) { return b.heat - a.heat; });
    return predictions.slice(0, 15);
  }
  var hotPredictions = generateHotPredictions;

  /**
   * 导出分析数据为 JSON 文件
   */
  function anaExportData() {
    var data = {
      exportTime: (new Date()).toISOString(),
      oddsData: anaAllOddsData,
      predictions: hotPredictions()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = 'worldcup-analysis-' + (new Date()).toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 设置分析页面的事件监听器 */
  function setupAnalysisEventListeners() {
    if (anaEventListenersSetup) return;
    anaEventListenersSetup = true;
    var providerTabs = document.getElementById("providerTabs");
    if (providerTabs) {
      providerTabs.addEventListener("click", function(e) {
        if (!e.target.classList.contains("provider-tabs__btn")) return;
        providerTabs.querySelectorAll(".provider-tabs__btn").forEach(function(b) {
          b.classList.remove("provider-tabs__btn--active");
          b.setAttribute("aria-selected", "false");
        });
        e.target.classList.add("provider-tabs__btn--active");
        e.target.setAttribute("aria-selected", "true");
        renderOddsTrend();
      });
    }
    var filterOddsType = document.getElementById("filterOddsType");
    if (filterOddsType) {
      filterOddsType.addEventListener("change", function() {
        renderOddsTrend();
      });
    }
    var btnExport = document.getElementById("btnExport");
    if (btnExport) btnExport.addEventListener("click", anaExportData);
    var btnRefreshAnalysis = document.getElementById("btnRefreshAnalysis");
    if (btnRefreshAnalysis) {
      btnRefreshAnalysis.addEventListener("click", function() {
        var select = document.getElementById("oddsMatchSelect");
        var matchId = select ? select.value : "";
        if (!matchId) return;
        btnRefreshAnalysis.classList.add("btn-refresh--spinning");
        loadAndRenderAnalysisMatch(matchId).then(function() {
          btnRefreshAnalysis.classList.remove("btn-refresh--spinning");
        }).catch(function() {
          btnRefreshAnalysis.classList.remove("btn-refresh--spinning");
        });
      });
    }
  }

  /** 初始化分析区域 */
  function initAnalysisSection() {
    initOddsModule();
  }

  /* ================================================================
   * 导出到 window
   * ================================================================ */
  window.generateRecommendationTemplate = generateRecommendationTemplate;
  window.aggregateOdds = aggregateOdds;
  window.removeOverround = removeOverround;
  window.analyzeOddsMovement = analyzeOddsMovement;
  window.crossMarketAdjust = crossMarketAdjust;
  window.calibrateConfidence = calibrateConfidence;
  window.detectValueBet = detectValueBet;
  window.derivePredictionFromOdds = derivePredictionFromOdds;
  window.anaDestroyChart = anaDestroyChart;
  window.anaFetchScoreboardWithOdds = anaFetchScoreboardWithOdds;
  window.anaBuildDateRangeStr = anaBuildDateRangeStr;
  window.saveOddsSnapshot = saveOddsSnapshot;
  window.loadOddsHistory = loadOddsHistory;
  window.anaGenerateTrendData = anaGenerateTrendData;
  window.anaAmericanToDecimal = anaAmericanToDecimal;
  window.initOddsModule = initOddsModule;
  window.loadAndRenderAnalysisMatch = loadAndRenderAnalysisMatch;
  window.anaDrawQuickTrend = anaDrawQuickTrend;
  window.renderOddsTrend = renderOddsTrend;
  window.anaRenderKeyPoints = anaRenderKeyPoints;
  window.generateHotPredictions = generateHotPredictions;
  window.anaExportData = anaExportData;
  window.setupAnalysisEventListeners = setupAnalysisEventListeners;
  window.initAnalysisSection = initAnalysisSection;
  window.anaChartInstances = anaChartInstances;
  window.App.odds.generateRecommendationTemplate = generateRecommendationTemplate;
  window.App.odds.aggregateOdds = aggregateOdds;
  window.App.odds.removeOverround = removeOverround;
  window.App.odds.analyzeOddsMovement = analyzeOddsMovement;
  window.App.odds.crossMarketAdjust = crossMarketAdjust;
  window.App.odds.calibrateConfidence = calibrateConfidence;
  window.App.odds.detectValueBet = detectValueBet;
  window.App.odds.derivePredictionFromOdds = derivePredictionFromOdds;
  window.App.odds.anaDestroyChart = anaDestroyChart;
  window.App.odds.anaFetchScoreboardWithOdds = anaFetchScoreboardWithOdds;
  window.App.odds.anaBuildDateRangeStr = anaBuildDateRangeStr;
  window.App.odds.saveOddsSnapshot = saveOddsSnapshot;
  window.App.odds.loadOddsHistory = loadOddsHistory;
  window.App.odds.anaGenerateTrendData = anaGenerateTrendData;
  window.App.odds.anaAmericanToDecimal = anaAmericanToDecimal;
  window.App.odds.initOddsModule = initOddsModule;
  window.App.odds.loadAndRenderAnalysisMatch = loadAndRenderAnalysisMatch;
  window.App.odds.anaDrawQuickTrend = anaDrawQuickTrend;
  window.App.odds.renderOddsTrend = renderOddsTrend;
  window.App.odds.anaRenderKeyPoints = anaRenderKeyPoints;
  window.App.odds.generateHotPredictions = generateHotPredictions;
  window.App.odds.anaExportData = anaExportData;
  window.App.odds.setupAnalysisEventListeners = setupAnalysisEventListeners;
  window.App.odds.initAnalysisSection = initAnalysisSection;
  window.App.odds.anaChartInstances = anaChartInstances;
})();