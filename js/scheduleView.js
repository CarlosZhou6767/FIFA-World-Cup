/**
 * @fileoverview 赛程和积分榜视图模块
 * @description 赛程列表、比赛卡片、筛选器、积分榜渲染
 */
(function() {
  window.App = window.App || {};
  window.App.schedule = window.App.schedule || {};
  var _lastScheduleKey = "";
  var _hasRenderedSchedule = false;
  var _hasRenderedStandings = false;
  // 当前已渲染比赛的 Map 索引（id → match），事件委托时 O(1) 查找
  // 包含 ESPN 额外返回的比赛（id=10000+），弥补 MATCH_INDEX_BY_ID 仅含本地比赛的不足
  var _renderedMatchesById = new Map();
  /**
   * 验证 ESPN 事件是否匹配指定比赛双方队伍（可选时间校验）
   * @param {Object} event - ESPN 事件对象
   * @param {string} homeTeam - 主队 ID
   * @param {string} awayTeam - 客队 ID
   * @param {Object} teamMap - 队伍映射表
   * @param {Object} [match] - 本地比赛对象，传入时启用时间校验（±4 小时容差）
   * @returns {Object|null} 匹配成功返回事件对象，否则返回 null
   */
  function verifyMatchTeams(event, homeTeam, awayTeam, teamMap, match) {
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
    if (!isMatch) return null;
    // 时间二次校验：本地比赛时间转 UTC，与 ESPN 事件 UTC 比对（±4 小时容差）
    if (match && window.getLocalMatchTime) {
      try {
        const lt = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
        const expectedUtcMs = lt.date.getTime() - 8 * 3600 * 1000;
        const evMs = new Date(event.date).getTime();
        const diff = Math.abs(evMs - expectedUtcMs);
        if (diff > 4 * 3600 * 1000) return null;
      } catch (e) { /* 时间校验失败时仅按球队匹配 */ }
    }
    return event;
  }
  /**
   * 渲染赛程视图（按日期分组，内容去重，首次渲染播放入场动画）
   * @param {Array|null} [filteredMatches=null] - 预筛选的比赛数组，null 则从 API 获取
   * @param {boolean} [forceRefresh=false] - 是否强制刷新 API
   * @returns {Promise<void>}
   */
  async function renderSchedule(filteredMatches = null, forceRefresh = false) {
    const container = document.getElementById("scheduleContainer");
    if (!container) return;
    // 首次加载：先用本地数据立即渲染，避免空白等待 API 响应
    if (!filteredMatches && !_hasRenderedSchedule && window.WORLD_CUP_DATA && window.WORLD_CUP_DATA.matches) {
      const localMatches = window.WORLD_CUP_DATA.matches.filter(m => m.date);
      if (localMatches.length > 0) {
        _renderScheduleInternal(container, localMatches);
      }
    }
    const rawMatches = filteredMatches || await window.fetchScheduleFromESPNCached(forceRefresh);
    // 显示所有赛程（包括淘汰赛占位比赛），仅过滤掉无日期的无效数据
    const matches = rawMatches.filter(m => m.date);
    // 内容去重：比较比赛 ID+对阵队伍+比分+状态+分钟数，相同则跳过重渲染
    // 注意：必须包含 homeTeam/awayTeam，否则淘汰赛 TBD→真实队伍的更新会被跳过
    const key = matches.map((m) => `${m.id}|${m.homeTeam ?? ""}|${m.awayTeam ?? ""}|${m.homeScore ?? ""}|${m.awayScore ?? ""}|${m.status}|${m.minute ?? ""}`).join(",");
    if (key === _lastScheduleKey && container.children.length > 0) return;
    _lastScheduleKey = key;
    _renderScheduleInternal(container, matches);
  }

  /**
   * 实际渲染逻辑（内部函数）：分组、排序、构建 DOM、事件委托
   * @param {HTMLElement} container - 容器元素
   * @param {Array} matches - 比赛数组
   */
  function _renderScheduleInternal(container, matches) {
    // 首次渲染播放入场动画；后续渲染跳过入场动画避免频闪
    if (_hasRenderedSchedule) {
      container.classList.add("skip-enter-animation");
    } else {
      container.classList.remove("skip-enter-animation");
      _hasRenderedSchedule = true;
    }
    // 按组/阶段分组
    const groupedByStage = {};
    matches.forEach(function(m) {
      var key;
      if (m.stage === "group" && m.group) {
        key = m.group;
      } else {
        key = m.stage;
      }
      if (!groupedByStage[key]) groupedByStage[key] = [];
      groupedByStage[key].push(m);
    });
    // 排序key：A-L组在前，然后round16/quarter/semi/third/final
    var groupOrder = ["A","B","C","D","E","F","G","H","I","J","K","L","round16","quarter","semi","third","final"];
    var sortedKeys = Object.keys(groupedByStage).sort(function(a, b) {
      return groupOrder.indexOf(a) - groupOrder.indexOf(b);
    });
    // 构建筛选栏
    var filtersHtml = '<div class="schedule-filters">';
    filtersHtml += '<div class="schedule-filters__stages">';
    filtersHtml += '<button class="schedule-filters__btn schedule-filters__btn--active" data-filter="all">全部</button>';
    filtersHtml += '<button class="schedule-filters__btn" data-filter="group">小组赛</button>';
    filtersHtml += '<button class="schedule-filters__btn" data-filter="knockout">淘汰赛</button>';
    filtersHtml += '</div>';
    // 组字母跳转
    var groupLetters = sortedKeys.filter(function(k) { return k.length === 1 && k >= "A" && k <= "L"; });
    if (groupLetters.length > 0) {
      filtersHtml += '<div class="schedule-filters__groups">';
      groupLetters.forEach(function(g) {
        filtersHtml += '<button class="schedule-filters__group-btn" data-group="' + g + '">' + g + '</button>';
      });
      filtersHtml += '</div>';
    }
    filtersHtml += '</div>';
    // 构建卡片区域：按组/阶段分区，每区双列网格
    var fragment = document.createDocumentFragment();
    var filtersWrapper = document.createElement("div");
    filtersWrapper.innerHTML = filtersHtml;
    fragment.appendChild(filtersWrapper.firstChild);
    sortedKeys.forEach(function(key) {
      var sectionMatches = groupedByStage[key];
      var section = createScheduleSection(key, sectionMatches);
      fragment.appendChild(section);
    });
    container.className = "schedule-grid-view";
    container.replaceChildren(fragment);
    // 绑定筛选事件
    setupHybridFilters(container);
    // 构建当前已渲染比赛的 Map 索引，供事件委托 O(1) 查找
    _renderedMatchesById = new Map(matches.map(function(m) { return [m.id, m]; }));
    setupScheduleDelegation();
    updateMatchCount(matches.length);
  }
  /**
   * 按北京时间日期分组比赛，每组内按时间排序
   * @param {Array} matches - 比赛数组
   * @returns {Object} 日期字符串到比赛数组的映射
   */
  function groupMatchesByDate(matches) {
    const grouped = {};
    // 单次遍历：预计算本地时间并直接分组，避免二次 filter
    const enrichedByDate = {};
    matches.forEach((match) => {
      const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
      const beijingDateStr = localTime.date.toISOString().slice(0, 10);
      const timeStr = localTime.date.toISOString().slice(11, 16);
      if (!grouped[beijingDateStr]) {
        grouped[beijingDateStr] = [];
        enrichedByDate[beijingDateStr] = [];
      }
      grouped[beijingDateStr].push(match);
      enrichedByDate[beijingDateStr].push({ match, timeStr });
    });
    // 每组内按时间排序
    Object.keys(grouped).forEach((date) => {
      const items = enrichedByDate[date];
      items.sort((a, b) => a.timeStr.localeCompare(b.timeStr));
      grouped[date] = items.map((e) => e.match);
    });
    return grouped;
  }
  /**
   * 创建赛程分区（按组或阶段）的 DOM 元素
   * @param {string} key - 组字母或阶段名
   * @param {Array} matches - 该分区下的比赛数组
   * @returns {HTMLElement} 分区 DOM 元素
   */
  function createScheduleSection(key, matches) {
    var section = document.createElement("div");
    section.className = "schedule-section__group";
    section.dataset.stage = (key.length === 1) ? "group" : key;
    if (key.length === 1) section.dataset.group = key;
    // 区标题
    var title = document.createElement("div");
    title.className = "schedule-section__title";
    title.id = "schedule-group-" + key;
    var label;
    if (key.length === 1) {
      label = key + "组";
    } else {
      label = window.getStageName ? window.getStageName(key) : key;
    }
    title.textContent = label;
    section.appendChild(title);
    // 双列网格容器
    var grid = document.createElement("div");
    grid.className = "schedule-section__grid";
    matches.forEach(function(match) {
      var card = createMatchCard(match);
      grid.appendChild(card);
    });
    section.appendChild(grid);
    return section;
  }
  /**
   * 绑定混合式筛选栏的交互事件
   * @param {HTMLElement} container - 赛程容器
   */
  function setupHybridFilters(container) {
    var stageBtns = container.querySelectorAll(".schedule-filters__btn");
    var groupBtns = container.querySelectorAll(".schedule-filters__group-btn");
    var sections = container.querySelectorAll(".schedule-section__group");
    stageBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        stageBtns.forEach(function(b) { b.classList.remove("schedule-filters__btn--active"); });
        btn.classList.add("schedule-filters__btn--active");
        // 清除组选中
        groupBtns.forEach(function(b) { b.classList.remove("schedule-filters__group-btn--active"); });
        var filter = btn.dataset.filter;
        sections.forEach(function(sec) {
          if (filter === "all") {
            sec.style.display = "";
          } else if (filter === "group") {
            sec.style.display = sec.dataset.stage === "group" ? "" : "none";
          } else if (filter === "knockout") {
            sec.style.display = sec.dataset.stage !== "group" ? "" : "none";
          }
        });
      });
    });
    groupBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        // 取消阶段筛选高亮，切到"小组赛"
        stageBtns.forEach(function(b) { b.classList.remove("schedule-filters__btn--active"); });
        var groupStageBtn = container.querySelector('[data-filter="group"]');
        if (groupStageBtn) groupStageBtn.classList.add("schedule-filters__btn--active");
        // 高亮当前组
        groupBtns.forEach(function(b) { b.classList.remove("schedule-filters__group-btn--active"); });
        btn.classList.add("schedule-filters__group-btn--active");
        var targetGroup = btn.dataset.group;
        sections.forEach(function(sec) {
          if (sec.dataset.stage === "group") {
            sec.style.display = sec.dataset.group === targetGroup ? "" : "none";
          } else {
            sec.style.display = "none";
          }
        });
        // 滚动到目标组
        var target = document.getElementById("schedule-group-" + targetGroup);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  /**
   * 创建单个比赛卡片的 DOM 元素
   * @param {Object} match - 比赛对象
   * @returns {HTMLElement} 比赛卡片 DOM 元素
   */
  function createMatchCard(match) {
    const card = document.createElement("div");
    const stageTypeClass = match.stage === "group" ? "match-card--group" : `match-card--${match.stage}`;
    const isLive = match.status === "live" || match.status === "halftime";
    card.className = `match-card ${stageTypeClass} ${isLive ? "match-card--live" : ""}`;
    card.dataset.matchId = match.id;
    const homeTeam = window.getTeamById(match.homeTeam, match._homeName);
    const awayTeam = window.getTeamById(match.awayTeam, match._awayName);
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${homeTeam.name} vs ${awayTeam.name}`);
    const venue = window.getVenueById(match.venue);
    const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
    const hasScore = match.status === "finished" || match.status === "live" || match.status === "halftime";
    const statusText = (match.status === "live" && match.minute) ? `${window.getDetailedStatus(match)} ${match.minute}` : window.getDetailedStatus(match);
    const homeIsPlaceholder = homeTeam.isPlaceholder;
    const awayIsPlaceholder = awayTeam.isPlaceholder;

    // 阶段标签
    const stageLabel = window.getStageName(match.stage);
    const stageBadgeLabel = match.group ? `${stageLabel} - ${match.group}组` : stageLabel;
    const stageBadgeClass = `match-card__stage-badge--${match.stage === "group" ? "group" : match.stage}`;

    // 状态标签
    const statusClass = match.status === "finished" ? "match-card__status-tag--finished" : (isLive ? "match-card__status-tag--live" : "match-card__status-tag--scheduled");
    const statusLabel = match.status === "scheduled" ? "未开始" : statusText;
    const liveDot = isLive ? '<span class="live-dot-header"></span>' : "";

    // 时间
    const timeFormatted = window.formatTime(localTime.date);
    const timezoneLabel = localTime.timezone;

    // 队伍HTML
    const homeFlagClass = homeIsPlaceholder ? "match-card__team-flag-wrap--placeholder" : "";
    const awayFlagClass = awayIsPlaceholder ? "match-card__team-flag-wrap--placeholder" : "";
    const homeFlagHtml = homeIsPlaceholder ? "?" : window.buildFlagHtml(homeTeam.flag, homeTeam.name);
    const awayFlagHtml = awayIsPlaceholder ? "?" : window.buildFlagHtml(awayTeam.flag, awayTeam.name);
    const homeNameClass = homeIsPlaceholder ? "match-card__team-name--placeholder" : "";
    const awayNameClass = awayIsPlaceholder ? "match-card__team-name--placeholder" : "";
    const homeRank = homeTeam.rank || "?";
    const awayRank = awayTeam.rank || "?";

    // VS/比分区域
    let vsAreaHtml;
    if (hasScore) {
      const homeScore = window.escapeHTML(match.homeScore);
      const awayScore = window.escapeHTML(match.awayScore);
      vsAreaHtml = `
        <div class="match-card__vs-area">
          ${isLive ? `<div class="match-card__status-above-score">${window.escapeHTML(statusText)}</div>` : ""}
          <div class="match-card__score-display">${homeScore} - ${awayScore}</div>
        </div>`;
    } else {
      vsAreaHtml = `
        <div class="match-card__vs-area">
          <div class="match-card__vs-text">VS</div>
        </div>`;
    }

    card.innerHTML = `
      <div class="match-card__header">
        <span class="match-card__stage-badge ${stageBadgeClass}">${window.escapeHTML(stageBadgeLabel)}</span>
        <span class="match-card__status-tag ${statusClass}">${liveDot}${window.escapeHTML(statusLabel)}</span>
      </div>
      <div class="match-card__time-row">
        <svg class="match-card__time-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span class="match-card__time-text">${timeFormatted}</span>
        <span class="match-card__time-timezone">${window.escapeHTML(timezoneLabel)}</span>
      </div>
      <div class="match-card__matchup">
        <div class="match-card__team-block">
          <div class="match-card__team-flag-wrap ${homeFlagClass}">${homeFlagHtml}</div>
          <div class="match-card__team-name ${homeNameClass}">${window.escapeHTML(homeTeam.name)}</div>
          ${homeIsPlaceholder ? "" : `<div class="match-card__team-rank">FIFA #${homeRank}</div>`}
        </div>
        ${vsAreaHtml}
        <div class="match-card__team-block match-card__team-block--away">
          <div class="match-card__team-flag-wrap ${awayFlagClass}">${awayFlagHtml}</div>
          <div class="match-card__team-name ${awayNameClass}">${window.escapeHTML(awayTeam.name)}</div>
          ${awayIsPlaceholder ? "" : `<div class="match-card__team-rank">FIFA #${awayRank}</div>`}
        </div>
      </div>
      <div class="match-card__footer">
        <div class="match-card__venue-info">
          <svg class="match-card__venue-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="match-card__venue-name">${window.escapeHTML(venue.country)}</span>
        </div>
        ${match.group ? `<span class="match-card__group-label">${window.escapeHTML(match.group)}组</span>` : ""}
      </div>
    `;
    return card;
  }
  /**
   * 设置赛程容器的事件委托（click + keydown），避免逐卡片绑定监听器
   * 在首次渲染时调用一次，后续 replaceChildren 不影响委托
   */
  function setupScheduleDelegation() {
    const container = document.getElementById("scheduleContainer");
    if (!container || container._delegated) return;
    container._delegated = true;
    // O(1) 查找：优先从当前已渲染比赛缓存查找（包含 ESPN 额外比赛），再回退到本地索引
    function findMatch(matchId) {
      var id = Number(matchId);
      if (_renderedMatchesById.has(id)) return _renderedMatchesById.get(id);
      if (window.MATCH_INDEX_BY_ID) return window.MATCH_INDEX_BY_ID.get(id) || null;
      if (window.WORLD_CUP_DATA && window.WORLD_CUP_DATA.matches) {
        return window.WORLD_CUP_DATA.matches.find((m) => m.id === id) || null;
      }
      return null;
    }
    container.addEventListener("click", (e) => {
      const card = e.target.closest(".match-card[data-match-id]");
      if (!card) return;
      const match = findMatch(card.dataset.matchId);
      if (match && window.showMatchDetails) window.showMatchDetails(match);
    });
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".match-card[data-match-id]");
      if (!card) return;
      e.preventDefault();
      const match = findMatch(card.dataset.matchId);
      if (match && window.showMatchDetails) window.showMatchDetails(match);
    });
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
    // 缺少关键 DOM 元素时直接退出，避免后续 addEventListener 崩溃
    if (!stageFilter || !groupFilter || !dateFilter || !searchInput) return;
    const applyFilters = async () => {
      const allMatches = await window.fetchScheduleFromESPNCached();
      let filtered = [...allMatches];
      if (stageFilter.value !== "all") {
        filtered = filtered.filter((match) => match.stage === stageFilter.value);
      }
      if (groupFilter.value !== "all") {
        filtered = filtered.filter((match) => match.group === groupFilter.value);
      }
      if (dateFilter.value) {
        filtered = filtered.filter((match) => {
          const localTime = window.getLocalMatchTime(match.date, match.time, match.venue, match.timeUTC);
          const beijingDateStr = localTime.date.toISOString().slice(0, 10);
          return beijingDateStr === dateFilter.value;
        });
      }
      if (searchInput.value.trim()) {
        const searchTerm = searchInput.value.trim().toLowerCase();
        filtered = filtered.filter((match) => {
          const homeTeam = window.getTeamById(match.homeTeam, match._homeName);
          const awayTeam = window.getTeamById(match.awayTeam, match._awayName);
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
    countEl.textContent = `共 ${count} 场比赛`;
  }
  /**
   * 渲染积分榜视图（仅手动刷新，无自动刷新）
   * @param {boolean} [forceRefresh=false] - 是否强制刷新
   * @returns {Promise<void>}
   */
  async function renderStandings(forceRefresh = false) {
    const container = document.getElementById("standingsContainer");
    if (!container) return;
    const espnMatches = await window.fetchScheduleFromESPNCached(forceRefresh);
    const standings = window.calculateStandings(espnMatches);
    // 首次渲染播放入场动画；后续渲染跳过入场动画避免频闪
    if (_hasRenderedStandings) {
      container.classList.add("skip-enter-animation");
    } else {
      container.classList.remove("skip-enter-animation");
      _hasRenderedStandings = true;
    }
    // 计算各小组第3名排名，确定哪些第3名晋级
    var thirdPlaceTeams = [];
    Object.keys(standings).sort().forEach(function(g) {
      var st = standings[g];
      if (st && st.length >= 3) {
        var t3 = st[2];
        thirdPlaceTeams.push({ group: g, team: t3.team, pts: t3.points, gd: t3.goalsFor - t3.goalsAgainst, gf: t3.goalsFor });
      }
    });
    // 按积分→净胜球→进球数排序，取前8（48队赛制：12组前2=24 + 最佳第3名前8=32）
    thirdPlaceTeams.sort(function(a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
    var qualifiedThirds = {};
    thirdPlaceTeams.slice(0, 8).forEach(function(t) { qualifiedThirds[t.group] = true; });

    const fragment = document.createDocumentFragment();
    Object.keys(standings).sort().forEach((group) => {
      const isThirdQualified = !!qualifiedThirds[group];
      const groupTable = createStandingsTable(group, standings[group], isThirdQualified);
      fragment.appendChild(groupTable);
    });
    container.replaceChildren(fragment);
  }
  /**
   * 创建小组积分榜表格 DOM 元素
   * @param {string} group - 组别名称
   * @param {Array} teamStandings - 队伍积分数据数组
   * @param {boolean} isThirdQualified - 该组第3名是否晋级
   * @returns {HTMLElement} 积分榜表格 DOM 元素
   */
  function createStandingsTable(group, teamStandings, isThirdQualified) {
    const table = document.createElement("div");
    table.className = "group-table";
    const header = document.createElement("div");
    header.className = "group-table__header";
    header.textContent = `${group}组`;
    table.appendChild(header);
    const tableEl = document.createElement("table");
    tableEl.className = "group-table__table";
    // 前2名直接晋级，第3名根据跨组比较结果
    const rows = teamStandings.map((item, idx) => {
      let rowClass = "";
      let badge = "";
      if (idx === 0 || idx === 1) {
        rowClass = "group-table__row--advance";
        badge = '<span class="group-table__badge group-table__badge--advance">晋级</span>';
      } else if (idx === 2 && isThirdQualified) {
        rowClass = "group-table__row--possible";
        badge = '<span class="group-table__badge group-table__badge--possible">晋级</span>';
      }
      const gd = item.goalsFor - item.goalsAgainst;
      const gdSign = gd > 0 ? "+" : "";
      return `
                <tr class="${rowClass}">
                    <td>
                        <div class="group-table__team-cell">
                            <span>${window.buildFlagHtml(item.team.flag, item.team.name)}</span>
                            <span>${window.escapeHTML(item.team.name)}</span>
                        </div>
                    </td>
                    <td>${item.played}</td>
                    <td>${item.won}</td>
                    <td>${item.drawn}</td>
                    <td>${item.lost}</td>
                    <td>${item.goalsFor}</td>
                    <td>${item.goalsAgainst}</td>
                    <td>${gdSign}${gd}</td>
                    <td>${item.points}</td>
                    <td>${badge}</td>
                </tr>`;
    }).join("");
    tableEl.innerHTML = `
        <thead>
            <tr>
                <th>队伍</th>
                <th>场</th>
                <th>胜</th>
                <th>平</th>
                <th>负</th>
                <th>进</th>
                <th>失</th>
                <th>净</th>
                <th>分</th>
                <th>状态</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    `;
    table.appendChild(tableEl);
    return table;
  }

  // 导出
  window.verifyMatchTeams = verifyMatchTeams;
  window.renderSchedule = renderSchedule;
  window.groupMatchesByDate = groupMatchesByDate;
  window.createScheduleSection = createScheduleSection;
  window.createDateGroup = createScheduleSection;
  window.createMatchCard = createMatchCard;
  window.setupFilters = setupFilters;
  window.setupScheduleDelegation = setupScheduleDelegation;
  window.updateMatchCount = updateMatchCount;
  window.renderStandings = renderStandings;
  window.createStandingsTable = createStandingsTable;

  window.App.schedule.verifyMatchTeams = verifyMatchTeams;
  window.App.schedule.renderSchedule = renderSchedule;
  window.App.schedule.groupMatchesByDate = groupMatchesByDate;
  window.App.schedule.createScheduleSection = createScheduleSection;
  window.App.schedule.createDateGroup = createScheduleSection;
  window.App.schedule.createMatchCard = createMatchCard;
  window.App.schedule.setupFilters = setupFilters;
  window.App.schedule.setupScheduleDelegation = setupScheduleDelegation;
  window.App.schedule.updateMatchCount = updateMatchCount;
  window.App.schedule.renderStandings = renderStandings;
  window.App.schedule.createStandingsTable = createStandingsTable;
})();
