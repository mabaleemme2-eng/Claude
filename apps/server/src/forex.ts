import { BY_SYMBOL } from './instruments.js';
import type { RawTick } from './market.js';

/** Conventional currency order in pair names (EUR first, JPY last). */
export const FX_ORDER = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];
/** Currencies with a live quote available (NZD is missing: no free source). */
export const FX_LIVE = ['EUR', 'GBP', 'AUD', 'USD', 'CAD', 'CHF', 'JPY'];
/**
 * Pairs quoted directly by Kraken, only if liquid. EUR/JPY, EUR/AUD, EUR/CAD and AUD/JPY on Kraken have
 * huge spreads and almost no updates: they are calculated from the USD pairs instead.
 */
export const KRAKEN_DIRECT = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'EURGBP', 'EURCHF'];
/** USD/JPY on Kraken is illiquid (hundreds of pips of spread): taken from Hyperliquid (xyz:JPY). */
export const HL_FX: Record<string, string> = { USDJPY: 'xyz:JPY' };

export interface FxPair { symbol: string; base: string; quote: string }

/** All pairs between the live currencies (21), in conventional order. */
export function fxPairs(): FxPair[] {
  const list = FX_ORDER.filter((c) => FX_LIVE.includes(c));
  const out: FxPair[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push({ symbol: list[i] + list[j], base: list[i], quote: list[j] });
  return out;
}

/** How many USD one unit of a currency is worth, from the six direct USD pairs. */
export const USD_LEG: Record<string, { symbol: string; inverted: boolean }> = {
  EUR: { symbol: 'EURUSD', inverted: false }, GBP: { symbol: 'GBPUSD', inverted: false }, AUD: { symbol: 'AUDUSD', inverted: false },
  CAD: { symbol: 'USDCAD', inverted: true }, CHF: { symbol: 'USDCHF', inverted: true }, JPY: { symbol: 'USDJPY', inverted: true },
};

/** Calculates the cross rates whenever one of the USD pairs moves. */
export class CrossBuilder {
  private usd = new Map<string, { bid: number; ask: number }>();
  constructor(private crosses: FxPair[]) {}

  private val(c: string) { return c === 'USD' ? { bid: 1, ask: 1 } : this.usd.get(c); }

  handle(t: RawTick, emit: (t: RawTick) => void) {
    const leg = Object.entries(USD_LEG).find(([, l]) => l.symbol === t.symbol);
    if (!leg) return;
    const [ccy, { inverted }] = leg;
    this.usd.set(ccy, inverted ? { bid: 1 / t.ask, ask: 1 / t.bid } : { bid: t.bid, ask: t.ask });
    for (const c of this.crosses) {
      if (c.base !== ccy && c.quote !== ccy) continue;
      const A = this.val(c.base);
      const B = this.val(c.quote);
      if (A && B && BY_SYMBOL.has(c.symbol)) emit({ symbol: c.symbol, bid: A.bid / B.ask, ask: A.ask / B.bid, time: t.time });
    }
  }
}
