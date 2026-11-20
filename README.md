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
| Catalogo di 179 strumenti: 80 crypto, 21 coppie forex, indici, metalli, energia, agricoli, 60+ azioni, con ricerca e filtri | ✅ |
| Prezzi LIVE gratuiti (176 strumenti su 179) con storico reale caricato su richiesta | ✅ Binance + Kraken + Hyperliquid, nessuna chiave |
| Ancora simulati: NZDUSD, GER40, UK100 (badge giallo) | 🟡 nessuna fonte gratuita live trovata |
| CRM (clienti, KYC, depositi/prelievi, documenti, IB, ticket, ruoli) | ⬜ prossimo |
| Database Postgres, multi-tenant, autenticazione/RBAC | ⬜ prossimo |
| Bridge/liquidity provider reale, A-book/B-book | ⬜ |
| Pagamenti (PSP, crypto) | ⬜ |

## Provarla

**Sul tuo computer** (serve Node.js 20 o più recente):
```bash
git clone https://github.com/mabaleemme2-eng/Claude.git && cd Claude
git checkout claude/trading-platform-broker-crm-woonte
npm install
npm start            # compila e avvia: apri http://localhost:4000
```
- **Dal telefono** (stessa rete Wi-Fi): apri `http://<IP-del-computer>:4000`.
- **Sviluppo** (ricarica automatica): `npm run dev` → http://localhost:5173.
- **Pannello admin**: pulsante "Admin prezzi". In locale la chiave è `dev-admin`; in produzione viene generata (o la imposti con `ADMIN_KEY`).

**Online con un link pubblico** (anche per il telefono), con Render:
1. Crea un account su render.com e collega GitHub.
2. *New + → Blueprint* → scegli questo repository e il branch → *Apply*. Legge `render.yaml` e fa tutto.
3. Dopo qualche minuto ottieni un indirizzo `https://…onrender.com`. La chiave admin è in *Environment → ADMIN_KEY*.
- Si può usare anche il `Dockerfile` su qualsiasi hosting (Fly.io, Railway, un VPS).
- Il piano gratuito va in pausa dopo un po' di inattività (il primo caricamento è lento).

**Installarla come app**: aprendo il link in Chrome/Edge compare "Installa" (programma sul computer); su iPhone Safari → Condividi → *Aggiungi a Home*; su Android Chrome → menu → *Installa app*.

Ogni browser ha il proprio conto demo (id casuale salvato nel browser), quindi più persone possono provare in parallelo senza vedersi.

```bash
npm test             # test del motore prezzi
```

## Prezzi gratuiti (nessuna chiave)

| Classe | Fonte | Note |
|---|---|---|
| Crypto (top 80 per volume, USDT≈USD) | Binance market data pubblici | tick `bookTicker` + klines reali |
| Forex: EURUSD, GBPUSD, AUDUSD, USDCAD, USDCHF, EURGBP, EURCHF | Kraken (WebSocket v2) | spread stretti |
| Forex: USDJPY | Hyperliquid `xyz:JPY` | USD/JPY su Kraken è illiquido (centinaia di pip di spread) |
| Forex: 13 incroci (GBPJPY, EURJPY, AUDCAD, …) | calcolati dai cambi con il dollaro | EUR/JPY, EUR/AUD, EUR/CAD, AUD/JPY su Kraken sono illiquidi: scartati |
| Indici, oro/argento/platino/palladio/rame, petrolio, gas, agricoli, azioni | Hyperliquid, dex `xyz` (HIP-3) | prezzi di perpetual, molto liquidi e allineati allo spot |
| NZD*, GER40, UK100 | simulati | nessuna fonte gratuita live raggiungibile |

- Il catalogo si costruisce all'avvio (`catalog.ts`): scopre i mercati liquidi di Binance e Hyperliquid; uno strumento già definito mantiene lotti e swap, cambia solo la fonte.
- Lo storico (`loaders.ts`) si scarica alla prima apertura del grafico di ogni strumento/timeframe, non all'avvio.
- Le quotazioni forex con spread assurdo vengono scartate (mercato illiquido: meglio nessun prezzo che uno falso).
- Altri dex di Hyperliquid (flx, km, cash…) hanno volume zero e prezzi vecchi: non usati. `USE_REAL_FEEDS=0` torna a tutto simulato.
- **Hyperliquid/Kraken/Binance non sono feed per la ridistribuzione**: vanno bene per demo e sviluppo, per vendere ai clienti serve una licenza.
- Swap dei cambi nuovi: derivati dal differenziale dei tassi (`catalog.ts`, valori indicativi) più una maggiorazione fissa; sono modificabili dal pannello admin.
- Contratti e lotti dei nuovi strumenti sono valori di default ragionevoli, non le specifiche di un broker reale: da rivedere.

## Struttura

- `apps/server` — API REST + WebSocket, feed, candele, motore prezzi (`pricing.ts`), motore di trading (`trading.ts`)
- `apps/terminal` — React + Vite + lightweight-charts
- `docs/PRICING.md` — come funzionano prezzi, spread e swap

## Note importanti

- I dati sono **simulati** e lo stato è in memoria: nessun valore reale.
- Grafici: oggi `lightweight-charts` (Apache 2.0, richiede l'attribuzione TradingView mostrata nel logo). La libreria *Advanced Charts* di TradingView ha licenza separata da richiedere.
- Prima di operare come broker servono licenze/regolamentazione, KYC/AML e provider di liquidità: aspetti legali da definire con consulenti.
