# Paper Trading LLM

Monorepo for a local-first paper trading desk covering global equities, ETFs/ETNs, and indices. The project wires a Next.js dashboard to an Express API backed by Prisma + SQLite with live data from Yahoo Finance (unofficial) and OpenFIGI for universal symbol search.

> **Legal notice**: Yahoo Finance data is unofficial and provided strictly for personal and educational use. Always validate prices with your broker before acting.

## What’s new (LLM → JSON → Execution)

- **LLM Automation Console** (Next.js): manage providers, per-portfolio prompts, manual runs, and execution history.
- **Strict JSON output**: the LLM is forced to return an **arbitrage JSON** that is validated against a **JSON Schema** before any action.
- **End-to-end runner** (Express): assembles context (positions, cash, history, quotes), calls the configured provider, validates the JSON, and **executes paper trades**.
- **Providers & keys**: supports **OpenAI-compatible** endpoints (OpenAI, Perplexity API, Anyscale, vLLM proxy) and **local vLLM** via custom `apiBase`. Keys/configs are stored per provider.
- **Persistence**: providers, prompts, and executions are persisted in SQLite (string-serialized payloads for compatibility).

## Stack

- **pnpm workspaces** with apps and shared packages.
- **apps/web**: Next.js (App Router, TypeScript, Tailwind CSS, react-query, react-chartjs-2, fuse.js).
- **apps/server**: Express + TypeScript, yahoo-finance2, Prisma client, LRU caches, rate limiting.
- **packages/db**: Prisma schema + SQLite database (`./data/trader.db`).
- **packages/server-shared**: MIC ? Yahoo Finance suffix mapping helpers.

## Features

- Global autocomplete backed by OpenFIGI with optional API key and Yahoo fallback to cover venues beyond the MIC mapping.
- Persistent symbol resolution cache (SQLite) for auditability.
- LLM planner pipeline (JSON-schema constrained): Express exposes provider/prompt/execution endpoints; Next.js console orchestrates runs and displays history.
- Market data endpoints with in-memory TTL caching (5 min quotes / 15 min history) and optional Stooq EOD fallback (`ENABLE_STOOQ_FALLBACK`).
- Portfolio endpoints to fetch current holdings, PnL, trade history, and to record simulated trades with weighted-average pricing logic.
- Next.js dashboard with:
  - Global search bar (debounced + fuzzy ranking via fuse.js).
  - Portfolio summary metrics, positions table, and a reconstructed equity curve.
  - Symbol detail pages with mini quote, historical chart (1M/6M/1Y), and inline trade form.
  - Trades page with filtering (date, symbol, side) and on-the-fly PnL estimates using latest prices.
  - **LLM Automation Console** (`/llm`) to manage providers, prompts, manual runs, and execution history.
- Vitest coverage for portfolio math and MIC mapping helpers.
- ESLint + Prettier with strict TypeScript settings.

## Getting started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Installation

```bash
pnpm install        # Installs deps (Prisma client generated automatically)
# initialise / migrate the SQLite schema
npx prisma@5.22.0 db push --schema packages/db/prisma/schema.prisma --skip-generate
pnpm -w run dev     # Starts API (4000) and web app (5000) concurrently
```

The API listens on `http://localhost:4000` and the web UI on `http://localhost:5000`.

### Environment variables

Copy `.env.example` to `.env` (root) and adjust as needed:

- `OPENFIGI_API_KEY` (optional): raises OpenFIGI rate limit to 20 req/min.
- `CLIENT_ORIGIN`: comma-separated origins allowed by the API CORS middleware.
- `PORT` (optional): override the API port if you need something other than `4000`.
- `ENABLE_STOOQ_FALLBACK`: set to `true` to enable the Stooq EOD backup when Yahoo fails.

SQLite data lives in `./data/trader.db`. Prisma creates the database file automatically on first access.

### Useful scripts

```bash
pnpm -w run lint                        # ESLint across workspaces
pnpm -w run test                        # Runs Vitest suites (currently in apps/server)
pnpm --filter @paper-trading/server test   # Focus on server tests
pnpm --filter @paper-trading/server build  # Typecheck server with production tsconfig
```

## API snapshot

| Endpoint | Description |
| --- | --- |
| `GET /healthz` | Service health probe. |
| `GET /api/search?q=...&types=` | OpenFIGI-backed universal search with asset-class filters. |
| `GET /api/quote?symbol=` | Latest quote snapshot (price, change, market state). |
| `GET /api/history?symbol=&range=&interval=` | Historical OHLCV data (default `range=1y`, `interval=1d`). |
| `GET /api/portfolio` | Portfolio summary with positions and live PnL. |
| `GET /api/trades` | Trade ledger (paper trades). |
| `GET /api/llm/providers` | List configured LLM providers. |
| `POST /api/llm/providers` | Create/update providers (DELETE `/api/llm/providers/:id`). |
| `GET /api/portfolios/:id/prompts` | Manage portfolio prompt templates (POST/PUT/DELETE). |
| `POST /api/portfolios/:id/llm/run` | Trigger the LLM pipeline (supports overrides & dry run). |
| `GET /api/portfolios/:id/llm/executions` | Recent LLM executions for a portfolio. |
| `POST /api/trades` | Record a trade `{ symbol, side, qty, price? }` (price optional -> uses latest quote). |

Rate limiting: 60 req/min/IP. Quotes/histories cache responses in memory per TTL.

## Symbol resolution & MIC mapping

- Primary lookup uses OpenFIGI `/v3/search` with batching + in-memory throttle.
- `packages/server-shared/src/mic-to-yahoo.ts` maps ~20 common MIC codes (Paris, LSE, TSX, ASX, HKEX, NSE, B3, etc.) to Yahoo suffixes. TODO marker included for additional venues.
- Fallback uses `yahooFinance.search` to catch indices (Adds prefix `^`) or unsupported MICs.
- Resolutions are persisted in the `SymbolResolution` table for reuse and audit.

## Data & caching notes

- Yahoo Finance usage is best-effort; expect occasional rate limiting or symbol mismatches. The Stooq fallback can provide EOD data when Yahoo is down (enable with `ENABLE_STOOQ_FALLBACK=true`).
- In-memory caches (`lru-cache`) keep the hottest quotes/history for 5/15 minutes respectively to reduce external API load.

## Testing

Vitest suites live under `apps/server/test`:

- `portfolio.test.ts` covers trade application logic, weighted-average pricing, and PnL math.
- `mic-to-yahoo.test.ts` validates representative MIC mappings and suffix application.

Run with:

```bash
pnpm --filter @paper-trading/server test
```

## Project structure

```
apps/
  server/           Express API (TypeScript)
  web/              Next.js App Router front-end
packages/
  db/               Prisma schema + client wrapper
  server-shared/    MIC ? Yahoo helpers and exports
```

Enjoy building strategies in a safe simulated environment!




