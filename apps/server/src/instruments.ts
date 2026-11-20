export type AssetClass = 'forex' | 'crypto' | 'index' | 'commodity' | 'stock';
export type SwapMode = 'pips' | 'percent' | 'money';

/** Swap per notte. `pips`: pip per lotto · `percent`: % annua sul nozionale · `money`: USD per lotto. */
export interface SwapRule {
  mode: SwapMode;
  long: number;
  short: number;
  /** giorno UTC (0=dom … 6=sab) con swap triplo, -1 = nessuno */
  tripleDay: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  cls: AssetClass;
  digits: number;
  pip: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  base: string;
  quote: string;
  /** prezzo iniziale del simulatore */
  start: number;
  /** volatilità per tick (frazione) del simulatore */
  vol: number;
  /** spread grezzo del liquidity provider, in pip */
  rawSpreadPips: number;
  swap: SwapRule;
}

const fxSwap = (long: number, short: number): SwapRule => ({ mode: 'pips', long, short, tripleDay: 3 });

function fx(symbol: string, start: number, rawSpreadPips: number, long: number, short: number, jpy = false): Instrument {
  return {
    symbol, name: `${symbol.slice(0, 3)}/${symbol.slice(3)}`, cls: 'forex',
    digits: jpy ? 3 : 5, pip: jpy ? 0.01 : 0.0001, contractSize: 100000,
    minLot: 0.01, maxLot: 100, lotStep: 0.01,
    base: symbol.slice(0, 3), quote: symbol.slice(3),
    start, vol: 2e-5, rawSpreadPips, swap: fxSwap(long, short),
  };
}

function other(
  symbol: string, name: string, cls: AssetClass, start: number, digits: number, pip: number,
  contractSize: number, lots: [number, number, number], vol: number, rawSpreadPips: number,
  swap: SwapRule, quote = 'USD',
): Instrument {
  return {
    symbol, name, cls, digits, pip, contractSize,
    minLot: lots[0], maxLot: lots[1], lotStep: lots[2],
    base: symbol, quote, start, vol, rawSpreadPips, swap,
  };
}

const pct = (long: number, short: number): SwapRule => ({ mode: 'percent', long, short, tripleDay: 3 });
const cryptoSwap = (long: number, short: number): SwapRule => ({ mode: 'percent', long, short, tripleDay: -1 });

export const INSTRUMENTS: Instrument[] = [
  fx('EURUSD', 1.0845, 0.1, -6.5, 2.1),
  fx('GBPUSD', 1.2710, 0.4, -5.8, 1.4),
  fx('USDJPY', 154.20, 0.4, 7.9, -11.2, true),
  fx('AUDUSD', 0.6540, 0.5, -3.1, 0.6),
  fx('USDCAD', 1.3920, 0.6, 2.2, -6.9),
  fx('USDCHF', 0.8810, 0.6, 4.0, -9.3),
  fx('NZDUSD', 0.5990, 0.7, -3.4, 0.4),
  fx('EURGBP', 0.8530, 0.6, -4.9, 0.9),
  fx('EURJPY', 167.25, 0.8, 3.1, -7.7, true),
  fx('GBPJPY', 196.10, 1.2, 4.6, -9.8, true),

  other('BTCUSD', 'Bitcoin', 'crypto', 67500, 2, 1, 1, [0.01, 50, 0.01], 8e-5, 25, cryptoSwap(-12, -8)),
  other('ETHUSD', 'Ethereum', 'crypto', 3450, 2, 0.1, 1, [0.01, 200, 0.01], 9e-5, 12, cryptoSwap(-12, -8)),
  other('SOLUSD', 'Solana', 'crypto', 168, 3, 0.01, 1, [0.1, 1000, 0.1], 1.1e-4, 8, cryptoSwap(-14, -10)),
  other('XRPUSD', 'Ripple', 'crypto', 0.52, 5, 0.0001, 1, [1, 100000, 1], 1.1e-4, 15, cryptoSwap(-14, -10)),

  other('US500', 'S&P 500', 'index', 5280, 2, 1, 1, [0.1, 200, 0.1], 3e-5, 0.6, pct(-5.5, 2.0)),
  other('US100', 'Nasdaq 100', 'index', 18350, 2, 1, 1, [0.1, 200, 0.1], 4e-5, 1.5, pct(-5.5, 2.0)),
  other('GER40', 'DAX 40', 'index', 18120, 2, 1, 1, [0.1, 200, 0.1], 3.5e-5, 1.2, pct(-5.0, 1.8), 'EUR'),
  other('JP225', 'Nikkei 225', 'index', 57500, 1, 1, 1, [0.1, 200, 0.1], 3e-5, 8, pct(-5.0, 1.8), 'JPY'),
  other('UK100', 'FTSE 100', 'index', 8240, 2, 1, 1, [0.1, 200, 0.1], 3e-5, 1.5, pct(-5.0, 1.8), 'GBP'),

  other('XAUUSD', 'Oro', 'commodity', 2385, 2, 0.1, 100, [0.01, 50, 0.01], 4e-5, 2.5, { mode: 'pips', long: -38, short: 18, tripleDay: 3 }),
  other('XAGUSD', 'Argento', 'commodity', 28.4, 3, 0.01, 5000, [0.01, 50, 0.01], 6e-5, 2.5, { mode: 'pips', long: -9, short: 3, tripleDay: 3 }),
  other('USOIL', 'Petrolio WTI', 'commodity', 78.6, 3, 0.01, 1000, [0.01, 100, 0.01], 5e-5, 3.0, { mode: 'pips', long: -5, short: 1.5, tripleDay: 3 }),

  other('AAPL', 'Apple', 'stock', 189.5, 2, 0.01, 1, [1, 2000, 1], 5e-5, 4, pct(-6.5, 3.0)),
  other('TSLA', 'Tesla', 'stock', 176.2, 2, 0.01, 1, [1, 2000, 1], 8e-5, 6, pct(-6.5, 3.0)),
  other('NVDA', 'Nvidia', 'stock', 902.4, 2, 0.01, 1, [1, 1000, 1], 7e-5, 15, pct(-6.5, 3.0)),
  other('MSFT', 'Microsoft', 'stock', 421.3, 2, 0.01, 1, [1, 1000, 1], 4e-5, 8, pct(-6.5, 3.0)),
];

export const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));
