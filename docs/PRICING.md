# Prices, spreads and swaps

## Flow
`Liquidity provider (raw bid/ask)` → `spread rule` → `session multiplier` → `client price`.
The mid price stays the provider's; the broker only changes the width. The bid is rounded down and the ask rounded up, so rounding never reduces the spread.

## Rule resolution (the first one found wins)
1. override for the **individual client** (`account.spreadOverrides`)
2. **group override per symbol** (`group.symbolSpread`)
3. **group rule per asset class** (`group.classSpread`)

## Spread modes
| Mode | Final spread |
|---|---|
| `raw` | the provider's |
| `markup_pips` | provider + N pips |
| `markup_pct` | provider × (1 + N%) |
| `fixed` | N pips, independent of the provider |

`min`/`max` (in pips) clamp the result. The **commission per lot** (ECN accounts) is separate, per asset class and per side.

## Sessions
UTC time windows (with optional days and classes) that multiply the spread: rollover, news, market opens. The highest multiplier among the active ones applies.

## Swap
Base value per instrument, overridable per group. Three units:
- `pips`: pips per lot per night
- `percent`: annual % of notional (÷365)
- `money`: USD per lot

On top: the **broker markup** (`swapMarkupPct`: increases charges, reduces credits), **triple swap** on the configured weekday (Wednesday for forex/CFDs, none for crypto) and **swap-free** for Islamic accounts. The rollover runs at the group's UTC hour (default 22:00) and can be triggered by hand from the admin panel.

## Default groups
Standard (markup), ECN (raw + commission), Islamic (swap-free), Fixed (market maker).

## Admin API (header `x-admin-key`)
- `GET/PUT /api/admin/pricing` · `POST /api/admin/pricing/reset`
- `GET /api/admin/preview?symbol=EURUSD&group=ecn` — raw vs client, effective swap
- `POST /api/admin/rollover`
