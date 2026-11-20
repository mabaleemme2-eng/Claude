import { INSTRUMENTS, type Instrument } from './instruments.js';
import { gauss } from './market.js';

export const TF = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 } as const;
export type TfKey = keyof typeof TF;
export interface Candle { time: number; open: number; high: number; low: number; close: number }

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

/** Storico sintetico: passeggiata all'indietro che termina al prezzo iniziale del simulatore. */
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
      time: end - (M1_BARS - 1 - k) * 60,
      open: r(o), close: r(c),
      high: r(Math.max(o, c) * (1 + Math.abs(gauss()) * sigma * 0.4)),
      low: r(Math.min(o, c) * (1 - Math.abs(gauss()) * sigma * 0.4)),
    });
  }
  return bars;
}

export class CandleStore {
  private data = new Map<string, Record<TfKey, Candle[]>>();

  constructor() {
    for (const i of INSTRUMENTS) {
      const m1 = genHistory(i);
      const rec = { M1: m1 } as Record<TfKey, Candle[]>;
      for (const tf of Object.keys(TF) as TfKey[]) if (tf !== 'M1') rec[tf] = aggregate(m1, TF[tf]);
      this.data.set(i.symbol, rec);
    }
  }

  /** Sostituisce lo storico sintetico di una timeframe con barre reali. */
  setSeries(symbol: string, tf: TfKey, bars: Candle[]) {
    const rec = this.data.get(symbol);
    if (rec && bars.length) rec[tf] = bars;
  }

  get(symbol: string, tf: TfKey, limit = 500): Candle[] {
    const arr = this.data.get(symbol)?.[tf] ?? [];
    return arr.slice(-limit);
  }

  /** Aggiorna tutte le timeframe con un nuovo prezzo (bid). */
  update(symbol: string, tsMs: number, price: number) {
    const rec = this.data.get(symbol);
    if (!rec) return;
    for (const tf of Object.keys(TF) as TfKey[]) {
      const sec = TF[tf];
      const t = Math.floor(tsMs / 1000 / sec) * sec;
      const arr = rec[tf];
      const last = arr[arr.length - 1];
      if (last && last.time === t) {
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.close = price;
      } else {
        arr.push({ time: t, open: last?.close ?? price, high: price, low: price, close: price });
        if (arr.length > MAX_BARS) arr.shift();
      }
    }
  }
}
