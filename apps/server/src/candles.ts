import { INSTRUMENTS, type Instrument } from './instruments.js';
import { gauss } from './market.js';

export const TF = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 } as const;
export type TfKey = keyof typeof TF;
export interface Candle { time: number; open: number; high: number; low: number; close: number }
export type CandleLoader = (tf: TfKey) => Promise<Candle[]>;

const M1_BARS = 20000;
const MAX_BARS = 6000;

function aggregate(m1: Candle[], sec: number): Candle[] {
  const out: Candle[] = [];
  for (const c of m1) {
    const t = Math.floor(c.time / sec) * sec;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
    } else out.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  return out;
}

/** Synthetic history (simulated instruments only): a backwards random walk that ends at the starting price. */
function genHistory(i: Instrument): Candle[] {
  const sigma = i.vol * Math.sqrt(240);
  const end = Math.floor(Date.now() / 60000) * 60 - 60;
  const closes: number[] = new Array(M1_BARS);
  closes[M1_BARS - 1] = i.start;
  for (let k = M1_BARS - 1; k > 0; k--) closes[k - 1] = closes[k] * Math.exp(-gauss() * sigma);
  const r = (v: number) => Number(v.toFixed(i.digits));
  const bars: Candle[] = [];
  for (let k = 1; k < M1_BARS; k++) {
    const o = closes[k - 1];
    const c = closes[k];
    bars.push({
      time: end - (M1_BARS - 1 - k) * 60, open: r(o), close: r(c),
      high: r(Math.max(o, c) * (1 + Math.abs(gauss()) * sigma * 0.4)),
      low: r(Math.min(o, c) * (1 - Math.abs(gauss()) * sigma * 0.4)),
    });
  }
  return bars;
}

/**
 * Candles per instrument and timeframe. Live instruments load real history from their source on the
 * first request (`ensure`); after that, ticks update the last bar.
 */
export class CandleStore {
  private data = new Map<string, Partial<Record<TfKey, Candle[]>>>();
  private loaders = new Map<string, CandleLoader>();
  private loaded = new Set<string>();
  private loading = new Map<string, Promise<void>>();

  constructor() {
    for (const i of INSTRUMENTS.filter((x) => x.source === 'sim')) {
      const m1 = genHistory(i);
      const rec: Partial<Record<TfKey, Candle[]>> = { M1: m1 };
      for (const tf of Object.keys(TF) as TfKey[]) if (tf !== 'M1') rec[tf] = aggregate(m1, TF[tf]);
      this.data.set(i.symbol, rec);
    }
  }

  setLoader(symbol: string, fn: CandleLoader) { this.loaders.set(symbol, fn); }

  /** Loads real history once; if the source fails, it retries on the next request. */
  async ensure(symbol: string, tf: TfKey): Promise<void> {
    const key = `${symbol}:${tf}`;
    const loader = this.loaders.get(symbol);
    if (!loader || this.loaded.has(key)) return;
    let p = this.loading.get(key);
    if (!p) {
      p = loader(tf).then((bars) => {
        if (bars.length) {
          const rec = this.data.get(symbol) ?? {};
          const live = rec[tf]?.at(-1);
          // if ticks have meanwhile opened newer bars, keep them
          const merged = live && bars.length && live.time > bars[bars.length - 1].time ? [...bars, ...rec[tf]!.filter((c) => c.time > bars[bars.length - 1].time)] : bars;
          rec[tf] = merged;
          this.data.set(symbol, rec);
          this.loaded.add(key);
        }
      }).catch((e) => console.warn(`[history] ${symbol} ${tf}:`, (e as Error).message))
        .finally(() => this.loading.delete(key));
      this.loading.set(key, p);
    }
    await p;
  }

  get(symbol: string, tf: TfKey, limit = 500): Candle[] {
    return (this.data.get(symbol)?.[tf] ?? []).slice(-limit);
  }

  /** Updates every timeframe with a new price (bid). */
  update(symbol: string, tsMs: number, price: number) {
    let rec = this.data.get(symbol);
    if (!rec) { rec = {}; this.data.set(symbol, rec); }
    for (const tf of Object.keys(TF) as TfKey[]) {
      const sec = TF[tf];
      const t = Math.floor(tsMs / 1000 / sec) * sec;
      const arr = (rec[tf] ??= []);
      const last = arr[arr.length - 1];
      if (last && last.time === t) {
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
      } else if (!last || t > last.time) {
        arr.push({ time: t, open: last?.close ?? price, high: price, low: price, close: price });
        if (arr.length > MAX_BARS) arr.shift();
      }
    }
  }
}
