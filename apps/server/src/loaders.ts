import { BY_SYMBOL, INSTRUMENTS } from './instruments.js';
import { USD_LEG, fxPairs } from './forex.js';
import { HL_INFO } from './hyperliquid.js';
import { requestJson } from './httpJson.js';
import { BINANCE_REST } from './market.js';
import type { Candle, CandleStore, TfKey } from './candles.js';

const BINANCE_INTERVAL: Record<TfKey, string> = { M1: '1m', M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1d' };
const HL_INTERVAL: Record<TfKey, { id: string; ms: number }> = {
  M1: { id: '1m', ms: 60_000 }, M5: { id: '5m', ms: 300_000 }, M15: { id: '15m', ms: 900_000 },
  H1: { id: '1h', ms: 3_600_000 }, H4: { id: '4h', ms: 14_400_000 }, D1: { id: '1d', ms: 86_400_000 },
};
const KRAKEN_INTERVAL: Record<TfKey, number> = { M1: 1, M5: 5, M15: 15, H1: 60, H4: 240, D1: 1440 };
const KRAKEN_REST = process.env.KRAKEN_REST ?? 'https://api.kraken.com';

async function binanceBars(pair: string, tf: TfKey): Promise<Candle[]> {
  const rows = await requestJson<[number, string, string, string, string][]>(
    `${BINANCE_REST}/api/v3/klines?symbol=${pair}&interval=${BINANCE_INTERVAL[tf]}&limit=1000`);
  return rows.map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}

async function hlBars(coin: string, tf: TfKey): Promise<Candle[]> {
  const { id, ms } = HL_INTERVAL[tf];
  const end = Date.now();
  const rows = await requestJson<{ t: number; o: string; h: string; l: string; c: string }[]>(HL_INFO, {
    type: 'candleSnapshot', req: { coin, interval: id, startTime: end - 1000 * ms, endTime: end },
  });
  return rows.map((k) => ({ time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c }));
}

// short cache: crosses reuse the same USD pairs
const krakenCache = new Map<string, { at: number; p: Promise<Candle[]> }>();
function krakenBars(pair: string, tf: TfKey): Promise<Candle[]> {
  const key = `${pair}:${tf}`;
  const hit = krakenCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.p;
  const p = requestJson<{ error: string[]; result: Record<string, unknown> }>(
    `${KRAKEN_REST}/0/public/OHLC?pair=${pair}&interval=${KRAKEN_INTERVAL[tf]}`).then((d) => {
    if (d.error?.length) throw new Error(d.error.join(','));
    const k = Object.keys(d.result).find((x) => x !== 'last')!;
    return (d.result[k] as [number, string, string, string, string][]).map((r) => ({ time: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] }));
  });
  p.catch(() => krakenCache.delete(key));
  krakenCache.set(key, { at: Date.now(), p });
  return p;
}

const invert = (b: Candle[]): Candle[] => b.map((x) => ({ time: x.time, open: 1 / x.open, high: 1 / x.low, low: 1 / x.high, close: 1 / x.close }));

/** "USD per 1 unit" series of a currency. */
async function usdSeries(ccy: string, tf: TfKey): Promise<Candle[]> {
  if (ccy === 'USD') return [];
  const leg = USD_LEG[ccy];
  const li = BY_SYMBOL.get(leg.symbol)!;
  const bars = li.source === 'hyperliquid' ? await hlBars(li.feedId!, tf) : await krakenBars(leg.symbol, tf);
  return leg.inverted ? invert(bars) : bars;
}

/** Ratio of two series; where one of them did not trade (missing bars) the last known price is carried forward. */
function divide(a: Candle[], b: Candle[] | null): Candle[] {
  if (!b) return a;
  const am = new Map(a.map((x) => [x.time, x]));
  const bm = new Map(b.map((x) => [x.time, x]));
  const times = [...new Set([...am.keys(), ...bm.keys()])].sort((x, y) => x - y);
  const flat = (c: number): Candle => ({ time: 0, open: c, high: c, low: c, close: c });
  let la: Candle | undefined;
  let lb: Candle | undefined;
  const out: Candle[] = [];
  for (const t of times) {
    const x = am.get(t) ?? (la ? flat(la.close) : undefined);
    const y = bm.get(t) ?? (lb ? flat(lb.close) : undefined);
    if (am.has(t)) la = am.get(t);
    if (bm.has(t)) lb = bm.get(t);
    if (!x || !y) continue;
    const o = x.open / y.open;
    const c = x.close / y.close;
    const ext = [o, c, x.high / y.high, x.low / y.low, x.high / y.low, x.low / y.high];
    out.push({ time: t, open: o, close: c, high: Math.max(...ext), low: Math.min(...ext) });
  }
  return out;
}

/** Attaches to every live instrument the loader of its source's real history. */
export function registerLoaders(store: CandleStore) {
  const round = (symbol: string, bars: Candle[]) => {
    const d = BY_SYMBOL.get(symbol)!.digits;
    const r = (v: number) => Number(v.toFixed(d));
    return bars.map((x) => ({ time: x.time, open: r(x.open), high: r(x.high), low: r(x.low), close: r(x.close) }));
  };
  for (const i of INSTRUMENTS) {
    const s = i.symbol;
    if (i.source === 'binance') store.setLoader(s, async (tf) => round(s, await binanceBars(i.feedId!, tf)));
    else if (i.source === 'hyperliquid') store.setLoader(s, async (tf) => round(s, await hlBars(i.feedId!, tf)));
    else if (i.source === 'kraken') store.setLoader(s, async (tf) => round(s, await krakenBars(s, tf)));
  }
  for (const p of fxPairs()) {
    if (BY_SYMBOL.get(p.symbol)?.source !== 'cross') continue;
    store.setLoader(p.symbol, async (tf) => {
      const [a, b] = await Promise.all([usdSeries(p.base, tf), p.quote === 'USD' ? Promise.resolve(null) : usdSeries(p.quote, tf)]);
      return round(p.symbol, divide(a, b));
    });
  }
}
