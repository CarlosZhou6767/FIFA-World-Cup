# 2026 FIFA World Cup Dashboard

<p align="center">
  <strong>United States &middot; Canada &middot; Mexico</strong><br>
  <em>June 11 – July 19, 2026</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-yellow" alt="JavaScript">
  <img src="https://img.shields.io/badge/HTML-5-orange" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS-3-blue" alt="CSS3">
  <img src="https://img.shields.io/badge/Chart.js-4.4.7-green" alt="Chart.js">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/no--build-tools-success" alt="No Build Tools">
</p>

---

A lightweight, zero-dependency single-page application for tracking the 2026 FIFA World Cup in real time. Built with vanilla JavaScript, HTML, and CSS — no frameworks, no build tools, no backend, no API key required. All live data is powered by ESPN's public API.

The app features five views: **Schedule**, **Standings**, **Knockout Bracket**, **Predictions**, and **Odds Analysis**, covering all 104 matches across 12 groups and 7 knockout rounds.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Data Sources](#data-sources)
- [Design System](#design-system)
- [Browser Support](#browser-support)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The 2026 FIFA World Cup (June 11 – July 19, 2026) is the first edition with 48 teams, co-hosted by the United States, Canada, and Mexico across 16 venues. This dashboard provides a comprehensive, real-time tracking experience with match schedules, live scores, group standings, an interactive knockout bracket, odds-driven predictions, and historical odds trend analysis.

The entire project is a pure front-end SPA — just open `index.html` in a browser and it works. ESPN's public API supports CORS, so no proxy server is needed.

---

## Core Features

### 1. Schedule

- **104 matches** across 12 groups (A–L) and 7 knockout rounds, grouped and rendered by stage
- Match cards feature a vertical Flexbox layout with a top gradient color bar indicating the stage:
  - Group stage: gray gradient
  - Round of 32 / Round of 16: red gradient
  - Quarterfinals: red-to-orange gradient
  - Semifinals: red-to-gold gradient (thicker bar)
  - Final: animated gold-to-red shimmer bar (thicker bar)
  - Live matches: animated red shimmer bar
- Each card shows: stage badge, status tag, time (Beijing UTC+8), team flags, team names, FIFA rankings, score or "VS", venue, and group label
- Multi-dimensional filtering: by stage, group, date, and team-name search
- Real-time status badges — `Scheduled` / `Live` / `Finished` — with live score display
- **30-second polling** from ESPN for live score synchronization
- Manual refresh button with countdown timer

### 2. Standings

- **12 groups (A–L)** with automatic ranking calculation
- Tiebreaker rules: points → goal difference → goals scored → head-to-head → team name
- Manual refresh only — no auto-polling to avoid unnecessary API calls
- Dynamic synchronization with ESPN live match data

### 3. Knockout Bracket (Road to the Final)

- Complete knockout bracket from the Round of 32 through to the Final
- Visual bracket tree showing advancement paths
- Placeholder teams (e.g., "Group A Winner") auto-update as the tournament progresses
- Third-place match included

### 4. Predictions

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

### 5. Odds Analysis Center

- Interactive trend chart (Chart.js 4.4.7) displaying historical odds movement
- **Providers**: DraftKings, Bet365, Caesars, ESPN (via ESPN API)
- **Odds types**: Moneyline / Spread / Totals
- Single-match deep-dive with full odds detail popup
- Historical odds snapshot storage via `localStorage`
- Data export functionality for offline analysis (JSON)

---

## Installation

### Prerequisites

- A modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Internet connection (for ESPN API and Google Fonts)
- No server, build tools, or npm dependencies required

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
```

Then visit `http://localhost:8080`.

---

## Usage Guide

### Navigating the App

The top navigation bar provides five views:

| Tab | What It Shows | When to Use |
|-----|---------------|-------------|
| **Schedule** | All 104 matches grouped by stage | Follow match timelines, check scores |
| **Standings** | 12 group tables with rankings | Track tournament progress per group |
| **Knockout** | Interactive bracket tree | Visualize the road to the final |
| **Predictions** | Win probability forecasts | Evaluate odds, find value bets |
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
| `STATUS_NAMES` | 7 status Chinese text (scheduled, live, halftime, finished, postponed, delayed, canceled) |
| `SLUG_TO_STAGE` | ESPN season.slug to internal stage identifier |
| `ESPN_STATUS_MAP` | 20+ ESPN raw statuses to unified internal statuses |
| `ESPN_STATUS_DETAIL` | 14 ESPN statuses with Chinese and English descriptions |
| `VENUE_TIMEZONES` | 16 venue timezone offsets, abbreviations, and city names |
| `ODDS_TRANSLATIONS` | 30+ English-to-Chinese odds description translation rules |
| `TEAM_MAP` | 48+ ESPN team abbreviations to internal team IDs |
| `ESPN_VENUE_IDS` | Set of 16 World Cup venue IDs for validation |

---

## Project Structure

```
FIFA-World-Cup/
├── index.html                  # SPA entry point (5 views + 2 modals)
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
│   ├── knockoutView.js         # Knockout bracket tree rendering
│   ├── main.js                 # App initialization, view switching, auto-refresh timer
│   └── liveScores.js           # Real-time score polling (30s interval)
├── .gitignore
├── README.md                   # English documentation
└── README-CN.md                # Chinese documentation
```

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
    ├── knockoutView.js        │  (knockout bracket)
    ├── oddsEngine.js          │  (prediction + chart)
    ├── predictionsView.js     │  (prediction UI + modals)
    └── liveScores.js ─────────┘  (30s polling → WORLD_CUP_DATA)
               │
               ▼
          main.js (init + view switching + auto-refresh)
```

### Script Loading Order

```
config.js → data.js → utils.js → apiClient.js → scheduleView.js → oddsEngine.js → predictionsView.js → knockoutView.js → main.js → liveScores.js
```

### Caching Strategy

All ESPN API requests are managed by a unified cache layer in `apiClient.js`:

| Cache | TTL | Capacity | Eviction |
|-------|-----|----------|----------|
| `espnCache` | 180s | 20 entries | LRU (oldest) |
| `matchOddsCache` | 300s | 50 entries | Expiry + LRU |

**Key optimizations:**

- **Request deduplication** — Concurrent requests to the same endpoint share a single Promise
- **Browser HTTP caching** — `cache: 'default'` for normal requests, `'reload'` for forced refreshes
- **Match indexing** — `Map`-based O(1) lookups (`MATCH_INDEX_BY_ID`, `MATCH_INDEX_BY_DATE_TEAMS`)
- **GPU-accelerated animations** — CSS `translate3d` / `will-change` / `contain`
- **Event delegation** — Container-level event listeners for card lists
- **Content deduplication** — Schedule rendering compares ID+score+status fingerprints to avoid redundant DOM updates
- **Double rAF** — Dual `requestAnimationFrame` delay for smooth CSS transition animations

### Security

- **Content Security Policy (CSP)** — Restricts script, style, font, image, and API sources
- **XSS prevention** — All dynamically rendered content is escaped via `escapeHTML()`
- **SRI integrity** — Chart.js CDN script includes an integrity hash
- **Defensive null checks** — All DOM element references are guarded against `null`
- **Knockout placeholder filtering** — Non-group-stage matches with TBD teams are excluded from predictions

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

## Design System

### Color Palette

The design uses a red (brand) + gold (accent) palette on a light neutral background.

| CSS Variable | Value | Usage |
|-------------|-------|-------|
| `--primary` | `#dc2626` | Brand color, navigation, primary actions |
| `--primary-light` | `#ef4444` | Hover states, gradients |
| `--primary-dark` | `#b91c1c` | Active states |
| `--accent` | `#eab308` | Gold accents, final-stage highlights |
| `--accent-light` | `#facc15` | Gold hover states |
| `--bg` | `#f9fafb` | Page background |
| `--card-bg` | `#ffffff` | Card backgrounds |
| `--text` | `#111827` | Headings, primary text |
| `--text-secondary` | `#4b5563` | Body text |
| `--text-tertiary` | `#9ca3af` | Secondary descriptions |
| `--glass-bg` | `rgba(255,255,255,0.82)` | Glassmorphism card background |
| `--glass-border` | `rgba(0,0,0,0.06)` | Glass card border |

### Typography

| Role | Font | Weight |
|------|------|--------|
| Display & numerals | [Exo 2](https://fonts.google.com/specimen/Exo+2) | 300–900 |
| Chinese & body text | [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) | 300–700 |

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

Knockout stage matches (round of 32, round of 16, etc.) have unknown participants until the tournament progresses. These are shown as placeholder markers (e.g., "Group A Winner") and are filtered out from the Predictions page. They will automatically update when ESPN provides the actual teams.

### The Predictions page only shows group-stage matches

This is intentional. Knockout-stage matches have TBD participants and cannot be meaningfully predicted. The Predictions page uses FIFA ranking-based Elo modeling for matches without odds data, and filters out non-group-stage matches entirely.

### The odds analysis page has no data for some providers

Provider availability varies by match. If a provider (e.g., Bet365, Caesars) has no odds data for a selected match, its tab button is automatically hidden. The app defaults to the first available provider.

### The page doesn't update

The Schedule view has an auto-refresh countdown timer. Other views require a manual refresh click. The `liveScores.js` module polls ESPN every 30 seconds independently. If an API request fails due to network issues, the app will retry on the next cycle.

### Flag images not loading

Flag images are sourced from [flagcdn.com](https://flagcdn.com). If a flag fails to load, the URL may be invalid or the network may be restricted. Check the browser console for CSP policy blocks or network errors.

### How to adjust cache/refresh frequency

Edit `ESPN_CACHE_TTL`, `ODDS_CACHE_TTL`, and `AUTO_REFRESH_INTERVAL` in [config.js](js/config.js). No business logic changes needed.

---

## Contributing

Contributions are welcome. Before submitting code, please ensure:

1. All match data must come from ESPN API — no hardcoded static data
2. Dynamically rendered content must be escaped via `escapeHTML()` to prevent XSS
3. New features must include defensive null checks to prevent white screens
4. Configuration parameters should be added to `window.CONFIG` in [config.js](js/config.js), not hardcoded
5. New Chinese text should be added to the mapping tables or translation rules in `config.js`, not inline in rendering logic
6. Follow the existing BEM naming convention for CSS classes

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
