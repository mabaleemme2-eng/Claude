import { BY_SYMBOL, registerInstruments, type AssetClass, type Instrument, type SwapRule } from './instruments.js';
import { HL_FX, KRAKEN_DIRECT, fxPairs } from './forex.js';
import { HL_INFO } from './hyperliquid.js';
import { requestJson } from './httpJson.js';
import { BINANCE_REST } from './market.js';

/**
 * INSTRUMENT CATALOG
 * Starts from the base (simulated) list and, at startup, enriches it with what the free sources really
 * quote: crypto from Binance, indices/metals/energy/agriculture/stocks from Hyperliquid, forex from Kraken.
 * If an instrument already exists it keeps its settings (lots, swap) and only its source changes.
 */

const decimals = (s: string) => (s.includes('.') ? (s.replace(/0+$/, '').split('.')[1]?.length ?? 0) : 0);
const pipOf = (digits: number) => 10 ** -(Math.max(digits, 2) - 1);
const pct = (long: number, short: number): SwapRule => ({ mode: 'percent', long, short, tripleDay: 3 });
const cryptoSwap: SwapRule = { mode: 'percent', long: -12, short: -8, tripleDay: -1 };

function make(p: Partial<Instrument> & Pick<Instrument, 'symbol' | 'name' | 'cls' | 'digits' | 'source'>): Instrument {
  const pip = p.pip ?? pipOf(p.digits);
  return {
    pip, contractSize: 1, minLot: 0.01, maxLot: 100, lotStep: 0.01, base: p.symbol, quote: 'USD',
    start: 1, vol: 5e-5, rawSpreadPips: 1, swap: pct(-5.5, 2), ...p,
  } as Instrument;
}

/** If the instrument already exists: keep its settings and only update the source. */
function upsert(list: Instrument[], fresh: Instrument): Instrument {
  const old = BY_SYMBOL.get(fresh.symbol);
  return old ? { ...old, source: fresh.source, feedId: fresh.feedId } : fresh;
}

// ───────────── crypto (Binance) ─────────────
const NOT_CRYPTO = new Set(['EUR', 'GBP', 'AUD', 'TRY', 'BRL', 'ARS', 'RUB', 'UAH', 'PAXG', 'USDC', 'FDUSD', 'TUSD', 'USD1', 'USDE',
  'XUSD', 'BFUSD', 'EURI', 'AEUR', 'USDP', 'DAI', 'PYUSD', 'RLUSD', 'USDT', 'WBTC', 'WBETH', 'BNSOL']);

async function binanceInstruments(max = 90): Promise<Instrument[]> {
  const all = await requestJson<{ symbol: string; quoteVolume: string; lastPrice: string; count: number }[]>(`${BINANCE_REST}/api/v3/ticker/24hr`);
  const pick = all
    .filter((t) => t.symbol.endsWith('USDT') && Number(t.quoteVolume) >= 3e6 && Number(t.lastPrice) > 0)
    .filter((t) => { const b = t.symbol.slice(0, -4); return !NOT_CRYPTO.has(b) && !/(UP|DOWN|BULL|BEAR)$/.test(b); })
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume)).slice(0, max);
  const info = await requestJson<{ symbols: { symbol: string; filters: { filterType: string; tickSize?: string }[] }[] }>(
    `${BINANCE_REST}/api/v3/exchangeInfo?symbols=${encodeURIComponent(JSON.stringify(pick.map((p) => p.symbol)))}`);
  const tick = new Map(info.symbols.map((s) => [s.symbol, s.filters.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize ?? '0.01']));
  return pick.map((t) => {
    const base = t.symbol.slice(0, -4);
    const price = Number(t.lastPrice);
    const digits = Math.min(8, decimals(tick.get(t.symbol)!));
    const contractSize = price >= 100 ? 1 : 10 ** Math.ceil(Math.log10(100 / price));
    return upsert([], make({
      symbol: `${base}USD`, name: base, cls: 'crypto', digits, source: 'binance', feedId: t.symbol,
      contractSize, minLot: 0.01, maxLot: 100, lotStep: 0.01, swap: cryptoSwap, vol: 9e-5,
    }));
  });
}

// ───────────── indici, materie prime, azioni (Hyperliquid xyz) ─────────────
const HL_ALIAS: Record<string, string> = {
  GOLD: 'XAUUSD', SILVER: 'XAGUSD', PLATINUM: 'XPTUSD', PALLADIUM: 'XPDUSD', CL: 'USOIL', BRENTOIL: 'UKOIL',
  NATGAS: 'NGAS', SP500: 'US500', XYZ100: 'US100',
};
const HL_NAMES: Record<string, string> = {
  XAUUSD: 'Gold', XAGUSD: 'Silver', XPTUSD: 'Platinum', XPDUSD: 'Palladium', COPPER: 'Copper', USOIL: 'WTI Crude Oil',
  UKOIL: 'Brent Crude Oil', NGAS: 'Natural Gas', TTF: 'TTF Gas', URANIUM: 'Uranium', CORN: 'Corn', WHEAT: 'Wheat',
  ALUMINIUM: 'Aluminium', US500: 'S&P 500', US100: 'US Tech 100 (XYZ100)', JP225: 'Nikkei 225', KR200: 'KOSPI 200',
  NIFTY: 'Nifty 50', IBOV: 'Ibovespa',
};
const HL_INDEX = new Set(['SP500', 'XYZ100', 'JP225', 'KR200', 'NIFTY', 'IBOV']);
const HL_COMMODITY = new Set(['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'COPPER', 'CL', 'BRENTOIL', 'NATGAS', 'TTF', 'URANIUM', 'CORN', 'WHEAT', 'ALUMINIUM']);
/** no forex (comes from Kraken), no volatility indices or non-standard instruments */
const HL_SKIP = new Set(['EUR', 'GBP', 'JPY', 'KRW', 'DXY', 'VIX', 'VOL', 'H100', 'PURRDAT', 'BIRD', 'DRAM', 'MINIMAX', 'ZHIPU']);
const CONTRACT: Record<string, number> = { XAUUSD: 100, XAGUSD: 5000, XPTUSD: 50, XPDUSD: 100, COPPER: 25000, USOIL: 1000, UKOIL: 1000, NGAS: 10000, TTF: 1000, URANIUM: 1000, CORN: 5000, WHEAT: 5000, ALUMINIUM: 25 };

async function hyperliquidInstruments(): Promise<Instrument[]> {
  const [meta, ctx] = await requestJson<[{ universe: { name: string }[] }, { midPx: string | null; dayNtlVlm: string }[]]>(
    HL_INFO, { type: 'metaAndAssetCtxs', dex: 'xyz' });
  const out: Instrument[] = [];
  meta.universe.forEach((u, idx) => {
    const raw = u.name.replace(/^xyz:/, '');
    const c = ctx[idx];
    if (HL_SKIP.has(raw) || !c?.midPx || Number(c.dayNtlVlm) < 1e6) return;
    const symbol = HL_ALIAS[raw] ?? raw;
    const digits = Math.max(2, decimals(c.midPx));
    const cls: AssetClass = HL_INDEX.has(raw) ? 'index' : HL_COMMODITY.has(raw) ? 'commodity' : 'stock';
    out.push(upsert([], make({
      symbol, name: HL_NAMES[symbol] ?? raw, cls, digits, source: 'hyperliquid', feedId: u.name,
      contractSize: cls === 'commodity' ? (CONTRACT[symbol] ?? 1) : 1,
      minLot: cls === 'stock' ? 1 : cls === 'index' ? 0.1 : 0.01,
      maxLot: cls === 'stock' ? 2000 : 200, lotStep: cls === 'stock' ? 1 : cls === 'index' ? 0.1 : 0.01,
    })));
  });
  return out;
}

// ───────────── forex (Kraken + incroci) ─────────────
/** Indicative annual reference rates (%), to be updated from the admin panel: the basis for new pairs' swaps. */
const RATES: Record<string, number> = { USD: 4.5, EUR: 2.5, GBP: 4.5, AUD: 4.0, CAD: 3.0, CHF: 0.5, JPY: 0.25 };

function forexInstruments(): Instrument[] {
  return fxPairs().map((p) => {
    const jpy = p.quote === 'JPY';
    const hl = HL_FX[p.symbol];
    const direct = KRAKEN_DIRECT.includes(p.symbol);
    const fee = 1; // fixed broker markup in % points per year
    const diff = RATES[p.base] - RATES[p.quote];
    return upsert([], make({
      symbol: p.symbol, name: `${p.base}/${p.quote}`, cls: 'forex', digits: jpy ? 3 : 5, pip: jpy ? 0.01 : 0.0001,
      contractSize: 100000, minLot: 0.01, maxLot: 100, lotStep: 0.01, base: p.base, quote: p.quote,
      source: hl ? 'hyperliquid' : direct ? 'kraken' : 'cross', feedId: hl ?? (direct ? `${p.base}/${p.quote}` : undefined),
      swap: { mode: 'percent', long: diff - fee, short: -diff - fee, tripleDay: 3 },
    }));
  });
}

export async function buildCatalog(): Promise<void> {
  const report: string[] = [];
  registerInstruments(forexInstruments());
  report.push(`forex ${fxPairs().length}`);
  for (const [name, fn] of [['binance', binanceInstruments], ['hyperliquid', hyperliquidInstruments]] as const) {
    try {
      const list = await fn();
      registerInstruments(list);
      report.push(`${name} ${list.length}`);
    } catch (e) {
      console.warn(`[catalog] ${name} unreachable, instruments stay simulated:`, (e as Error).message);
    }
  }
  console.log(`[catalog] ${report.join(' · ')}`);
}
