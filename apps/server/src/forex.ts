import { BY_SYMBOL } from './instruments.js';
import type { RawTick } from './market.js';

/** Ordine convenzionale delle valute nei nomi delle coppie (EUR davanti a tutte, JPY in fondo). */
export const FX_ORDER = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];
/** Valute con una quotazione live disponibile (NZD manca: nessuna fonte gratuita). */
export const FX_LIVE = ['EUR', 'GBP', 'AUD', 'USD', 'CAD', 'CHF', 'JPY'];
/**
 * Coppie quotate direttamente da Kraken solo se liquide. EUR/JPY, EUR/AUD, EUR/CAD e AUD/JPY su Kraken
 * hanno spread enormi e quasi nessun aggiornamento: si calcolano dai cambi con il dollaro.
 */
export const KRAKEN_DIRECT = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'EURGBP', 'EURCHF'];
/** USD/JPY su Kraken è illiquido (centinaia di pip di spread): si prende da Hyperliquid (xyz:JPY). */
export const HL_FX: Record<string, string> = { USDJPY: 'xyz:JPY' };

export interface FxPair { symbol: string; base: string; quote: string }

/** Tutte le coppie tra le valute live (21), nell'ordine convenzionale. */
export function fxPairs(): FxPair[] {
  const list = FX_ORDER.filter((c) => FX_LIVE.includes(c));
  const out: FxPair[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push({ symbol: list[i] + list[j], base: list[i], quote: list[j] });
  return out;
}

/** Quanti USD vale 1 unità di una valuta, dai sei cambi diretti con il dollaro. */
export const USD_LEG: Record<string, { symbol: string; inverted: boolean }> = {
  EUR: { symbol: 'EURUSD', inverted: false }, GBP: { symbol: 'GBPUSD', inverted: false }, AUD: { symbol: 'AUDUSD', inverted: false },
  CAD: { symbol: 'USDCAD', inverted: true }, CHF: { symbol: 'USDCHF', inverted: true }, JPY: { symbol: 'USDJPY', inverted: true },
};

/** Calcola i cambi incrociati ogni volta che si muove uno dei cambi con il dollaro. */
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
