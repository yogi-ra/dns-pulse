# DNS Pulse

Real-time DNS traffic monitoring dashboard with integrated threat intelligence. Built with **Bun**, **Elysia**, **SolidJS**, and **PostgreSQL**.

<p align="center">
  <img src="https://img.shields.io/badge/bun-v1.x-fb7116?style=flat-square&logo=bun&logoColor=white" />
  <img src="https://img.shields.io/badge/elysia-v1.x-1a1a2e?style=flat-square" />
  <img src="https://img.shields.io/badge/solid-js-2c4f7c?style=flat-square&logo=solid&logoColor=white" />
  <img src="https://img.shields.io/badge/postgresql-15+-336791?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

## Overview

DNS Pulse ingests DNS query logs into PostgreSQL and surfaces them through a live-updating dashboard. Every panel auto-refreshes independently and supports configurable time ranges — from the last hour to your entire dataset.

**Core capabilities:**

- Live DNS query stream with 3-second polling
- Traffic volume timeline (area chart, hourly buckets)
- Query type distribution (donut chart)
- Top domains ranked by hit count with horizontal bar charts
- Per-client activity breakdown
- Suspicious beaconing detection (regular-interval C2 patterns)
- Shannon entropy analysis for DGA domain detection
- Threat intelligence enrichment via VirusTotal, AbuseIPDB, and community blocklists

---

## Architecture

```
┌───────────────────┐         ┌──────────────┐         ┌─────────────┐
│  DNS Data Source  │───────▶ │  PostgreSQL  │◀───────│  Elysia API │
│  (your resolver)  │  writes │  dns_queries │  reads  │  /api/*     │
└───────────────────┘         └──────────────┘    ▲    └──────┬──────┘
                                                  │           │
                                                  │    ┌──────▼──────┐
                                           threat │    │   SolidJS   │
                                           intel  │    │  Dashboard  │
                                                  │    │  (Vite)     │
                                ┌─────────────────┘    └─────────────┘
                                │
                      ┌─────────┴──────────┐
                      │   VirusTotal API   │
                      │   AbuseIPDB API    │
                      │   Community Feeds  │
                      └────────────────────┘

```

**Tech stack:**

```

| Layer       | Technology       | Role                                   |
|-------------|------------------|----------------------------------------|
| Runtime     | Bun              | Package manager + JS runtime           |
| API         | Elysia           | HTTP server, typed routes              |
| Database    | PostgreSQL       | DNS query storage, views, aggregation  |
| Frontend    | SolidJS          | Reactive UI, fine-grained rendering    |
| Bundler     | Vite             | Dev server with HMR + production build |
| Charts      | SVG (hand-rolled)| Timeline, donut, bar charts            |
| Threat Intel| VT / AbuseIPDB / | Domain + IP reputation enrichment      |
|             | StevenBlack,     |                                        |
|             | hagezi, cert.pl  |                                        |
```

---

## Project Structure

```
dns-pulse/
├── .env                    # Database URL, API keys, port
├── .env.example            # Template for contributors
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite + SolidJS plugin + API proxy
├── index.html              # Entry HTML
├── setup.mjs               # One-command frontend scaffold
├── server/
│   ├── db.ts               # PostgreSQL queries (tagged templates)
│   ├── threat-intel.ts     # VT + AbuseIPDB + blocklist enrichment
│   └── index.ts            # Elysia HTTP server, route definitions
└── src/
    ├── index.tsx            # SolidJS render entry
    ├── api.ts               # Typed API client + polling hook
    ├── styles.css           # Full dashboard stylesheet
    ├── App.tsx              # Root layout, stat cards, grid
    └── components/
        ├── DonutChart.tsx    # Query type ring chart
        ├── TimelineChart.tsx # 24h+ area chart with Y/X axes
        ├── TopDomains.tsx    # Horizontal bar chart
        ├── ClientTable.tsx   # Per-IP activity table
        ├── RecentFeed.tsx    # Live query stream
        ├── BeaconAlerts.tsx  # C2 beacon detection table
        ├── ThreatPanel.tsx   # Bulk threat intel scan results
        └── ThreatBadge.tsx   # Inline domain risk indicator
```

---

## Getting Started

### Prerequisites

- **Bun** ≥ 1.0 — [bun.sh](https://bun.sh)
- **PostgreSQL** ≥ 15 — [postgresql.org](https://www.postgresql.org/)

### 1. Clone and install

```bash
git clone https://github.com/youruser/dns-pulse.git
cd dns-pulse
bun install
```

### 2. Configure environment

```bash
cp .env.sample .env
```

Edit `.env`:

```env
# Required
DATABASE_URL=postgresql://youruser:yourpass@localhost:5432/dnslog
PORT=3000
NODE_ENV=development

# Optional — threat intelligence (free tier keys)
VIRUSTOTAL_API_KEY=
ABUSEIPDB_API_KEY=
```

> **Special characters in password?** No problem — the server URL-encodes passwords automatically.

> **API keys are optional.** Without them, the dashboard still works fully using community blocklists (StevenBlack, hagezi, cert.pl) which cover 100K+ known malicious domains.

### 3. Run

**Development** (two terminals):

```bash
# Terminal 1 — API server
bun run dev:server

# Terminal 2 — Vite dev server with HMR
bun run dev:client
```

Or both at once:

```bash
bun run dev
```

Open **http://localhost:5173**

**Production:**

```bash
bun run build    # Compiles to dist/
bun run start    # Serves API + static on PORT
```

---

## Dashboard Features

### Time Range Selector

Every panel responds to the range picker in the header:

| Range | Description |
|-------|-------------|
| `1h`  | Last hour   |
| `6h`  | Last 6 hours |
| `24h` | Last 24 hours |
| `7d`  | Last 7 days |
| `30d` | Last 30 days |
| `All` | Entire dataset — no time filter |

### Stat Cards

| Card | Source |
|------|--------|
| **Total Queries** | `SUM(hit_count)` in selected range |
| **Unique Clients** | `COUNT(DISTINCT client_ip)` |
| **Unique Domains** | `COUNT(DISTINCT query_name)` |
| **Queries/Sec** | Live — counted in last 60 seconds |
| **Alerts** | Beaconing entries matching C2 pattern |

### Query Volume Timeline

SVG area chart showing hourly query counts. Y-axis auto-scales. X-axis labels adapt to data density.

### Query Types Donut

Ring chart of query type distribution (A, AAAA, CNAME, MX, TXT, NS, etc.) with interactive legend.

### Beaconing Detection

Flags entries where:

```
hit_count > 100
AND avg_interval_sec = (last_seen - first_seen) / (hit_count - 1) < 120s
```

Regular-interval DNS queries to a single domain from a single client are a classic Command & Control beacon pattern.

### DGA Detection (Insights panel)

Computes Shannon entropy on second-level domains:

```
H(domain) = -Σ p(x) · log₂(p(x))
```

Domains with entropy > 3.5 are flagged as potentially algorithmically generated — a common indicator of malware C2 infrastructure.

### Threat Intelligence

| Source | Key Required | Coverage |
|--------|-------------|----------|
| Community blocklists | No | 100K+ domains (StevenBlack, hagezi, cert.pl) — auto-refreshed hourly |
| VirusTotal | Yes (free) | 70+ AV engines per domain, 500 req/day on free tier |
| AbuseIPDB | Yes (free) | IP reputation, 1,000 req/day on free tier |

**Threat Panel** — scans your top N domains against all sources and displays a risk-sorted table with scores, sources, and links to full reports.

**Threat Badge** — inline "check" button next to any domain in the recent feed. Click to enrich on demand.

**Risk levels:**

| Level | Score | Meaning |
|-------|-------|---------|
| `clean` | 0 | No detections |
| `low` | 1-15 | 1-2 suspicious flags |
| `medium` | 16-45 | Community blocklist hit or suspicious engines |
| `high` | 46-70 | 2+ malicious engine detections |
| `critical` | 71-100 | 5+ malicious engine detections |

---

## API Reference

All endpoints accept an optional `?range=` parameter (`1h`, `6h`, `24h`, `7d`, `30d`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats/overview` | Aggregate stats for selected range |
| `GET` | `/api/queries/recent?limit=50` | Latest queries, ordered by `last_seen` |
| `GET` | `/api/domains/top?limit=20` | Domains ranked by total hits |
| `GET` | `/api/clients?limit=20` | Clients ranked by total queries |
| `GET` | `/api/queries/types` | Query type breakdown with percentages |
| `GET` | `/api/alerts/beaconing` | Suspicious beaconing entries |
| `GET` | `/api/queries/timeline` | Hourly query count buckets |
| `GET` | `/api/insights` | DGA detection + volume metrics |
| `GET` | `/api/threat/domain/:domain` | Enrich a single domain |
| `GET` | `/api/threat/ip/:ip` | Enrich a single IP (AbuseIPDB) |
| `GET` | `/api/threat/top?limit=10` | Bulk enrich top domains |
| `GET` | `/api/threat/status` | Check which intel keys are configured |

---

## Feeding Data In

DNS Pulse reads from the `dns_queries` table from this github repo database: [DNS Server with DB](github.com/yogi-ra/dns-server-with-db-logging)

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3000` | API server port |
| `NODE_ENV` | No | `development` | `production` enables static file serving |
| `VIRUSTOTAL_API_KEY` | No | — | VirusTotal v3 API key ([get one](https://www.virustotal.com/gui/my-apikey)) |
| `ABUSEIPDB_API_KEY` | No | — | AbuseIPDB API key ([get one](https://www.abuseipdb.com/account/api)) |

### Polling Intervals

Each panel polls independently:

| Panel | Interval | Rationale |
|-------|----------|-----------|
| Stat cards / overview | 5s | Balance between freshness and load |
| Recent feed | 3s | Fast-moving data |
| Top domains / clients | 8-10s | Moderately dynamic |
| Timeline / insights | 15s | Slow-changing aggregations |
| Beaconing alerts | 20s | Rarely changes |
| Threat panel | Manual / on-load | API rate limits |

---

## Security Notes

- **API keys are never exposed to the frontend.** All enrichment happens server-side.
- **Passwords with special characters** are URL-encoded automatically by the connection string builder.
- **`.env` is gitignored.** Use `.env.example` as a template.
- **VirusTotal free tier** limits: 4 requests/minute, 500/day. The threat panel scans top N domains, not every query.
- **Community blocklists** are fetched over HTTPS and cached for 1 hour in memory.

---

## Development

```bash
# Install dependencies
bun install

# Run API with file watching
bun run dev:server

# Run Vite with HMR
bun run dev:client

# Type checking
bunx tsc --noEmit

# Production build
bun run build
bun run start
```

### Adding a new panel

1. Create `src/components/YourPanel.tsx`
2. Export a component that accepts `{ range: () => string }`
3. Use `createPolling(props.range, fetcher, interval)` for data
4. Handle three states: loading (skeleton), error (red banner), empty ("No data")
5. Import and place in `App.tsx`

### Adding a new API endpoint

1. Add the query function in `server/db.ts`
2. Add the route in `server/index.ts`
3. Add the type and fetcher in `src/api.ts`

---

## License

MIT
