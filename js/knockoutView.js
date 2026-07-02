/**
 * @fileoverview 晋级之路视图模块 — 交互式淘汰赛对阵图
 * @description 使用 ESPN 接口真实数据构建 32 强对阵，
 * 保持左右两侧向中间汇聚的经典 bracket 布局，提供小组排名设置+淘汰赛推进功能
 */
(function() {
  'use strict';
  window.App = window.App || {};
  window.App.knockout = window.App.knockout || {};

  // ===== 从项目数据构建 GROUPS =====
  var GROUP_COLORS = {
    A:'#22c55e',B:'#ef4444',C:'#f97316',D:'#3b82f6',E:'#a855f7',F:'#84cc16',
    G:'#ec4899',H:'#06b6d4',I:'#8b5cf6',J:'#14b8a6',K:'#fb923c',L:'#38bdf8'
  };
  var GROUP_BG = {
    A:'#fff1f0',B:'#fef2f2',C:'#fff7ed',D:'#eff6ff',E:'#faf5ff',F:'#f0fdf4',
    G:'#fdf2f8',H:'#ecfeff',I:'#f5f3ff',J:'#f0fdfa',K:'#fff7ed',L:'#f0f9ff'
  };

  /** 从 WORLD_CUP_DATA.teams 构建 GROUPS */
  var GROUPS = {};
  (function buildGroups() {
    var data = window.WORLD_CUP_DATA || {};
    var teams = data.teams || [];
    teams.forEach(function(t) {
      if (!GROUPS[t.group]) GROUPS[t.group] = { color: GROUP_COLORS[t.group] || '#0d9488', bg: GROUP_BG[t.group] || '#f0fdf4', teams: [] };
      var code = '';
      if (t.flag) {
        var m = t.flag.match(/\/([\w-]+)\.png$/);
        if (m) code = m[1];
      }
      GROUPS[t.group].teams.push({ n: t.name, f: code, id: t.id });
    });
  })();

  /** 国旗图片（使用 flagcdn 与项目保持一致） */
  var FLAG_BASE = 'https://flagcdn.com/40x30/';
  function flagImg(code, cls) {
    if (!code) return '<span class="ko-flag-empty"></span>';
    return '<img src="' + FLAG_BASE + code + '.png" class="' + cls + '" alt="' + code + '" loading="lazy">';
  }

  // ===== 状态 =====
  var groupRanks = {};
  Object.keys(GROUPS).forEach(function(g) { groupRanks[g] = [0,0,0,0]; });

  function emptySlot(label) { return { team:'', flag:'', label: label, winner: false }; }

  var state = {
    L: { r32: [], r16: [], qf: [], sf: [] },
    R: { r32: [], r16: [], qf: [], sf: [] },
    final: [emptySlot('半决赛左区胜者'), emptySlot('半决赛右区胜者')],
    champion: null
  };

  function initState() {
    ['L','R'].forEach(function(side) {
      state[side].r32 = Array.from({length:8}, function(_,i) {
        return [emptySlot('32强'+(side==='L'?'左':'右')+(i+1)+'上'), emptySlot('32强'+(side==='L'?'左':'右')+(i+1)+'下')];
      });
      state[side].r16 = Array.from({length:4}, function(_,i) {
        return [emptySlot('32强'+(side==='L'?'左':'右')+(i*2+1)+'胜'), emptySlot('32强'+(side==='L'?'左':'右')+(i*2+2)+'胜')];
      });
      state[side].qf = Array.from({length:2}, function(_,i) {
        return [emptySlot('16强'+(side==='L'?'左':'右')+(i*2+1)+'胜'), emptySlot('16强'+(side==='L'?'左':'右')+(i*2+2)+'胜')];
      });
      state[side].sf = [[emptySlot('八强'+(side==='L'?'左':'右')+'1胜'), emptySlot('八强'+(side==='L'?'左':'右')+'2胜')]];
    });
    state.final = [emptySlot('半决赛左区胜者'), emptySlot('半决赛右区胜者')];
    state.champion = null;
  }
  initState();

  // ===== Helper =====
  /** 根据队伍 id 获取中文名和国旗码 */
  function getTeamById(id) {
    if (!id) return null;
    var teams = (window.WORLD_CUP_DATA && window.WORLD_CUP_DATA.teams) || [];
    var t = teams.find(function(x) { return x.id === id; });
    if (!t) return null;
    var code = '';
    if (t.flag) {
      var m = t.flag.match(/\/([\w-]+)\.png$/);
      if (m) code = m[1];
    }
    return { n: t.name, f: code, id: t.id };
  }

  /** 从 calculateStandings 接口排名自动填充 groupRanks，返回 ESPN 原始比赛数组 */
  async function autoFillRanksFromStandings() {
    if (typeof window.calculateStandings !== 'function') return [];
    try {
      var espnMatches = [];
      if (typeof window.fetchScheduleFromESPNCached === 'function') {
        espnMatches = await window.fetchScheduleFromESPNCached(false);
      }
      var standings = window.calculateStandings(espnMatches);
      if (standings) {
        Object.keys(GROUPS).forEach(function(g) {
          var groupData = standings[g];
          if (!groupData || !Array.isArray(groupData)) return;
          groupRanks[g] = [0, 0, 0, 0];
          groupData.forEach(function(item, rank) {
            var teamId = item.team && item.team.id;
            if (!teamId) return;
            var idx = GROUPS[g].teams.findIndex(function(t) { return t.id === teamId; });
            if (idx >= 0 && rank < 4) groupRanks[g][idx] = rank + 1;
          });
        });
      }
      return espnMatches;
    } catch(e) {
      console.warn('[knockoutView] autoFillRanksFromStandings failed:', e.message || e);
      return [];
    }
  }

  /** 根据 ESPN 淘汰赛真实赛果自动推进对阵图 */
  function autoAdvanceFromESPN(espnMatches) {
    if (!Array.isArray(espnMatches)) return;
    var roundMap = { round32: 'r32', round16: 'r16', quarterfinal: 'qf', semifinal: 'sf', final: 'final', thirdplace: 'thirdplace' };
    var finished = espnMatches.filter(function(m) {
      return m.status === 'finished' && m.stage !== 'group' && roundMap[m.stage];
    });
    finished.forEach(function(m) {
      var round = roundMap[m.stage];
      var homeTeam = getTeamById(m.homeTeam);
      var awayTeam = getTeamById(m.awayTeam);
      var homeName = homeTeam ? homeTeam.n : (m._homeName || '').trim();
      var awayName = awayTeam ? awayTeam.n : (m._awayName || '').trim();
      var homeScore = parseInt(m.homeScore, 10);
      var awayScore = parseInt(m.awayScore, 10);
      if (isNaN(homeScore) || isNaN(awayScore)) return;
      var winnerIdx = homeScore > awayScore ? 0 : homeScore < awayScore ? 1 : -1;
      if (winnerIdx < 0) return;

      var found = null;
      if (round === 'final') {
        var f0 = state.final[0].team || '';
        var f1 = state.final[1].team || '';
        if ((f0 === homeName && f1 === awayName) || (f0 === awayName && f1 === homeName)) {
          found = { side: 'L', round: 'final', matchIdx: 0 };
        }
      } else {
        ['L', 'R'].forEach(function(side) {
          state[side][round].forEach(function(match, mi) {
            var s0 = match[0].team || '';
            var s1 = match[1].team || '';
            if ((s0 === homeName && s1 === awayName) || (s0 === awayName && s1 === homeName)) {
              found = { side: side, round: round, matchIdx: mi };
            }
          });
        });
      }

      if (found) {
        if (found.round === 'final') {
          var actualIdx = (state.final[0].team === homeName) ? winnerIdx : 1 - winnerIdx;
          advanceFinal(actualIdx);
        } else {
          var match = state[found.side][found.round][found.matchIdx];
          var actualIdx = (match[0].team === homeName) ? winnerIdx : 1 - winnerIdx;
          advanceMatch(found.side, found.round, found.matchIdx, actualIdx);
        }
      }
    });
  }

  /** 从 ESPN 数据构建 32 强对阵：按比赛时间排序，前 8 场左侧，后 8 场右侧 */
  function buildR32FromESPN(espnMatches) {
    var r32 = espnMatches.filter(function(m) { return m.stage === 'round32'; });
    // 按日期+时间排序（与 FIFA 官方赛程顺序一致）
    r32.sort(function(a, b) {
      var ta = (a.date || '') + ' ' + (a.time || '');
      var tb = (b.date || '') + ' ' + (b.time || '');
      return ta.localeCompare(tb);
    });
    // 若不足 16 场，用空槽补齐
    while (r32.length < 16) {
      r32.push({ _homeName: '待定', _awayName: '待定', homeTeam: '', awayTeam: '', status: 'scheduled' });
    }

    function slotFromMatch(m, defaultLabel) {
      var home = getTeamById(m.homeTeam);
      var away = getTeamById(m.awayTeam);
      if (home && away) {
        return [
          { team: home.n, flag: home.f, label: home.n, winner: false },
          { team: away.n, flag: away.f, label: away.n, winner: false }
        ];
      }
      return [
        { team: '', flag: '', label: m._homeName || defaultLabel + '上', winner: false },
        { team: '', flag: '', label: m._awayName || defaultLabel + '下', winner: false }
      ];
    }

    ['L','R'].forEach(function(side) {
      var start = side === 'L' ? 0 : 8;
      state[side].r32 = r32.slice(start, start + 8).map(function(m, i) {
        return slotFromMatch(m, '32强' + (side === 'L' ? '左' : '右') + (i + 1));
      });
    });
  }

  // ===== Advance =====
  /** 将指定场次的胜者晋级到下一轮对应位置
   * @param {string} side - 半区标识 'L'(左) 或 'R'(右)
   * @param {string} round - 当前轮次 'r32'|'r16'|'qf'|'sf'
   * @param {number} matchIdx - 当前轮次中的场次索引
   * @param {number} slotIdx - 胜者槽位索引 0(上方) 或 1(下方)
   */
  function advanceMatch(side, round, matchIdx, slotIdx) {
    var roundsMap = { r32:'r16', r16:'qf', qf:'sf', sf:'final' };
    var nextRound = roundsMap[round];
    if (!nextRound) return;
    var match = state[side][round][matchIdx];
    var winner = match[slotIdx];
    if (!winner.team) return;
    match[0].winner = (slotIdx === 0);
    match[1].winner = (slotIdx === 1);
    var nextMatchIdx = Math.floor(matchIdx / 2);
    var nextSlotIdx = matchIdx % 2;
    if (nextRound === 'final') {
      state.final[side === 'L' ? 0 : 1] = { team: winner.team, flag: winner.flag, label: winner.label, winner: false };
      state.champion = null;
    } else {
      state[side][nextRound][nextMatchIdx][nextSlotIdx] = { team: winner.team, flag: winner.flag, label: winner.label, winner: false };
      clearDownstream(side, nextRound, nextMatchIdx);
    }
    renderBracket();
  }

  /** 清除指定场次下游所有轮次的占位数据（回溯清空）
   * @param {string} side - 半区标识 'L'(左) 或 'R'(右)
   * @param {string} round - 发生变更的轮次
   * @param {number} matchIdx - 场次索引
   */
  function clearDownstream(side, round, matchIdx) {
    var order = ['r32','r16','qf','sf'];
    var idx = order.indexOf(round);
    for (var i = idx + 1; i < order.length; i++) {
      var r = order[i];
      var mi = Math.floor(matchIdx / Math.pow(2, i - idx));
      if (state[side][r] && state[side][r][mi]) {
        var si = Math.floor(matchIdx / Math.pow(2, i - idx - 1)) % 2;
        var old = state[side][r][mi][si];
        state[side][r][mi][si] = emptySlot(old.label);
      }
    }
    var fi = side === 'L' ? 0 : 1;
    state.final[fi] = emptySlot(state.final[fi].label);
    state.champion = null;
  }

  /** 决赛晋级：将决赛胜者设为冠军
   * @param {number} slotIdx - 胜者槽位索引 0(左区) 或 1(右区)
   */
  function advanceFinal(slotIdx) {
    var winner = state.final[slotIdx];
    if (!winner.team) return;
    state.final[0].winner = (slotIdx === 0);
    state.final[1].winner = (slotIdx === 1);
    state.champion = winner;
    renderBracket();
  }

  // ===== Render =====
  function makeMatchHTML(side, round, matchIdx, m) {
    var s0 = m[0], s1 = m[1];
    var id0 = side + '-' + round + '-' + matchIdx + '-0';
    var id1 = side + '-' + round + '-' + matchIdx + '-1';
    return '<div class="ko-match" id="match-' + side + '-' + round + '-' + matchIdx + '">' +
      '<div class="ko-match-slot' + (s0.winner?' winner':'') + '" id="' + id0 + '" data-action="advance" data-side="' + side + '" data-round="' + round + '" data-match="' + matchIdx + '" data-slot="0" title="点击晋级">' +
        flagImg(s0.flag,'ko-slot-flag') +
        '<span class="ko-slot-name">' + (s0.team || s0.label) + '</span>' +
      '</div>' +
      '<div class="ko-match-divider"></div>' +
      '<div class="ko-match-slot' + (s1.winner?' winner':'') + '" id="' + id1 + '" data-action="advance" data-side="' + side + '" data-round="' + round + '" data-match="' + matchIdx + '" data-slot="1" title="点击晋级">' +
        flagImg(s1.flag,'ko-slot-flag') +
        '<span class="ko-slot-name">' + (s1.team || s1.label) + '</span>' +
      '</div>' +
    '</div>';
  }

  /** 渲染整个淘汰赛对阵图（32强、16强、八强、半决赛、决赛、冠军） */
  function renderBracket() {
    ['L','R'].forEach(function(side) {
      var suffix = side === 'L' ? 'Left' : 'Right';
      ['r32','r16','qf','sf'].forEach(function(round) {
        var colId = 'ko' + round.charAt(0).toUpperCase() + round.slice(1) + suffix;
        var col = document.getElementById(colId);
        if (!col) return;
        var label = col.querySelector('.ko-round-label');
        col.innerHTML = '';
        if (label) col.appendChild(label);
        state[side][round].forEach(function(m, mi) {
          col.insertAdjacentHTML('beforeend', makeMatchHTML(side, round, mi, m));
        });
      });
    });
    // Final
    var f = state.final;
    var f1 = document.getElementById('koFinalFlag1');
    var f2 = document.getElementById('koFinalFlag2');
    if (f1) f1.innerHTML = flagImg(f[0].flag, 'ko-final-flag');
    if (f2) f2.innerHTML = flagImg(f[1].flag, 'ko-final-flag');
    var fn1 = document.getElementById('koFinalName1');
    var fn2 = document.getElementById('koFinalName2');
    if (fn1) fn1.textContent = f[0].team || '半决赛左区胜者';
    if (fn2) fn2.textContent = f[1].team || '半决赛右区胜者';
    var fs1 = document.getElementById('koFinalSlot1');
    var fs2 = document.getElementById('koFinalSlot2');
    if (fs1) fs1.className = 'ko-final-slot' + (f[0].winner ? ' winner' : '');
    if (fs2) fs2.className = 'ko-final-slot' + (f[1].winner ? ' winner' : '');
    var c = state.champion;
    var champEl = document.getElementById('koChampName');
    if (champEl) {
      champEl.innerHTML = c ? flagImg(c.flag, 'ko-final-flag') + ' <span>' + c.team + '</span>' : '—';
    }
  }

  // ===== Render Groups =====
  /** 渲染左右两侧的小组排名面板（A-L 组） */
  function renderGroups() {
    var leftPanel = document.getElementById('koLeftGroups');
    var rightPanel = document.getElementById('koRightGroups');
    if (!leftPanel || !rightPanel) return;
    leftPanel.innerHTML = '';
    rightPanel.innerHTML = '';
    var leftGroups = ['A','B','C','D','E','F'];
    var rightGroups = ['G','H','I','J','K','L'];
    leftGroups.forEach(function(g) { leftPanel.appendChild(buildGroupCard(g)); });
    rightGroups.forEach(function(g) { rightPanel.appendChild(buildGroupCard(g)); });
  }

  /** 构建单个小组的排名卡片 DOM 元素
   * @param {string} g - 小组字母标识（如 'A'、'B'）
   * @returns {HTMLElement} 小组卡片 DOM 节点
   */
  function buildGroupCard(g) {
    var data = GROUPS[g];
    if (!data) return document.createElement('div');
    var card = document.createElement('div');
    card.className = 'ko-group-card';
    card.style.borderColor = data.color;
    var header = document.createElement('div');
    header.className = 'ko-group-header';
    header.style.background = 'linear-gradient(90deg,' + (GROUP_BG[g] || '#f0fdf4') + ',#ffffff)';
    header.style.borderBottom = '2px solid ' + data.color;
    header.innerHTML = '<span class="ko-group-letter" style="color:' + data.color + '">第 ' + g + ' 组</span>';
    card.appendChild(header);
    var teamsDiv = document.createElement('div');
    teamsDiv.className = 'ko-group-teams';
    data.teams.forEach(function(t, i) {
      var row = document.createElement('div');
      row.className = 'ko-team-row';
      var r = groupRanks[g][i];
      if (r === 1) row.classList.add('rank1');
      else if (r === 2) row.classList.add('rank2');
      else if (r === 3) row.classList.add('rank3');
      var rankBtns = [1,2,3].map(function(rank) {
        return '<button class="ko-rank-btn r' + rank + (r === rank ? ' sel' : '') + '" data-action="setRank" data-group="' + g + '" data-idx="' + i + '" data-rank="' + rank + '" title="' + (r === rank ? '取消第' : '设为第') + rank + '名">' + rank + '</button>';
      }).join('');
      row.innerHTML = flagImg(t.f, 'ko-team-flag') + '<span class="ko-team-name">' + t.n + '</span><div class="ko-rank-btns">' + rankBtns + '</div>';
      teamsDiv.appendChild(row);
    });
    card.appendChild(teamsDiv);
    return card;
  }

  window.setRank = function(g, teamIdx, rank, e) {
    if (e) e.stopPropagation();
    var ranks = groupRanks[g];
    var cur = ranks[teamIdx];
    if (cur === rank) {
      ranks[teamIdx] = 0;
    } else {
      var other = ranks.indexOf(rank);
      if (other >= 0) ranks[other] = cur;
      ranks[teamIdx] = rank;
    }
    renderGroups();
  };

  window.advanceMatch = advanceMatch;

  function resetAll() {
    Object.keys(GROUPS).forEach(function(g) { groupRanks[g] = [0,0,0,0]; });
    initState();
    renderGroups();
    renderBracket();
  }

  // ===== Main render function (exported) =====
  async function renderKnockout(forceRefresh) {
    var container = document.getElementById('knockoutContainer');
    if (!container) return;

    initKnockoutEvents();

    var html = '<div class="knockout-bracket">';
    html += '<div class="knockout-bracket__main">';
    html += '<div class="ko-groups-panel" id="koLeftGroups"></div>';
    html += '<div class="ko-bracket-area">';
    html += '<div class="ko-bracket-title">— 淘 汰 赛 对 阵 图 —</div>';
    html += '<div class="ko-bracket-wrap">';
    html += '<div class="ko-bracket-half left" id="koLeftHalf">';
    html += '<div class="ko-round-col" id="koSfLeft"><div class="ko-round-label">半决赛</div></div>';
    html += '<div class="ko-round-col" id="koQfLeft"><div class="ko-round-label">四分之一决赛</div></div>';
    html += '<div class="ko-round-col" id="koR16Left"><div class="ko-round-label">16强赛</div></div>';
    html += '<div class="ko-round-col" id="koR32Left"><div class="ko-round-label">32强赛</div></div>';
    html += '</div>';
    html += '<div class="ko-final-col" id="koFinalCol">';
    html += '<div class="ko-final-label">⚽ 决 赛</div>';
    html += '<div class="ko-final-match" id="koFinalMatch">';
    html += '<div class="ko-final-slot" id="koFinalSlot1" data-action="advanceFinal" data-slot="0">';
    html += '<span id="koFinalFlag1"></span><span class="ko-slot-name" id="koFinalName1">半决赛左区胜者</span>';
    html += '</div>';
    html += '<div class="ko-match-divider"></div>';
    html += '<div class="ko-final-slot" id="koFinalSlot2" data-action="advanceFinal" data-slot="1">';
    html += '<span id="koFinalFlag2"></span><span class="ko-slot-name" id="koFinalName2">半决赛右区胜者</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="ko-champ-box" id="koChampBox">';
    html += '<div class="ko-champ-label">🏆 世界杯冠军</div>';
    html += '<div class="ko-champ-name" id="koChampName">—</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="ko-bracket-half right" id="koRightHalf">';
    html += '<div class="ko-round-col" id="koSfRight"><div class="ko-round-label">半决赛</div></div>';
    html += '<div class="ko-round-col" id="koQfRight"><div class="ko-round-label">四分之一决赛</div></div>';
    html += '<div class="ko-round-col" id="koR16Right"><div class="ko-round-label">16强赛</div></div>';
    html += '<div class="ko-round-col" id="koR32Right"><div class="ko-round-label">32强赛</div></div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="ko-groups-panel" id="koRightGroups"></div>';
    html += '</div>';
    html += '<div class="ko-legend">';
    html += '<div class="ko-legend-item"><div class="ko-legend-dot" style="background:#f5c518"></div>小组第1名</div>';
    html += '<div class="ko-legend-item"><div class="ko-legend-dot" style="background:#c0c0c0"></div>小组第2名</div>';
    html += '<div class="ko-legend-item"><div class="ko-legend-dot" style="background:#cd7f32"></div>最佳第3名</div>';
    html += '<div class="ko-legend-item"><div class="ko-legend-dot" style="background:#4ade80"></div>已晋级</div>';
    html += '<button class="ko-reset-btn" data-action="reset">↺ 重置全部</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    var espnMatches = await autoFillRanksFromStandings();
    initState();
    buildR32FromESPN(espnMatches);
    renderGroups();
    autoAdvanceFromESPN(espnMatches);
    renderBracket();
  }

  window.advanceFinal = function(slotIdx) {
    var winner = state.final[slotIdx];
    if (!winner.team) return;
    state.final[0].winner = (slotIdx === 0);
    state.final[1].winner = (slotIdx === 1);
    state.champion = winner;
    renderBracket();
  };

  window.resetKnockout = function() {
    Object.keys(GROUPS).forEach(function(g) { groupRanks[g] = [0,0,0,0]; });
    initState();
    renderGroups();
    renderBracket();
  };

  /** 初始化淘汰赛面板的事件委托（仅执行一次，防止重复绑定） */
  function initKnockoutEvents() {
    var container = document.getElementById('knockoutContainer');
    if (!container || container._koEventsInit) return;
    container._koEventsInit = true;
    container.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      if (action === 'setRank') {
        window.setRank(
          target.getAttribute('data-group'),
          parseInt(target.getAttribute('data-idx')),
          parseInt(target.getAttribute('data-rank')),
          e
        );
      } else if (action === 'advance') {
        window.advanceMatch(
          target.getAttribute('data-side'),
          target.getAttribute('data-round'),
          parseInt(target.getAttribute('data-match')),
          parseInt(target.getAttribute('data-slot'))
        );
      } else if (action === 'advanceFinal') {
        window.advanceFinal(parseInt(target.getAttribute('data-slot')));
      } else if (action === 'reset') {
        window.resetKnockout();
      }
    });
  }

  /** 对外接口：设置淘汰赛面板事件委托 */
  function setupKnockoutEvents() {
    initKnockoutEvents();
  }

  window.renderKnockout = renderKnockout;
  window.App.knockout.renderKnockout = renderKnockout;
  window.App.knockout.setupEvents = setupKnockoutEvents;
})();
