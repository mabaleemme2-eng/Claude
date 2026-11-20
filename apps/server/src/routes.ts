import { BY_SYMBOL, INSTRUMENTS } from './instruments.js';
import { TF, type CandleStore, type TfKey } from './candles.js';
import { applySpread, resolveSpreadRule, resolveSwap, sessionMultiplier, type GroupConfig, type PricingStore } from './pricing.js';
import type { Account, MarketData, TradingEngine } from './trading.js';

export class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export interface ApiDeps {
  engine: TradingEngine;
  pricing: PricingStore;
  market: MarketData;
  candles: CandleStore;
}

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any;
  account: Account;
  isAdmin: boolean;
}

const num = (v: unknown): number | undefined => (v === undefined || v === null || v === '' ? undefined : Number(v));

/**
 * The whole REST API as one pure function. The Node server wraps it in HTTP; the browser demo
 * calls it directly, so both behave identically.
 */
export async function handleApi(d: ApiDeps, r: ApiRequest): Promise<unknown> {
  const { engine, pricing, market, candles } = d;
  const { method: m, path: p, query, account: acc } = r;
  const b = r.body ?? {};

  if (m === 'GET' && p === '/api/instruments') return INSTRUMENTS.map(({ vol, start, ...i }) => i);

  if (m === 'GET' && p === '/api/candles') {
    const tf = (query.get('tf') ?? 'M1') as TfKey;
    if (!(tf in TF)) throw new HttpError(400, 'invalid timeframe');
    const symbol = query.get('symbol') ?? '';
    if (!BY_SYMBOL.has(symbol)) throw new HttpError(404, 'unknown symbol');
    await candles.ensure(symbol, tf);
    return candles.get(symbol, tf, Number(query.get('limit') ?? 500));
  }

  if (m === 'GET' && p === '/api/account') return engine.snapshot(acc);
  if (m === 'GET' && p === '/api/groups') return pricing.config.groups.map((g) => ({ id: g.id, name: g.name }));
  if (m === 'POST' && p === '/api/account/group') {
    if (!pricing.config.groups.some((g) => g.id === b.groupId)) throw new HttpError(400, 'unknown group');
    acc.groupId = b.groupId;
    return engine.snapshot(acc);
  }
  if (m === 'POST' && p === '/api/account/reset') {
    acc.balance = 10000; acc.positions = []; acc.pending = []; acc.history = [];
    return engine.snapshot(acc);
  }

  if (m === 'POST' && p === '/api/orders') {
    if (b.type === 'limit' || b.type === 'stop') {
      engine.placePending(acc, b.symbol, b.side, b.type, Number(b.lots), Number(b.price), num(b.sl), num(b.tp));
    } else {
      engine.openMarket(acc, b.symbol, b.side, Number(b.lots), num(b.sl), num(b.tp));
    }
    return engine.snapshot(acc);
  }
  let mm = p.match(/^\/api\/positions\/(\d+)$/);
  if (mm && m === 'DELETE') { engine.closePosition(acc, Number(mm[1])); return engine.snapshot(acc); }
  if (mm && m === 'PATCH') { engine.modifyPosition(acc, Number(mm[1]), num(b.sl), num(b.tp)); return engine.snapshot(acc); }
  mm = p.match(/^\/api\/pending\/(\d+)$/);
  if (mm && m === 'DELETE') { engine.cancelPending(acc, Number(mm[1])); return engine.snapshot(acc); }

  // ── pricing administration ──
  if (p.startsWith('/api/admin/')) {
    if (!r.isAdmin) throw new HttpError(401, 'admin key missing or wrong');
    if (m === 'GET' && p === '/api/admin/pricing') return pricing.config;
    if (m === 'PUT' && p === '/api/admin/pricing') { pricing.updateGroup(b as GroupConfig); return b; }
    if (m === 'POST' && p === '/api/admin/pricing/reset') { pricing.reset(); return pricing.config; }
    if (m === 'POST' && p === '/api/admin/rollover') {
      const n = engine.applyRollover(new Date(), b.groupId);
      return { positionsCharged: n, account: engine.snapshot(acc) };
    }
    // preview: raw vs client price and effective swap for a group
    if (m === 'GET' && p === '/api/admin/preview') {
      const inst = BY_SYMBOL.get(query.get('symbol') ?? '');
      if (!inst) throw new HttpError(400, 'unknown symbol');
      const group = pricing.group(query.get('group') ?? 'standard');
      const raw = market.raw(inst.symbol);
      if (!raw) throw new HttpError(503, 'price not available yet');
      const rule = resolveSpreadRule(group, inst);
      const q = applySpread(raw, inst, rule, sessionMultiplier(group, inst, new Date()));
      return {
        raw: { bid: raw.bid, ask: raw.ask, spreadPips: Number(((raw.ask - raw.bid) / inst.pip).toFixed(2)) },
        client: { ...q, spreadPips: Number(((q.ask - q.bid) / inst.pip).toFixed(2)) },
        rule, swap: resolveSwap(group, inst), commissionPerLot: group.commissionPerLot[inst.cls],
      };
    }
  }
  throw new HttpError(404, 'not found');
}
