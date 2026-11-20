/**
 * Browser-only demo runtime. It runs the real pricing/trading engine and the real REST handler
 * (the same code as the server) inside the page. Prices are a snapshot of the real market taken
 * earlier (demo-data/), continued by a random-walk simulator. No server is needed.
 */
import { INSTRUMENTS, BY_SYMBOL, registerInstruments, type Instrument } from '../../../server/src/instruments';
import { PricingStore, type PricingConfig } from '../../../server/src/pricing';
import { TradingEngine, type MarketData } from '../../../server/src/trading';
import { CandleStore, aggregate, type Candle, type TfKey } from '../../../server/src/candles';
import { handleApi, HttpError } from '../../../server/src/routes';
import { gauss } from '../../../server/src/util';

type Emit = (msg: unknown) => void;

const VOL: Record<string, number> = { forex: 1.5e-5, crypto: 6e-5, index: 2.5e-5, commodity: 3e-5, stock: 4e-5 };
const BASE = 'demo-data/';

async function getJson<T>(file: string): Promise<T> {
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  return r.json() as Promise<T>;
}

class DemoMarket implements MarketData {
  last = new Map<string, { bid: number; ask: number; time: number }>();
  raw(s: string) { return this.last.get(s); }
  mid(s: string) { const t = this.last.get(s); return t ? (t.bid + t.ask) / 2 : undefined; }
  toUsd(ccy: string): number {
    if (ccy === 'USD') return 1;
    const direct = this.mid(`${ccy}USD`);
    if (direct) return direct;
    const inverse = this.mid(`USD${ccy}`);
    return inverse ? 1 / inverse : 1;
  }
}

const STORE_KEY = 'demoPricing';
const loadPricing = (): PricingConfig | null => { try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'); } catch { return null; } };
const savePricing = (c: PricingConfig) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } };

interface Ctx { engine: TradingEngine; pricing: PricingStore; market: DemoMarket; candles: CandleStore; acc: ReturnType<TradingEngine['createAccount']>; takenAt: string; spreads: Map<string, number> }
let ctx: Ctx | null = null;
let booting: Promise<Ctx> | null = null;

// one file with the recent history of every instrument, loaded on first use
let histAll: Promise<Record<string, Record<string, number[][]>>> | null = null;
const history = async (symbol: string) => {
  histAll ??= getJson<Record<string, Record<string, number[][]>>>('history.json');
  const h = (await histAll)[symbol];
  if (!h) throw new Error(`no history for ${symbol}`);
  return h;
};
const toCandles = (rows: number[][]): Candle[] => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));

async function boot(): Promise<Ctx> {
  const [list, snap] = await Promise.all([
    getJson<Instrument[]>('instruments.json'),
    getJson<{ takenAt: string; prices: Record<string, [number, number]> }>('prices.json'),
  ]);
  // replace the base list with the snapshot catalog
  INSTRUMENTS.splice(0, INSTRUMENTS.length);
  BY_SYMBOL.clear();
  registerInstruments(list.filter((i) => snap.prices[i.symbol]).map((i) => {
    const [bid, ask] = snap.prices[i.symbol];
    return { ...i, source: 'demo' as unknown as Instrument['source'], start: (bid + ask) / 2, vol: VOL[i.cls] ?? 3e-5 };
  }));

  const market = new DemoMarket();
  const spreads = new Map<string, number>();
  for (const i of INSTRUMENTS) {
    const [bid, ask] = snap.prices[i.symbol];
    market.last.set(i.symbol, { bid, ask, time: Date.now() });
    spreads.set(i.symbol, Math.max(ask - bid, i.pip * 0.1));
  }

  const pricing = new PricingStore(loadPricing(), savePricing);
  const engine = new TradingEngine(market, pricing);
  const acc = engine.createAccount('demo', 'Demo Account', 'standard', 10000);
  const candles = new CandleStore();
  for (const i of INSTRUMENTS) {
    candles.setLoader(i.symbol, async (tf: TfKey) => {
      const h = await history(i.symbol);
      switch (tf) {
        case 'M5': return toCandles(h.M5);
        case 'M15': return aggregate(toCandles(h.M5), 900);
        case 'H1': return toCandles(h.H1);
        case 'H4': return aggregate(toCandles(h.H1), 14400);
        case 'D1': return toCandles(h.D1);
        default: return []; // no M1 history in the demo: bars build up while the page is open
      }
    });
  }
  return { engine, pricing, market, candles, acc, takenAt: snap.takenAt, spreads };
}

const ready = () => (booting ??= boot().then((c) => (ctx = c)));

/** REST-style calls, answered locally by the same handler the server uses. */
export async function localApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const c = await ready();
  const url = new URL(path, 'http://demo');
  if (url.pathname === '/api/demo') return { takenAt: c.takenAt } as T;
  try {
    return (await handleApi({ engine: c.engine, pricing: c.pricing, market: c.market, candles: c.candles }, {
      method: init?.method ?? 'GET', path: url.pathname, query: url.searchParams, body: init?.body,
      account: c.acc, isAdmin: true,
    })) as T;
  } catch (e) {
    throw new Error(e instanceof HttpError || e instanceof Error ? e.message : 'error');
  }
}

/** Starts the price simulation and emits the same messages the WebSocket would. */
export async function startDemo(emit: Emit) {
  const c = await ready();
  const { engine, market, candles, acc, spreads } = c;
  const quoteTick = (symbol: string, time: number) => {
    const q = engine.quote(acc, symbol, new Date(time));
    if (q) emit({ type: 'tick', symbol, bid: q.bid, ask: q.ask, time });
  };
  for (const i of INSTRUMENTS) quoteTick(i.symbol, Date.now());
  emit({ type: 'account', data: engine.snapshot(acc) });

  const mids = new Map(INSTRUMENTS.map((i) => [i.symbol, i.start]));
  let lastPush = 0;
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const i of INSTRUMENTS) {
      if (Math.random() > 0.7) continue;
      let mid = mids.get(i.symbol)!;
      mid *= 1 + gauss() * i.vol + ((i.start - mid) / i.start) * 0.0005;
      mids.set(i.symbol, mid);
      const half = (spreads.get(i.symbol)! * (0.85 + Math.random() * 0.4)) / 2;
      const d = i.digits;
      const bid = Math.floor((mid - half) * 10 ** d) / 10 ** d;
      const ask = Math.ceil((mid + half) * 10 ** d) / 10 ** d;
      market.last.set(i.symbol, { bid, ask, time: now });
      const ref = engine.quote(acc, i.symbol, new Date(now));
      if (ref) candles.update(i.symbol, now, ref.bid);
      changed = engine.onTick(i.symbol) || changed;
      quoteTick(i.symbol, now);
    }
    if (changed || now - lastPush > 400) { lastPush = now; emit({ type: 'account', data: engine.snapshot(acc) }); }
  }, 250);

}
