/**
 * @fileoverview 应用初始化主模块
 * @description 视图切换、自动刷新、事件绑定、DOM 初始化
 */
(function() {
  window.App = window.App || {};
  window.App.main = window.App.main || {};
  var _refreshHandlers = {};
  var _refreshTimers = {};
  var _currentRefreshView = null;
  // 缓存 DOM 引用：避免每次 switchView/updateAutoRefreshCountdown 都 getElementById
  var _domCache = {};
  function _getEl(id) {
    if (!_domCache[id]) _domCache[id] = document.getElementById(id);
    return _domCache[id];
  }
  var _navLinks = null;
  function _getNavLinks() {
    if (!_navLinks) _navLinks = document.querySelectorAll(".nav__link");
    return _navLinks;
  }
  var AUTO_REFRESH_INTERVAL = window.CONFIG ? window.CONFIG.AUTO_REFRESH_INTERVAL : 60000;
  var COUNTDOWN_INTERVAL = 1000;

  var autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
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

  /**
   * 注册视图的刷新处理函数
   * @param {string} viewName - 视图名称
   * @param {Function} handler - 刷新回调函数
   */
  function setRefreshHandler(viewName, handler) {
    _refreshHandlers[viewName] = handler;
  }

  /**
   * 启动指定视图的自动刷新倒计时
   * @param {string} viewName - 视图名称
   */
  function startAutoRefresh(viewName) {
    stopAutoRefresh();
    if (!AUTO_REFRESH_CONFIG[viewName]) return;
    _currentRefreshView = viewName;
    autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
    updateAutoRefreshCountdown();
    _refreshTimers.countdown = setInterval(function() {
      autoRefreshRemaining -= 1;
      if (autoRefreshRemaining <= 0) {
        autoRefreshRemaining = 0;
        updateAutoRefreshCountdown();
        performAutoRefresh();
        autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
      } else {
        updateAutoRefreshCountdown();
      }
    }, COUNTDOWN_INTERVAL);
  }

  /** 停止当前自动刷新倒计时 */
  function stopAutoRefresh() {
    if (_refreshTimers.countdown) {
      clearInterval(_refreshTimers.countdown);
      _refreshTimers.countdown = null;
    }
    _currentRefreshView = null;
  }

  /** 更新倒计时显示文本 */
  function updateAutoRefreshCountdown() {
    var cfg = AUTO_REFRESH_CONFIG[_currentRefreshView];
    if (!cfg) return;
    var el = _getEl(cfg.countdownEl);
    if (el) el.textContent = Math.max(0, autoRefreshRemaining) + "s";
  }

  /**
   * 设置刷新指示器的视觉状态
   * @param {boolean} refreshing - 是否正在刷新
   */
  function setAutoRefreshIndicatorState(refreshing) {
    var cfg = AUTO_REFRESH_CONFIG[_currentRefreshView];
    if (!cfg) return;
    var btn = _getEl(cfg.buttonId);
    var countdown = _getEl(cfg.countdownEl);
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
    var view = _currentRefreshView;
    if (!view) return;
    var handler = _refreshHandlers[view];
    if (handler) {
      handler();
    }
  }

  /** 重置自动刷新倒计时为初始值 */
  function resetAutoRefreshTimer() {
    if (_currentRefreshView) {
      autoRefreshRemaining = AUTO_REFRESH_INTERVAL / 1e3;
      updateAutoRefreshCountdown();
    }
  }

  /**
   * 切换视图（隐藏其他视图，激活目标视图，触发对应初始化逻辑）
   * @param {string} viewName - 视图名称（schedule/standings/predictions/analysis）
   */
  function switchView(viewName) {
    ["schedule", "standings", "predictions", "analysis", "knockout"].forEach(function(id) {
      var el = _getEl(id);
      if (el) el.classList.add("hidden");
    });
    var filtersSection = _getEl("view-schedule-filters");
    if (filtersSection) filtersSection.classList.add("hidden");
    var viewElement = _getEl(viewName);
    if (viewElement) viewElement.classList.remove("hidden");
    if (viewName === "schedule" && filtersSection) {
      filtersSection.classList.remove("hidden");
    }
    _getNavLinks().forEach(function(link) {
      link.classList.remove("nav__link--active");
      if (link.getAttribute("href") === "#" + viewName) {
        link.classList.add("nav__link--active");
      }
    });
    if (viewName === "predictions") {
      window.loadAndBuildPredictions().catch(function(e) {
        console.error("[switchView] 加载预测失败:", e.message || e);
      });
      window.setupPredFilters();
    } else if (viewName === "standings") {
      if (typeof window.renderStandings === "function") {
        window.renderStandings(true).catch(function(e) {
          console.error("[switchView] 渲染积分榜失败:", e.message || e);
        });
      }
    } else if (viewName === "schedule") {
      if (typeof window.renderSchedule === "function") {
        window.renderSchedule().catch(function(e) {
          console.error("[switchView] 渲染赛程失败:", e.message || e);
        });
      }
    } else if (viewName === "analysis") {
      window.setupAnalysisEventListeners();
      window.initAnalysisSection();
    } else if (viewName === "knockout") {
      if (typeof window.renderKnockout === "function") {
        window.renderKnockout(true).catch(function(e) {
          console.error("[switchView] 渲染对阵图失败:", e.message || e);
        });
      }
      if (window.App.knockout && typeof window.App.knockout.setupEvents === "function") {
        window.App.knockout.setupEvents();
      }
    }
    if (viewName === "standings" || viewName === "analysis" || viewName === "knockout") return;
    window.startAutoRefresh(viewName);
  }

  /**
   * 执行赛程自动刷新
   * @returns {Promise<void>}
   */
  async function runScheduleAutoRefresh() {
    setAutoRefreshIndicatorState(true);
    try {
      await window.renderSchedule(null, true);
      if (typeof window.updateMatchCount === "function") {
        window.updateMatchCount();
      }
      // 同步刷新积分榜数据，确保两个视图数据一致
      await window.renderStandings(true);
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
    var btn = document.getElementById("btnRefreshAna");
    var prevDisabled = btn ? btn.disabled : false;
    if (btn) {
      btn.classList.add("btn-refresh--spinning");
      btn.disabled = true;
    }
    try {
      window.espnCache.invalidate();
      window.matchOddsCache.invalidate();
      if (typeof window.anaFetchScoreboardWithOdds === "function") {
        await window.anaFetchScoreboardWithOdds();
      }
      if (typeof window.initAnalysisSection === "function") {
        window.initAnalysisSection();
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
    var scheduleBtn = document.getElementById("btnRefreshSchedule");
    if (scheduleBtn) {
      scheduleBtn.addEventListener("click", function() {
        scheduleBtn.classList.add("btn-refresh--spinning");
        runScheduleAutoRefresh().catch(function(e) {
          console.error("[refresh] 刷新赛程失败:", e.message || e);
        });
        setTimeout(function() {
          scheduleBtn.classList.remove("btn-refresh--spinning");
        }, 800);
        resetAutoRefreshTimer();
      });
    }
    var standingsBtn = document.getElementById("btnRefreshStandings");
    if (standingsBtn) {
      standingsBtn.addEventListener("click", async function() {
        standingsBtn.classList.add("btn-refresh--spinning");
        await window.renderStandings(true);
        standingsBtn.classList.remove("btn-refresh--spinning");
      });
    }
    var anaBtn = document.getElementById("btnRefreshAna");
    if (anaBtn) {
      anaBtn.addEventListener("click", async function() {
        anaBtn.classList.add("btn-refresh--spinning");
        await runAnalysisAutoRefresh();
        anaBtn.classList.remove("btn-refresh--spinning");
      });
    }
  }

  /** 设置移动端汉堡菜单的展开/收起切换 */
  function setupMobileMenu() {
    var mobileBtn = document.getElementById("mobileMenuBtn");
    var mobileNav = document.getElementById("mainNav");
    if (!mobileBtn || !mobileNav) return; // 缺少元素时直接退出
    mobileBtn.addEventListener("click", function() {
      mobileBtn.classList.toggle("header__mobile-btn--active");
      mobileNav.classList.toggle("nav--active");
      var expanded = mobileBtn.classList.contains("header__mobile-btn--active");
      mobileBtn.setAttribute("aria-expanded", expanded);
    });
  }

  document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("click", function(e) {
      var navLink = e.target.closest(".nav__link[data-view]");
      if (navLink) {
        e.preventDefault();
        var viewName = navLink.getAttribute("data-view");
        if (viewName) {
          switchView(viewName);
        }
      }
    });
    window.setupFilters();
    setupMobileMenu();
    window.setupModal();
    setupAutoRefreshButtons();
    setRefreshHandler("schedule", runScheduleAutoRefresh);
    setRefreshHandler("standings", runScheduleAutoRefresh);
    window.updateMatchCount();
    switchView("schedule");
    window.setupPredFilters();
    // 后台轮询已取消：刷新按钮的自动倒计时（30秒）负责触发视图更新
  });

  // 导出
  window.setRefreshHandler = setRefreshHandler;
  window.startAutoRefresh = startAutoRefresh;
  window.stopAutoRefresh = stopAutoRefresh;
  window.updateAutoRefreshCountdown = updateAutoRefreshCountdown;
  window.setAutoRefreshIndicatorState = setAutoRefreshIndicatorState;
  window.performAutoRefresh = performAutoRefresh;
  window.resetAutoRefreshTimer = resetAutoRefreshTimer;
  window.switchView = switchView;
  window.runScheduleAutoRefresh = runScheduleAutoRefresh;
  window.runAnalysisAutoRefresh = runAnalysisAutoRefresh;
  window.setupAutoRefreshButtons = setupAutoRefreshButtons;
  window.setupMobileMenu = setupMobileMenu;

  window.App.main.setRefreshHandler = setRefreshHandler;
  window.App.main.startAutoRefresh = startAutoRefresh;
  window.App.main.stopAutoRefresh = stopAutoRefresh;
  window.App.main.updateAutoRefreshCountdown = updateAutoRefreshCountdown;
  window.App.main.setAutoRefreshIndicatorState = setAutoRefreshIndicatorState;
  window.App.main.performAutoRefresh = performAutoRefresh;
  window.App.main.resetAutoRefreshTimer = resetAutoRefreshTimer;
  window.App.main.switchView = switchView;
  window.App.main.runScheduleAutoRefresh = runScheduleAutoRefresh;
  window.App.main.runAnalysisAutoRefresh = runAnalysisAutoRefresh;
  window.App.main.setupAutoRefreshButtons = setupAutoRefreshButtons;
  window.App.main.setupMobileMenu = setupMobileMenu;
})();
