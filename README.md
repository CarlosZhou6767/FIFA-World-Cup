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

- **104 matches** across 12 groups and 5 knockout rounds, grouped by date
- Multi-dimensional filtering: by stage, group, date, and team name search
- Match cards display team flags, Beijing time (UTC+8), venue city, and stage badge
- Real-time status badges — `Scheduled` / `Live` / `Finished` — with live score display
- **30-second polling** from ESPN for live score synchronization
- Manual refresh button with built-in 180-second countdown timer

### 2. Standings

- **12 groups (A–L)** with automatic ranking calculation
- Tiebreaker rules: points → goal difference → goals scored → head-to-head
- Manual refresh only — no auto-polling to avoid unnecessary API calls
- Dynamically synchronized with ESPN live match data

### 3. Predictions

- **Odds-driven predictions** powered by ESPN real-time odds with multi-source aggregation
- **8-algorithm optimization pipeline**:
  - Multi-source aggregation with median calculation
  - Overround removal via multiplicative margin adjustment
  - Odds movement analysis with Sharp Money detection
  - Confidence calibration from multiple factors
  - Cross-market fusion using spread and total odds
  - Value bet detection comparing real vs. implied probabilities
  - 5-tier fallback probability matrix for matches without odds
  - Dynamic hot predictions from real-time data
- Real-time implied probability bars for each match (home / draw / away)
- Live odds panel showing Moneyline odds from ESPN

### 4. Odds Analysis Center

- Interactive trend chart (Chart.js) displaying historical odds movement
- **Provider**: DraftKings (via ESPN API)
- **Odds types**: Moneyline / Spread / Totals
- Single-match deep-dive with full odds detail popup
- Data export functionality for offline analysis

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
| **Predictions** | Probability bars for upcoming matches | Evaluate betting odds, find value bets |
| **Analysis** | Historical odds chart + key points | Analyze odds movement, detect sharp signals |

### Using Filters (Schedule View)

1. **Stage Filter** — Narrow down to group stage, round of 32, round of 16, etc.
2. **Group Filter** — Focus on a specific group (A–L)
3. **Date Filter** — Pick a specific match day
4. **Search** — Type a team name (e.g., "Brazil", "Germany") to find matches instantly

Click **Clear Filters** to reset all filters.

### Viewing Match Details

Click any match card to open the detail modal, which shows:
- Team names with flags
- Match time in both Beijing time (UTC+8) and local venue time
- Venue information (stadium, city, country)
- Match stage and group
- Live score or scheduled status

### Prediction Cards

On the Predictions page, each match card displays:
- **Probability bars** — Visual breakdown of home win / draw / away win chances
- **Odds data** — Moneyline odds from ESPN
- **Hot prediction badge** — Highlighted matches with strong signals

Click a prediction card to open the odds detail modal with full provider comparison.

### Odds Analysis

1. Select a **match** from the dropdown
2. Select an **odds type** (Moneyline, Spread, or Totals)
3. The chart updates to show historical movements and key turning points

Use the **Export** button to download the current analysis data.

---

## Project Structure

```
FIFA-World-Cup/
├── index.html                  # SPA entry point (4 views + 2 modals)
├── css/
│   └── styles.css              # Global stylesheet (design tokens, layout, components, animations)
├── js/
│   ├── config.js               # Global config constants (URLs, cache TTL, mappings, etc.)
│   ├── data.js                 # Static data: 48 teams, 16 venues, 104 matches
│   ├── liveScores.js           # ESPN live score polling module (30s interval)
│   └── merged.js               # Main application logic (view switching, rendering, filtering, modals, charts)
├── docs/
│   └── PredictionAlgorithmV2.md  # Detailed prediction algorithm documentation
├── .gitignore
├── README.md                     # English documentation
└── README-CN.md                  # Chinese documentation
```

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `config.js` | All configuration constants: API URLs, cache TTLs, tournament date range, timezone, stage/status/timezone mappings, chart colors, odds translations, advance probability tables |
| `data.js` | Static business data: 48 teams (groups, rankings, flag URLs), 16 venues (capacity, city, timezone), 104 match fixtures |
| `liveScores.js` | Interval-polling of ESPN API for live scores and match status, mapping ESPN raw statuses to unified internal statuses |
| `merged.js` | Consolidated IIFE containing: view switching & initialization, routing, ESPN API requests & caching, shared utilities, schedule rendering & filtering, standings calculation, prediction engine & UI, odds trend charts, modal management, auto-refresh timer |

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
merged.js ── liveScores.js ── ESPN API
    │              │
    ├── Schedule      │  30s polling
    ├── Standings     │
    ├── Predictions   │
    └── Analysis      │
```

### Caching Strategy

All ESPN API requests are managed by a unified cache layer inside `merged.js`:

| Component | TTL | Capacity | Eviction |
|-----------|-----|----------|----------|
| `espnCache` | 180s | 20 entries | FIFO |
| `matchOddsCache` | 300s | 50 entries | Expiry + FIFO |

All cache config is centralized in `window.CONFIG` ([config.js](js/config.js)) — adjust TTL or MAX_SIZE values without touching business logic.

**Key optimizations:**

- **Request deduplication** — Concurrent requests to the same endpoint share a single Promise
- **Browser HTTP caching** — `cache: 'default'` for normal requests, `'reload'` for forced refreshes
- **Match indexing** — `Map`-based O(1) lookups replacing `Array.find()` linear scans
- **GPU-accelerated animations** — CSS `translate3d` / `will-change` / `contain` reducing reflows
- **Event delegation** — Container-level event listeners for prediction card lists
- **Precomputed sort keys** — Precalculating time values for date grouping to avoid repeated `getLocalMatchTime` calls

### Stage Detection Logic

Match stage detection prioritizes ESPN's `season.slug` field, falling back to date-based heuristics:

| Priority | Source | Mapping |
|----------|--------|---------|
| 1 | `espnEvent.season.slug` | `slugToStage` table (in `config.js`) |
| 2 | Match date | Hard-coded date range fallback |

### View Refresh Strategy

| View | ID | Auto-refresh | Trigger |
|------|----|-------------|---------|
| Schedule | `schedule` | 180s (polling-driven) | Manual button + auto timer |
| Standings | `standings` | None | Manual button only |
| Predictions | `predictions` | None | Manual button only |
| Analysis | `analysis` | None | Manual button only |

### Security

- **Content Security Policy (CSP)** — Restricts script, style, font, image, and API sources
- **XSS prevention** — All dynamically rendered content is escaped via `escapeHTML()`
- **SRI integrity** — Chart.js CDN script includes an integrity hash
- **Defensive null checks** — All DOM element references are guarded against `null`

---

## Configuration

All configuration lives in [js/config.js](js/config.js) and is exposed via `window.CONFIG`. Adjust application behavior without touching business logic.

### API Config

| Key | Default | Description |
|-----|---------|-------------|
| `ESPN_API` | `https://site.api.espn.com/.../scoreboard` | ESPN scoreboard API endpoint |
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
| `AUTO_REFRESH_INTERVAL` | `30000` (30s) | Score polling interval |

### Mapping Tables

| Key | Description |
|-----|-------------|
| `STAGE_NAMES` | Chinese stage names (group stage, round of 32, etc.) |
| `STATUS_NAMES` | Chinese status text (scheduled, live, finished) |
| `SLUG_TO_STAGE` | ESPN season.slug to internal stage identifier |
| `ESPN_STATUS_MAP` | ESPN raw status to unified internal status |
| `VENUE_TIMEZONES` | 16 venue timezone offsets and city names |
| `ODDS_TRANSLATIONS` | English-to-Chinese odds description translation rules |
| `ADVANCE_PROB_TABLE` | Group advance probability lookup table |

---

## Data Sources

### Static Data ([data.js](js/data.js))

| Category | Count | Details |
|----------|-------|---------|
| Teams | 48 | 12 groups (A–L), 4 teams per group |
| Venues | 16 | Across USA, Canada, and Mexico |
| Matches | 104 | 72 group stage + 32 knockout |

Team flags are sourced from [flagcdn.com](https://flagcdn.com), embedded as `<img>` tags in `data.js`.

### External API

All real-time data comes from **ESPN's public API** — no API key required.

| Endpoint | Purpose |
|----------|---------|
| `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` | Schedule, scores, odds, match status |

**Query parameters**: `?dates=YYYYMMDD-YYYYMMDD&limit=200`

---

## API Reference

### Match Data Structure

The `transformEspnEvent()` function converts ESPN event objects into the internal match format:

```js
{
  id: Number,           // Unique match ID
  date: String,         // Match date, e.g. "2026-06-11"
  time: String,         // Match time, e.g. "12:00"
  homeTeam: String,     // Home team abbreviation, e.g. "USA"
  awayTeam: String,     // Away team abbreviation, e.g. "CAN"
  stage: String,        // Stage: "group" | "round32" | "round16" | "quarterfinal" | "semifinal" | "thirdplace" | "final"
  group: String,        // Group label: "A" | "B" | ... | null
  venue: String,        // Venue ID
  status: String,       // "scheduled" | "live" | "finished"
  homeScore: Number,    // Home score (null before kickoff)
  awayScore: Number,    // Away score (null before kickoff)
  odds: Object,         // { provider, moneyline, spread, total }
  _espnEvent: Object    // Raw ESPN event data (for debugging)
}
```

### Core Utility Functions

| Function | Purpose |
|----------|---------|
| `escapeHTML(str)` | Escape HTML entities to prevent XSS |
| `buildFlagHtml(url, name)` | Build safe `<img>` tags with srcset for flags |
| `getTeamById(teamId, fallbackName)` | Look up team by abbreviation |
| `getVenueById(venueId)` | Look up venue by ID (includes city and timezone) |
| `getStageName(stage)` | Convert stage code to display name (uses `CONFIG.STAGE_NAMES`) |
| `getStatusText(status)` | Convert status code to display text (uses `CONFIG.STATUS_NAMES`) |
| `getVenueTimezone(venueId)` | Get venue timezone info (uses `CONFIG.VENUE_TIMEZONES`) |
| `getLocalMatchTime(dateStr, timeStr, venueId, timeUTC)` | Convert UTC time to Beijing time (UTC+8) |
| `isMatchConfirmed(match)` | Check if both teams are real (not placeholders) |
| `isMatchWithRealTeams(match)` | Check if match has real teams for prediction/odds pages |
| `normalizeProbabilities(home, draw, away)` | Normalize three probabilities to sum to 100 |
| `americanToDecimal(american)` | Convert American odds to decimal format |
| `formatDecimalOdds(american)` | Format decimal odds for display |
| `oddsToImpliedProb(american)` | Convert odds to implied probability |
| `verifyMatchTeams(event, home, away, teamMap)` | Verify ESPN event matches local team data |

### Prediction Engine Functions

| Function | Purpose |
|----------|---------|
| `parseOddsFromEspnEvent(event)` | Extract odds from ESPN event |
| `aggregateOdds(oddsInfo)` | Multi-source aggregation with `CONFIG.PROVIDER_WEIGHTS` weighting |
| `removeOverround(homeProb, drawProb, awayProb)` | Margin removal (multiplicative) |
| `analyzeOddsMovement(ml)` | Movement analysis, Sharp Money detection |
| `crossMarketAdjust(spread, total)` | Cross-market fusion with spread/totals |
| `calibrateConfidence(...)` | Multi-factor confidence calibration |
| `detectValueBet(trueProbs, ml)` | Value bet detection (edge > 2%) |
| `buildPredFallback(match)` | 5-tier fallback probability matrix |
| `derivePredictionFromOdds(oddsInfo)` | Full prediction pipeline from odds data |

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
| Data / monospace | [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) + fallback | 400–500 |

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

### Some matches show as "TBD"

Knockout stage matches (round of 32, round of 16, etc.) have unknown participants until the tournament progresses. These are shown as placeholder markers (TBD) and will automatically update when ESPN provides the actual teams.

### The odds analysis page has no data

Only DraftKings (via ESPN API) odds are currently available. If a match has no odds data, the predictions page will use the 5-tier fallback probability matrix instead.

### The page doesn't update

The Schedule view polls every 30 seconds automatically. Other views require a manual refresh click. If the ESPN API request fails due to network issues, the app will retry on the next polling cycle.

### Flag images not loading

Most flag icons are embedded in `data.js`. If a flag fails to load, the corresponding flagcdn URL may be invalid or network-restricted. Check the browser console for CSP policy blocks.

### How to adjust cache/refresh frequency

Edit `ESPN_CACHE_TTL` and `AUTO_REFRESH_INTERVAL` in [config.js](js/config.js) — no business logic changes needed.

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
