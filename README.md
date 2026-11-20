# BrokerOS — piattaforma white-label per broker

Obiettivo: prodotto vendibile a società che vogliono aprire un broker: **CRM/back office + portale cliente + terminale di trading + motore prezzi**.

## Stato attuale (v0.1)

| Modulo | Stato |
|---|---|
| Terminale web (grafici candele/linea/area, SMA/EMA/Bollinger, ordini market/limit/stop, SL/TP, posizioni, storico) | ✅ funzionante |
| Motore prezzi: spread per gruppo/classe/simbolo/cliente, sessioni di allargamento, commissioni | ✅ + test |
| Motore swap: pip/%/USD, triple swap, markup broker, conto islamico, rollover | ✅ + test |
| Motore di trading: margine, leva, P&L, SL/TP, pendenti, stop-out | ✅ (in memoria) |
| Pannello admin prezzi con anteprima grezzo vs cliente | ✅ |
| Prezzi LIVE gratuiti: crypto (Binance) e forex EUR/GBP/JPY + crociere, indici, oro, argento, petrolio, azioni (Hyperliquid) | ✅ WebSocket + storico reale, nessuna chiave |
| Ancora simulati: AUDUSD, USDCAD, USDCHF, NZDUSD, GER40, UK100 | 🟡 nessuna fonte gratuita live trovata |
| CRM (clienti, KYC, depositi/prelievi, documenti, IB, ticket, ruoli) | ⬜ prossimo |
| Database Postgres, multi-tenant, autenticazione/RBAC | ⬜ prossimo |
| Bridge/liquidity provider reale, A-book/B-book | ⬜ |
| Pagamenti (PSP, crypto) | ⬜ |

## Avvio

```bash
npm install
npm run dev          # server :4000 + terminale :5173
npm test             # test del motore prezzi
```
Apri http://localhost:5173. Chiave admin di sviluppo: `dev-admin` (variabile `ADMIN_KEY`).

## Prezzi gratuiti

- **Crypto**: Binance market data pubblici (`data-stream.binance.vision`, `data-api.binance.vision`). USDT trattato come USD.
- **Forex, indici, oro/argento/petrolio, azioni**: Hyperliquid, mercati HIP-3 del dex `xyz` (`api.hyperliquid.xyz`). Sono prezzi di *perpetual* molto liquidi e allineati allo spot (verificato: oro 3.622 vs PAXG 3.614, EUR 1,0977 vs EURUSDT 1,0979), ma non il feed interbancario. Gli altri dex di Hyperliquid hanno volume zero e prezzi vecchi: non usati. EURGBP/EURJPY/GBPJPY sono calcolati dalle componenti.
- **Ancora simulati**: AUDUSD, USDCAD, USDCHF, NZDUSD, GER40, UK100.
- `USE_REAL_FEEDS=0` torna a tutto simulato. Yahoo Finance non ufficiale risponde 429 dal cloud: scartato.
- I feed gratuiti vanno bene per demo e sviluppo: per vendere ai clienti serve una licenza di ridistribuzione.

## Struttura

- `apps/server` — API REST + WebSocket, feed, candele, motore prezzi (`pricing.ts`), motore di trading (`trading.ts`)
- `apps/terminal` — React + Vite + lightweight-charts
- `docs/PRICING.md` — come funzionano prezzi, spread e swap

## Note importanti

- I dati sono **simulati** e lo stato è in memoria: nessun valore reale.
- Grafici: oggi `lightweight-charts` (Apache 2.0, richiede l'attribuzione TradingView mostrata nel logo). La libreria *Advanced Charts* di TradingView ha licenza separata da richiedere.
- Prima di operare come broker servono licenze/regolamentazione, KYC/AML e provider di liquidità: aspetti legali da definire con consulenti.
