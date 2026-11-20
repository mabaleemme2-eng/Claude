export interface Instrument {
  symbol: string; source: 'binance' | 'hyperliquid' | 'kraken' | 'cross' | 'sim'; name: string; cls: 'forex' | 'crypto' | 'index' | 'commodity' | 'stock';
  digits: number; pip: number; contractSize: number; minLot: number; maxLot: number; lotStep: number;
  base: string; quote: string; rawSpreadPips: number;
  swap: SwapRule;
}
export interface SwapRule { mode: 'pips' | 'percent' | 'money'; long: number; short: number; tripleDay: number }
export interface SpreadRule { mode: 'raw' | 'fixed' | 'markup_pips' | 'markup_pct'; value: number; min?: number; max?: number }
export interface SessionRule { name: string; days: number[]; from: string; to: string; multiplier: number; classes?: string[] }
export type AssetClass = Instrument['cls'];
export interface GroupConfig {
  id: string; name: string; leverage: number; marginCallLevel: number; stopOutLevel: number;
  swapFree: boolean; swapMarkupPct: number; rolloverHourUtc: number;
  classSpread: Record<AssetClass, SpreadRule>; symbolSpread: Record<string, SpreadRule>;
  commissionPerLot: Record<AssetClass, number>; swapOverrides: Record<string, SwapRule>; sessions: SessionRule[];
}
export interface Position {
  id: number; symbol: string; side: 'buy' | 'sell'; lots: number; openPrice: number; openTime: number;
  sl?: number; tp?: number; swap: number; commission: number; pnl: number;
}
export interface Pending { id: number; symbol: string; side: 'buy' | 'sell'; type: 'limit' | 'stop'; lots: number; price: number; sl?: number; tp?: number }
export interface Trade {
  id: number; symbol: string; side: 'buy' | 'sell'; lots: number; openPrice: number; closePrice: number;
  closeTime: number; pnl: number; swap: number; commission: number; reason: string;
}
export interface Account {
  id: string; name: string; groupId: string; groupName: string; leverage: number;
  balance: number; equity: number; margin: number; freeMargin: number; marginLevel: number | null; floating: number;
  positions: Position[]; pending: Pending[]; history: Trade[];
}
export interface Candle { time: number; open: number; high: number; low: number; close: number }

export const ADMIN_KEY_STORAGE = 'adminKey';

/** Identificativo del conto demo di questo browser (nessun dato personale). */
export const accountId = (): string => {
  try {
    let id = localStorage.getItem('accountId');
    if (!id) {
      id = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
      localStorage.setItem('accountId', id);
    }
    return id;
  } catch { return 'demo'; }
};
export const adminKey = () => { try { return localStorage.getItem(ADMIN_KEY_STORAGE) ?? 'dev-admin'; } catch { return 'dev-admin'; } };

export async function api<T>(path: string, init?: { method?: string; body?: unknown; admin?: boolean }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json', 'x-account-id': accountId(), ...(init?.admin ? { 'x-admin-key': adminKey() } : {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}
