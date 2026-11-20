# Prezzi, spread e swap

## Flusso
`Liquidity provider (bid/ask grezzo)` → `regola di spread` → `moltiplicatore di sessione` → `prezzo cliente`.
Il prezzo medio (mid) resta quello del provider; il broker modifica solo l'ampiezza. Il bid è arrotondato per difetto e l'ask per eccesso, così l'arrotondamento non riduce mai lo spread.

## Risoluzione della regola (la prima trovata vince)
1. override del **singolo cliente** (`account.spreadOverrides`)
2. override del **gruppo per simbolo** (`group.symbolSpread`)
3. regola del **gruppo per classe** (`group.classSpread`)

## Modalità di spread
| Modalità | Spread finale |
|---|---|
| `raw` | quello del provider |
| `markup_pips` | provider + N pip |
| `markup_pct` | provider × (1 + N%) |
| `fixed` | N pip, indipendente dal provider |

`min`/`max` (in pip) limitano il risultato. La **commissione per lotto** (conti ECN) è separata, per classe di asset e per lato.

## Sessioni
Finestre orarie UTC (con giorni e classi opzionali) che moltiplicano lo spread: rollover, news, aperture. Si applica il moltiplicatore più alto tra quelle attive.

## Swap
Valore base per strumento, sovrascrivibile per gruppo. Tre unità:
- `pips`: pip per lotto per notte
- `percent`: % annua sul nozionale (÷365)
- `money`: USD per lotto

Poi: **maggiorazione del broker** (`swapMarkupPct`: aumenta gli addebiti, riduce gli accrediti), **triple swap** nel giorno impostato (mercoledì per forex/CFD, nessuno per crypto) e **swap-free** per i conti islamici. Il rollover gira all'ora UTC del gruppo (default 22:00) e si può lanciare a mano dal pannello admin.

## Gruppi predefiniti
Standard (markup), ECN (grezzo + commissione), Islamico (swap-free), Fisso (market maker).

## API admin (header `x-admin-key`)
- `GET/PUT /api/admin/pricing` · `POST /api/admin/pricing/reset`
- `GET /api/admin/preview?symbol=EURUSD&group=ecn` — grezzo vs cliente, swap effettivo
- `POST /api/admin/rollover`
