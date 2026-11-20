# BrokerOS — white-label broker platform

Goal: a product to sell to companies that want to open a broker: **CRM/back office + client portal + trading terminal + pricing engine**.

## Current status (v0.1)

| Module | Status |
|---|---|
| Web terminal (candles/line/area charts, SMA/EMA/Bollinger, market/limit/stop orders, SL/TP, positions, history) | ✅ working |
| Mobile layout + installable app (PWA) | ✅ working |
| Multi-language UI: English (base), Spanish, Italian, French, Portuguese — language menu in the top bar | ✅ working |
| Pricing engine: spreads by group/class/symbol/client, widening sessions, commissions | ✅ + tests |
| Swap engine: pips/%/USD, triple swap, broker markup, Islamic accounts, rollover | ✅ + tests |
| Trading engine: margin, leverage, P&L, SL/TP, pending orders, stop-out | ✅ (in memory) |
| Pricing admin panel with raw vs client price preview | ✅ |
| Catalog of 179 instruments: 80 crypto, 21 forex pairs, indices, metals, energy, agriculture, 60+ stocks, with search and filters | ✅ |
| LIVE free prices (176 of 179 instruments) with real history loaded on demand | ✅ Binance + Kraken + Hyperliquid, no keys |
| Still simulated: NZDUSD, GER40, UK100 (yellow badge) | 🟡 no free live source found |
| CRM (clients, KYC, deposits/withdrawals, documents, IBs, tickets, roles) | ⬜ next |
| Postgres, multi-tenant, authentication/RBAC | ⬜ next |
| Real liquidity-provider bridge, A-book/B-book | ⬜ |
| Payments (PSPs, crypto) | ⬜ |

## Try it

**On your computer** (requires Node.js 20 or newer):
```bash
git clone https://github.com/mabaleemme2-eng/Claude.git && cd Claude
git checkout claude/trading-platform-broker-crm-woonte
npm install
npm start            # builds and starts: open http://localhost:4000
```
- **From your phone** (same Wi-Fi): open `http://<computer-IP>:4000`.
- **Development** (hot reload): `npm run dev` → http://localhost:5173.
- **Admin panel**: the "Pricing admin" button. Locally the key is `dev-admin`; in production it is generated (or set it with `ADMIN_KEY`).

**Online with a public link** (also for mobile), using Render:
1. Create an account at render.com and connect GitHub.
2. *New + → Blueprint* → pick this repository and branch → *Apply*. It reads `render.yaml` and does the rest.
3. After a few minutes you get an `https://…onrender.com` address. The admin key is under *Environment → ADMIN_KEY*.
- The `Dockerfile` also works on any host (Fly.io, Railway, a VPS).
- The free plan sleeps after a while without traffic (the first load is slow).

**Install as an app**: opening the link in Chrome/Edge shows "Install" (a desktop program); on iPhone Safari → Share → *Add to Home Screen*; on Android Chrome → menu → *Install app*.

Every browser gets its own demo account (random id stored in the browser), so several people can try it in parallel without seeing each other.

```bash
npm test             # pricing engine tests
```

## Browser-only demo (no server)

A full version of the terminal that runs entirely in the browser: the real pricing/trading engine and the real REST handler (`apps/server/src/routes.ts`) execute inside the page. Prices are a **snapshot of the real market** (`apps/terminal/demo-data`, taken with `npm run snapshot` against a running server) **continued by a random-walk simulator**, so there are no live prices in this mode. Orders, margin, spreads, swaps, the pricing admin panel (no key needed) and the five languages all work.

```bash
npm run build:demo   # builds apps/terminal/dist-demo (index.html for local use, page.html for hosts that wrap pages)
```
It needs only static hosting (GitHub Pages, Netlify, an Artifact page…). Pricing changes made in the demo are kept in the browser's localStorage.

## Languages

English is the base language. The menu in the top bar switches between English, Español, Italiano, Français and Português; the choice is remembered in the browser, and the first visit uses the browser's language when supported.

All texts live in `apps/terminal/src/i18n.ts`. To add a language: add it to `LANGS` and `LOCALES`, then create a dictionary with the same keys (the TypeScript compiler fails if a key is missing). Server error messages stay in English and are translated by the client (`tErr`). Default group names and commodity names are translated; custom group names you create keep the text you typed.

## Free prices (no keys)

| Class | Source | Notes |
|---|---|---|
| Crypto (top 80 by volume, USDT≈USD) | Binance public market data | `bookTicker` ticks + real klines |
| Forex: EURUSD, GBPUSD, AUDUSD, USDCAD, USDCHF, EURGBP, EURCHF | Kraken (WebSocket v2) | tight spreads |
| Forex: USDJPY | Hyperliquid `xyz:JPY` | USD/JPY on Kraken is illiquid (hundreds of pips of spread) |
| Forex: 13 crosses (GBPJPY, EURJPY, AUDCAD, …) | calculated from the USD pairs | EUR/JPY, EUR/AUD, EUR/CAD, AUD/JPY on Kraken are illiquid: discarded |
| Indices, gold/silver/platinum/palladium/copper, oil, gas, agriculture, stocks | Hyperliquid, `xyz` dex (HIP-3) | perpetual prices, very liquid and aligned with spot |
| NZD pairs, GER40, UK100 | simulated | no free live source reachable |

- The catalog is built at startup (`catalog.ts`): it discovers the liquid markets of Binance and Hyperliquid; an instrument that is already defined keeps its lots and swap, only its source changes.
- History (`loaders.ts`) is downloaded the first time a chart is opened for each instrument/timeframe, not at startup.
- Forex quotes with an absurd spread are discarded (illiquid market: better no price than a false one).
- Other Hyperliquid dexes (flx, km, cash…) have zero volume and stale prices: not used. `USE_REAL_FEEDS=0` goes back to fully simulated prices.
- **Binance, Kraken and Hyperliquid are not redistribution feeds**: fine for demos and development; selling to clients requires a redistribution licence.
- Swaps of the newly created pairs are derived from the interest-rate differential (`catalog.ts`, indicative values) plus a fixed markup; they can be edited from the admin panel.
- Contract sizes and lots of the new instruments are reasonable defaults, not the specifications of a real broker: to be reviewed.

## Structure

- `apps/server` — REST API + WebSocket, feeds, candles, pricing engine (`pricing.ts`), trading engine (`trading.ts`)
- `apps/terminal` — React + Vite + lightweight-charts
- `docs/PRICING.md` — how prices, spreads and swaps work

## Important notes

- Demo accounts live in memory and reset when the server restarts; there is no database yet.
- Charts: today `lightweight-charts` (Apache 2.0, requires the TradingView attribution shown in the logo). TradingView's *Advanced Charts* library has a separate licence to request.
- Before operating as a broker you need licences/regulation, KYC/AML and a liquidity provider: legal aspects to settle with advisers.
