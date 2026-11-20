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
| Feed prezzi | 🟡 simulato (interfaccia `PriceFeed` pronta per un provider reale) |
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

## Struttura

- `apps/server` — API REST + WebSocket, feed, candele, motore prezzi (`pricing.ts`), motore di trading (`trading.ts`)
- `apps/terminal` — React + Vite + lightweight-charts
- `docs/PRICING.md` — come funzionano prezzi, spread e swap

## Note importanti

- I dati sono **simulati** e lo stato è in memoria: nessun valore reale.
- Grafici: oggi `lightweight-charts` (Apache 2.0, richiede l'attribuzione TradingView mostrata nel logo). La libreria *Advanced Charts* di TradingView ha licenza separata da richiedere.
- Prima di operare come broker servono licenze/regolamentazione, KYC/AML e provider di liquidità: aspetti legali da definire con consulenti.
