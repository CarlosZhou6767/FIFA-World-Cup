# 2026 FIFA World Cup Dashboard

<p align="center">
  <strong>United States &middot; Canada &middot; Mexico</strong><br>
  <em>June 11 – July 19, 2026</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-yellow" alt="JavaScript">
  <img src="https://img.shields.io/badge/HTML-5-orange" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS-3-blue" alt="CSS3">
  <img src="https://img.shields.io/badge/Chart.js-4.4-green" alt="Chart.js">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

---

A lightweight, zero-dependency single-page application for tracking the 2026 FIFA World Cup in real time. Features live scores, group standings, odds-driven predictions, and odds trend analysis — all powered by ESPN's public API. No build tools, no backend, no API key required.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Data Sources](#data-sources)
- [API Reference](#api-reference)
- [Design System](#design-system)
- [Browser Support](#browser-support)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 1. Schedule

- **104 matches** across 12 groups (A–L) and 7 knockout rounds, grouped by date
- Multi-dimensional filtering: by stage, group, date, and team name search
- Match cards display team flags, Beijing time (UTC+8), venue city, and stage badge
- Real-time status badges — `Scheduled` / `Live` / `Finished` — with live score display
- **30-second polling** from ESPN for live score synchronization via `liveScores.js`
- Manual refresh button with 60-second countdown timer

### 2. Standings

- **12 groups (A–L)** with automatic ranking calculation
- Tiebreaker rules: points → goal difference → goals scored → head-to-head → team name
- Manual refresh only — no auto-polling to avoid unnecessary API calls
- Dynamic synchronization with ESPN live match data

### 3. Predictions

- **Odds-driven predictions** powered by ESPN real-time odds with multi-source weighted aggregation
- **8-algorithm optimization pipeline**:
  - Multi-source weighted aggregation (DraftKings ×1.0, Bet365 ×0.8, Caesars ×0.7, ESPN ×0.6)
  - Overround removal via multiplicative margin adjustment
  - Odds movement analysis with Sharp Money detection (stable / moderate / sharp / extreme)
  - Confidence calibration from multiple factors (provider count, overround, movement)
  - Cross-market fusion using spread and total odds
  - Value bet detection (edge > 2%)
  - FIFA ranking-based Elo fallback model for matches without odds (host nation +5% bonus, draw rate attenuation)
  - Dynamic hot predictions from real-time data
- Real-time implied probability bars (home / draw / away)
- Live odds panel with Moneyline odds from multiple providers

### 4. Odds Analysis Center

- Interactive trend chart (Chart.js) displaying historical odds movement
- **Providers**: DraftKings, Bet365, Caesars, ESPN (via ESPN API)
- **Odds types**: Moneyline / Spread / Totals
- Single-match deep-dive with full odds detail popup
- Historical odds snapshot storage via `localStorage`
- Data export functionality for offline analysis (JSON)

---

## Quick Start

### Prerequisites

- A modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Internet connection (for ESPN API and Google Fonts)
- No server, build tools, or npm dependencies required

### One-Click Launch

Open `index.html` in your browser. That's it — the app loads immediately and begins fetching live data.

ESPN's public API supports CORS requests from the `file://` protocol, so no local server is needed.

---

## Installation

### Option 1: Clone the Repository

```bash
git clone https://github.com/CarlosZhou6767/FIFA-World-Cup.git
cd FIFA-World-Cup
```

Then open `index.html` in your browser.

### Option 2: Download as ZIP

1. Click the green **Code** button on the repository page
2. Select **Download ZIP**
3. Extract the archive and open `index.html`

### Option 3: Local Server (Optional)

If you prefer serving via HTTP (e.g., for testing CSP headers):

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# Or use any static file server of your choice
```

Then visit `http://localhost:8080`.

---

## Usage Guide

### Navigating the App

The top navigation bar provides four views:

| Tab | What It Shows | When to Use |
|-----|---------------|-------------|
| **Schedule** | All 104 matches grouped by date | Follow match timelines, check scores |
| **Standings** | 12 group tables with rankings | Track tournament progress per group |
| **Predictions** | Win probability forecasts for upcoming group-stage matches | Evaluate odds, find value bets |
| **Analysis** | Historical odds chart + key indicators | Analyze odds movement, detect sharp signals |

### Using Filters (Schedule View)

1. **Stage Filter** — Filter by group stage or knockout rounds
2. **Group Filter** — Focus on a specific group (A–L)
3. **Date Filter** — Pick a specific match day
4. **Search** — Type a team name (e.g., "Brazil", "Germany") to find matches instantly

Click **Clear Filters** to reset all filters.

### Viewing Match Details

Click any match card to open the detail modal, which shows:
- Team names with flags
- Match time in both Beijing time (UTC+8) and local venue time
- Venue information (country, city)
- Match stage and group
- Live score or scheduled status

### Prediction Cards

On the Predictions page, each match card displays:
- **Probability bars** — Visual breakdown of home win / draw / away win chances
- **Confidence level** — Calibrated confidence as a progress bar (high / medium / low)
- **Smart tags** — Value bet badges, Sharp Money signals, multi-source aggregation labels
- **FIFA ranking display** — Each team shows its FIFA ranking number

Click a prediction card to open the odds detail modal with full provider comparison.

### Odds Analysis

1. Select a **match** from the dropdown
2. Select an **odds type** (Moneyline, Spread, or Totals)
3. Select a **provider** (DraftKings, Bet365, Caesars, ESPN)
4. The chart updates to show historical movements and key indicators

Use the **Export** button to download the current analysis data as JSON.

---

## Project Structure

```
FIFA-World-Cup/
├── index.html                  # SPA entry point (4 views + 2 modals)
├── css/
│   └── styles.css              # Global stylesheet (design tokens, layout, components, animations)
├── js/
│   ├── config.js               # Global configuration constants
│   ├── data.js                 # Static data: 48 teams, 16 venues, 104 matches
│   ├── utils.js                # Pure utility functions (time, HTML, formatting, validation)
│   ├── apiClient.js            # ESPN API client with caching and request deduplication
│   ├── scheduleView.js         # Schedule rendering, filtering, standings calculation
│   ├── oddsEngine.js           # Odds aggregation, prediction engine, trend chart rendering
│   ├── predictionsView.js      # Prediction card rendering, odds detail modal, match detail modal
│   ├── main.js                 # App initialization, view switching, auto-refresh timer
│   └── liveScores.js           # Real-time score polling (30s interval)
├── .trae/
│   └── documents/              # Design documents and planning artifacts
├── .gitignore
├── README.md                   # English documentation
└── README-CN.md                # Chinese documentation
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `config.js` | All configuration constants: API URLs, cache TTLs, tournament date range, timezone, stage/status mappings, provider weights, venue timezones, odds translations, advance probability tables |
| `data.js` | Static business data: 48 teams (groups, FIFA rankings, flag URLs), 16 venues (capacity, city, timezone), 104 match fixtures; index construction (Map-based O(1) lookups); standings calculation |
| `utils.js` | Pure utility functions: `escapeHTML()`, `buildFlagHtml()`, `toBeijingTime()`, `formatDate2()`, `formatTime()`, `translateDetailsToChinese()`, `parsePlaceholderAbbr()`, `getLocalMatchTime()`, `normalizeProbabilities()`, `americanToDecimal()`, `oddsToImpliedProb()`, team/venue match validation |
| `apiClient.js` | ESPN API fetching with TTL cache + LRU eviction + request deduplication; event transformation (`transformEspnEvent`); odds extraction (`parseOddsFromEspnEvent`); stage/group detection |
| `scheduleView.js` | Schedule list rendering with date grouping; match card creation with click handlers; multi-filter setup (stage/group/date/search); standings table rendering with ranking logic |
| `oddsEngine.js` | Odds aggregation pipeline (weighted averaging → overround removal → movement analysis → confidence calibration → cross-market adjustment → value bet detection); Chart.js trend chart rendering; odds snapshot storage; hot predictions generation; advancement probability calculation |
| `predictionsView.js` | Prediction card rendering (FIFA ranking Elo fallback + async odds enrichment); odds detail modal; match detail modal; prediction filter setup (stage/confidence/sort/search) |
| `main.js` | DOMContentLoaded initialization; view switching (`switchView`); auto-refresh timer (60s countdown); mobile menu; refresh button bindings |
| `liveScores.js` | 30-second interval polling of ESPN API; live score → `WORLD_CUP_DATA` synchronization; TBD placeholder auto-replacement; stop/start controls |

---

## Architecture

### Data Flow

```
config.js (configuration constants)
    │
    ▼
data.js (static data) ── WORLD_CUP_DATA { teams, venues, matches }
    │
    ▼
utils.js (pure helpers)
    │
    ▼
apiClient.js ────────────────── ESPN API
    │               │
    ├── scheduleView.js        │  (schedule + standings)
    ├── oddsEngine.js          │  (prediction + chart)
    ├── predictionsView.js     │  (prediction UI + modals)
    └── liveScores.js ─────────┘  (30s polling → WORLD_CUP_DATA)
               │
               ▼
          main.js (init + view switching + auto-refresh)
```

### Script Loading Order

```
config.js → data.js → utils.js → apiClient.js → scheduleView.js → oddsEngine.js → predictionsView.js → main.js → liveScores.js
```

### Caching Strategy

All ESPN API requests are managed by a unified cache layer in `apiClient.js`:

| Cache | TTL | Capacity | Eviction |
|-------|-----|----------|----------|
| `espnCache` | 180s | 20 entries | LRU (oldest) |
| `matchOddsCache` | 300s | 50 entries | Expiry + LRU |

All cache configuration is centralized in `window.CONFIG` ([config.js](js/config.js)).

**Key optimizations:**

- **Request deduplication** — Concurrent requests to the same endpoint share a single Promise
- **Browser HTTP caching** — `cache: 'default'` for normal requests, `'reload'` for forced refreshes
- **Match indexing** — `Map`-based O(1) lookups (`MATCH_INDEX_BY_ID`, `MATCH_INDEX_BY_DATE_TEAMS`)
- **GPU-accelerated animations** — CSS `translate3d` / `will-change` / `contain`
- **Event delegation** — Container-level event listeners for prediction card lists
- **Content deduplication** — Schedule rendering compares ID+score+status fingerprints to avoid redundant DOM updates
- **Double rAF** — Dual `requestAnimationFrame` delay for smooth CSS transition animations

### Stage Detection Logic

Match stage detection prioritizes ESPN's `season.slug` field, falling back to date-based heuristics:

| Priority | Source | Mapping |
|----------|--------|---------|
| 1 | `espnEvent.season.slug` | `SLUG_TO_STAGE` table (config.js) |
| 2 | Match date | Hard-coded date range fallback |

### View Refresh Strategy

| View | Auto-refresh | Trigger |
|------|-------------|---------|
| Schedule | 60s countdown timer | Manual button + auto timer |
| Standings | None | Manual button only |
| Predictions | None | Manual button only |
| Analysis | None | Manual button only |

### Security

- **Content Security Policy (CSP)** — Restricts script, style, font, image, and API sources
- **XSS prevention** — All dynamically rendered content is escaped via `escapeHTML()`
- **SRI integrity** — Chart.js CDN script includes an integrity hash
- **Defensive null checks** — All DOM element references are guarded against `null`
- **Knockout placeholder filtering** — Non-group-stage matches with TBD teams are excluded from predictions and schedule views

---

## Configuration

All configuration lives in [js/config.js](js/config.js) and is exposed via `window.CONFIG`.

### API Config

| Key | Default | Description |
|-----|---------|-------------|
| `ESPN_API` | `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | ESPN scoreboard API endpoint |
| `TOURNAMENT_DATE_RANGE` | `20260611-20260730` | Tournament date range (API query param) |

### Cache Config

| Key | Default | Description |
|-----|---------|-------------|
| `ESPN_CACHE_TTL` | `180000` (3 min) | Schedule cache expiry |
| `ESPN_CACHE_MAX_SIZE` | `20` | Schedule cache max entries |
| `ODDS_CACHE_TTL` | `300000` (5 min) | Per-match odds cache expiry |
| `ODDS_CACHE_MAX_SIZE` | `50` | Per-match odds cache max entries |

### Refresh Config

| Key | Default | Description |
|-----|---------|-------------|
| `AUTO_REFRESH_INTERVAL` | `30000` (30s) | Score polling interval (liveScores.js) |

### Provider Weights

| Key | Default | Description |
|-----|---------|-------------|
| `PROVIDER_WEIGHTS` | `{ draftkings: 1.0, bet365: 0.8, caesars: 0.7, main: 0.6 }` | Weighted averaging weights for multi-source odds aggregation |

### Tournament Config

| Key | Default | Description |
|-----|---------|-------------|
| `HOST_TEAMS` | `['USA', 'MEX', 'CAN']` | Host nation teams (used for Elo prediction bonus) |
| `DEFAULT_TIMEZONE` | `Asia/Shanghai` | Default display timezone (UTC+8) |

### Mapping Tables

| Key | Description |
|-----|-------------|
| `STAGE_NAMES` | 7 stage Chinese names (group stage, round of 32, etc.) |
| `STATUS_NAMES` | 7 status Chinese text (scheduled, live, halftime, finished, postponed, delayed, cancelled) |
| `SLUG_TO_STAGE` | ESPN season.slug to internal stage identifier |
| `ESPN_STATUS_MAP` | 20+ ESPN raw statuses to unified internal statuses |
| `ESPN_STATUS_DETAIL` | 14 ESPN statuses with Chinese and English descriptions |
| `VENUE_TIMEZONES` | 16 venue timezone offsets, abbreviations, and city names |
| `ODDS_TRANSLATIONS` | 30 English-to-Chinese odds description translation rules |
| `ADVANCE_PROB_TABLE` | Group advancement probability lookup table (points × remaining matches) |
| `TEAM_MAP` | 48+ ESPN team abbreviations to internal team IDs |
| `ESPN_VENUE_IDS` | Set of 16 World Cup venue IDs for validation |

---

## Data Sources

### Static Data ([data.js](js/data.js))

| Category | Count | Details |
|----------|-------|---------|
| Teams | 48 | 12 groups (A–L), 4 teams per group, with FIFA rankings |
| Venues | 16 | 10 USA + 3 Mexico + 2 Canada + 1 unassigned |
| Matches | 104 | 72 group stage (matchdays 1–17) + 32 knockout |

Team flags are sourced from [flagcdn.com](https://flagcdn.com) and rendered as `<img>` tags with 2x/3x `srcset` support.

### External API

All real-time data comes from **ESPN's public API** — no API key required.

| Endpoint | Purpose |
|----------|---------|
| `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | Schedule, scores, odds, match status |

**Query parameters**: `?dates=YYYYMMDD-YYYYMMDD&limit=200`

---

## API Reference

### Match Data Structure

The `transformEspnEvent()` function in `apiClient.js` converts ESPN event objects into the internal match format:

```js
{
  id: Number,              // Unique match ID
  date: String,            // Match date, e.g. "2026-06-11"
  time: String,            // Match time, e.g. "12:00"
  timeUTC: String,         // UTC time string
  homeTeam: String,        // Home team abbreviation, e.g. "USA"
  awayTeam: String,        // Away team abbreviation, e.g. "CAN"
  _homeName: String,       // Home team display name
  _awayName: String,       // Away team display name
  venue: String,           // Venue ID
  stage: String,           // "group" | "round32" | "round16" | "quarterfinal" | "semifinal" | "thirdplace" | "final"
  group: String,           // "A"–"L" | null
  status: String,          // "scheduled" | "live" | "finished"
  homeScore: Number,       // Home score (null before kickoff)
  awayScore: Number,       // Away score (null before kickoff)
  minute: String,          // Current match minute (null if not live)
  _espnStatusName: String, // ESPN raw status name
  _espnStatusDesc: String, // ESPN raw status description
  _espnId: String,         // ESPN event ID
  _source: String          // Data source ("espn" | "local")
}
```

### Core Utility Functions ([utils.js](js/utils.js))

| Function | Purpose |
|----------|---------|
| `escapeHTML(str)` | Escape HTML entities to prevent XSS |
| `buildFlagHtml(url, name)` | Build safe `<img>` tags with 2x/3x srcset |
| `toBeijingTime(utcDate)` | Convert UTC date to Beijing time |
| `formatDate2(date)` | Format date as `YYYY-MM-DD` |
| `formatTime(date)` | Format time as `HH:MM` |
| `translateDetailsToChinese(details)` | Translate ESPN odds descriptions to Chinese |
| `parsePlaceholderAbbr(abbr)` | Convert knockout placeholder (e.g. "1A") to readable Chinese |
| `getTeamById(teamId, fallbackName)` | Look up team by abbreviation (includes `isPlaceholder` flag) |
| `getVenueById(venueId)` | Look up venue by ID |
| `getStageName(stage)` | Convert stage code to Chinese display name |
| `getStatusText(status)` | Convert status code to Chinese display text |
| `getDetailedStatus(match)` | Get detailed status description (uses `ESPN_STATUS_DETAIL`) |
| `isMatchWithRealTeams(match)` | Check if both teams are real (not placeholders) |
| `isMatchConfirmed(match)` | Check if both team abbreviations are non-empty |
| `isKnockoutPlaceholder(match)` | Check if match is a knockout stage placeholder |
| `normalizeProbabilities(home, draw, away)` | Normalize three probabilities to sum to 100 |
| `americanToDecimal(american)` | Convert American odds to decimal format |
| `formatDecimalOdds(american)` | Format decimal odds for display |
| `oddsToImpliedProb(american)` | Convert odds to implied probability |
| `getVenueTimezone(venueId)` | Get venue timezone info |
| `getLocalMatchTime(dateStr, timeStr, venueId, timeUTC)` | Calculate Beijing time + venue local time |

### Prediction Engine Functions ([oddsEngine.js](js/oddsEngine.js))

| Function | Purpose |
|----------|---------|
| `parseOddsFromEspnEvent(event)` | Extract odds from ESPN event by provider |
| `aggregateOdds(oddsInfo)` | Multi-source weighted aggregation using `PROVIDER_WEIGHTS` |
| `removeOverround(homeProb, drawProb, awayProb)` | Margin removal (multiplicative normalization) |
| `analyzeOddsMovement(ml)` | Movement analysis: Sharp Money detection, signal strength (1–10) |
| `crossMarketAdjust(spread, total)` | Cross-market fusion with spread and total odds |
| `calibrateConfidence(norm, overround, movement, providerCount)` | Multi-factor confidence calibration (10–95) |
| `detectValueBet(trueProbs, ml)` | Value bet detection (edge > 2%) |
| `derivePredictionFromOdds(oddsInfo)` | Full prediction pipeline: odds → final prediction |
| `calcAdvancementProb(teamId, allMatches)` | Group advancement probability (lookup table + goal diff adjustment) |
| `generateHotPredictions()` | Generate hot predictions list (sorted by heat, max 15) |

### Charts & Analysis ([oddsEngine.js](js/oddsEngine.js))

| Function | Purpose |
|----------|---------|
| `anaFetchScoreboardWithOdds()` | Fetch ESPN scoreboard with odds data |
| `anaGenerateTrendData(oddsInfo, provider, oddsType)` | Generate trend data points |
| `anaDrawQuickTrend(trend, oddsInfo)` | Quick chart render for first screen |
| `renderOddsTrend()` | Full Chart.js trend chart render |
| `anaRenderKeyPoints(oddsInfo, provider, oddsType)` | Render key indicators panel |
| `saveOddsSnapshot(matchId, oddsInfo, provider, oddsType)` | Save odds snapshot to localStorage |
| `loadOddsHistory(matchId)` | Load historical odds snapshots |
| `anaExportData()` | Export analysis data as JSON |

---

## Design System

### Color Palette

| CSS Variable | Value | Usage |
|-------------|-------|-------|
| `--primary-color` | `#0c1525` | Navigation, headings, card backgrounds |
| `--primary-light` | `#162038` | Gradients, hover states |
| `--secondary-color` | `#d4a843` | Gold accents, score highlights |
| `--accent-color` | `#e63946` | Live status, alerts, call-to-action |
| `--bg-color` | `#f0f2f5` | Page background |
| `--card-bg` | `#ffffff` | Card and table backgrounds |
| `--text-primary` | `#0f172a` | Headings, primary text |
| `--text-secondary` | `#334155` | Body text |
| `--text-tertiary` | `#64748b` | Secondary descriptions |

### Typography

| Role | Font | Weight |
|------|------|--------|
| Display (headings, scores) | [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | 600–700 |
| Body text | [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) | 400–600 |
| UI labels | [Inter](https://fonts.google.com/specimen/Inter) | 400–500 |
| Numeric data | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | 400–700 |

### Spacing Scale

8px-based grid: `4px` → `8px` → `16px` → `24px` → `32px` → `48px` → `64px`

### Responsive Breakpoints

| Range | Device | Layout |
|-------|--------|--------|
| < 480px | Phone portrait | Single column, stacked filters |
| 480–768px | Phone landscape | Horizontal filters |
| 768–1024px | Tablet | Two-column grid |
| > 1024px | Desktop | Full layout, multi-column |

---

## Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## FAQ

### Some matches show as "TBD" or placeholder names

Knockout stage matches (round of 32, round of 16, etc.) have unknown participants until the tournament progresses. These are shown as placeholder markers (e.g. "Group A Winner") and are filtered out from the Predictions page. They will automatically update when ESPN provides the actual teams.

### The Predictions page only shows group-stage matches

This is intentional. Knockout-stage matches have TBD participants and cannot be meaningfully predicted. The Predictions page uses FIFA ranking-based Elo modeling for matches without odds data, and filters out non-group-stage matches entirely.

### The odds analysis page has no data for some providers

Provider availability varies by match. If a provider (e.g., Bet365, Caesars) has no odds data for a selected match, its tab button is automatically hidden. The app defaults to the first available provider.

### The page doesn't update

The Schedule view has a 60-second auto-refresh countdown timer. Other views require a manual refresh click. The liveScores.js module polls ESPN every 30 seconds independently. If an API request fails due to network issues, the app will retry on the next cycle.

### Flag images not loading

Flag images are sourced from [flagcdn.com](https://flagcdn.com). If a flag fails to load, the URL may be invalid or the network may be restricted. Check the browser console for CSP policy blocks or network errors.

### How to adjust cache/refresh frequency

Edit `ESPN_CACHE_TTL`, `ODDS_CACHE_TTL`, and `AUTO_REFRESH_INTERVAL` in [config.js](js/config.js). No business logic changes needed.

---

## Contributing

Contributions are welcome. Before submitting code, please ensure:

1. All match data must come from ESPN API — no hardcoded static data
2. Use local flag images instead of API-provided flag URLs
3. Dynamically rendered content must be escaped via `escapeHTML()` to prevent XSS
4. New features must include defensive null checks to prevent white screens
5. Configuration parameters should be added to `window.CONFIG` in [config.js](js/config.js), not hardcoded
6. New Chinese text should be added to the mapping tables or translation rules in `config.js`, not inline in rendering logic

### Local Development

```bash
# No build step required — edit source files directly
# Open index.html in a browser to preview changes
# Use DevTools Network panel to verify API calls
```

---

## License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute this software for any purpose, commercial or private, provided that the original license notice is included.

---

<p align="center">
  <sub>Built with vanilla JavaScript, ESPN public data, and a love for the beautiful game.</sub>
</p>