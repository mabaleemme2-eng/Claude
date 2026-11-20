import { BY_SYMBOL, type Instrument } from './instruments.js';
import type { Market } from './market.js';
import {
  applySpread, resolveSpreadRule, resolveSwap, sessionMultiplier, swapAmountUsd,
  type PricingStore, type Quote, type SpreadRule,
} from './pricing.js';

export type Side = 'buy' | 'sell';
export interface Position {
  id: number; symbol: string; side: Side; lots: number; openPrice: number; openTime: number;
  sl?: number; tp?: number; swap: number; commission: number;
}
export interface Pending {
  id: number; symbol: string; side: Side; type: 'limit' | 'stop'; lots: number; price: number;
  sl?: number; tp?: number; time: number;
}
export interface Trade {
  id: number; symbol: string; side: Side; lots: number; openPrice: number; closePrice: number;
  openTime: number; closeTime: number; pnl: number; swap: number; commission: number;
  reason: 'manual' | 'sl' | 'tp' | 'stopout';
}
export interface Account {
  id: string; name: string; groupId: string; balance: number;
  positions: Position[]; pending: Pending[]; history: Trade[];
  spreadOverrides: Record<string, SpreadRule>;
}

const LEVERAGE_CAP: Record<string, number> = { forex: 500, crypto: 20, index: 100, commodity: 100, stock: 20 };
let seq = 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

export class TradingEngine {
  accounts = new Map<string, Account>();

  constructor(private market: Market, private pricing: PricingStore) {}

  createAccount(id: string, name: string, groupId = 'standard', balance = 10000): Account {
    const a: Account = { id, name, groupId, balance, positions: [], pending: [], history: [], spreadOverrides: {} };
    this.accounts.set(id, a);
    return a;
  }

  private inst(symbol: string): Instrument {
    const i = BY_SYMBOL.get(symbol);
    if (!i) throw new Error(`strumento sconosciuto: ${symbol}`);
    return i;
  }

  /** Prezzo che vede il cliente (grezzo + spread del suo gruppo). */
  quote(acc: Account, symbol: string, now = new Date()): Quote | undefined {
    const raw = this.market.raw(symbol);
    if (!raw) return undefined;
    const inst = this.inst(symbol);
    const group = this.pricing.group(acc.groupId);
    return applySpread(raw, inst, resolveSpreadRule(group, inst, acc.spreadOverrides),
      sessionMultiplier(group, inst, now));
  }

  /** Nozionale in USD: forex = lotti × contratto × valore della valuta base, altri = prezzo × quantità. */
  private notionalUsd(inst: Instrument, lots: number, price: number): number {
    if (inst.cls === 'forex') return lots * inst.contractSize * this.market.toUsd(inst.base);
    return lots * inst.contractSize * price * this.market.toUsd(inst.quote);
  }

  private leverage(acc: Account, inst: Instrument): number {
    return Math.min(this.pricing.group(acc.groupId).leverage, LEVERAGE_CAP[inst.cls]);
  }

  private marginOf(acc: Account, p: { symbol: string; lots: number; openPrice: number }): number {
    const inst = this.inst(p.symbol);
    return this.notionalUsd(inst, p.lots, p.openPrice) / this.leverage(acc, inst);
  }

  private pnlOf(acc: Account, p: Position): number {
    const q = this.quote(acc, p.symbol);
    if (!q) return 0;
    const inst = this.inst(p.symbol);
    const diff = p.side === 'buy' ? q.bid - p.openPrice : p.openPrice - q.ask;
    return diff * p.lots * inst.contractSize * this.market.toUsd(inst.quote);
  }

  snapshot(acc: Account) {
    let floating = 0;
    let margin = 0;
    const positions = acc.positions.map((p) => {
      const pnl = this.pnlOf(acc, p);
      floating += pnl + p.swap;
      margin += this.marginOf(acc, p);
      return { ...p, pnl: r2(pnl), swap: r2(p.swap) };
    });
    const equity = acc.balance + floating;
    const g = this.pricing.group(acc.groupId);
    return {
      id: acc.id, name: acc.name, groupId: acc.groupId, groupName: g.name, currency: 'USD',
      leverage: g.leverage, balance: r2(acc.balance), equity: r2(equity), margin: r2(margin),
      freeMargin: r2(equity - margin), marginLevel: margin > 0 ? r2((equity / margin) * 100) : null,
      floating: r2(floating), positions,
      pending: acc.pending, history: acc.history.slice(-50).reverse(),
    };
  }

  private validate(inst: Instrument, lots: number) {
    if (!(lots >= inst.minLot && lots <= inst.maxLot)) throw new Error(`volume fuori limiti (${inst.minLot}–${inst.maxLot})`);
    const steps = lots / inst.lotStep;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) throw new Error(`passo volume ${inst.lotStep}`);
  }

  private checkStops(side: Side, price: number, sl?: number, tp?: number) {
    if (side === 'buy' && ((sl && sl >= price) || (tp && tp <= price))) throw new Error('SL/TP non validi per un acquisto');
    if (side === 'sell' && ((sl && sl <= price) || (tp && tp >= price))) throw new Error('SL/TP non validi per una vendita');
  }

  openMarket(acc: Account, symbol: string, side: Side, lots: number, sl?: number, tp?: number): Position {
    const inst = this.inst(symbol);
    this.validate(inst, lots);
    const q = this.quote(acc, symbol);
    if (!q) throw new Error('nessun prezzo disponibile');
    const price = side === 'buy' ? q.ask : q.bid;
    this.checkStops(side, price, sl, tp);
    const free = this.snapshot(acc).freeMargin;
    const need = this.marginOf(acc, { symbol, lots, openPrice: price });
    if (need > free) throw new Error(`margine insufficiente (richiesto ${r2(need)}, libero ${free})`);
    const commission = this.pricing.group(acc.groupId).commissionPerLot[inst.cls] * lots;
    acc.balance -= commission;
    const pos: Position = { id: ++seq, symbol, side, lots, openPrice: price, openTime: Date.now(), sl, tp, swap: 0, commission };
    acc.positions.push(pos);
    return pos;
  }

  placePending(acc: Account, symbol: string, side: Side, type: 'limit' | 'stop', lots: number, price: number, sl?: number, tp?: number): Pending {
    const inst = this.inst(symbol);
    this.validate(inst, lots);
    const q = this.quote(acc, symbol);
    if (!q) throw new Error('nessun prezzo disponibile');
    const ref = side === 'buy' ? q.ask : q.bid;
    const ok = (side === 'buy' && type === 'limit') || (side === 'sell' && type === 'stop') ? price < ref : price > ref;
    if (!ok) throw new Error('prezzo dell\'ordine pendente non valido rispetto al mercato');
    const o: Pending = { id: ++seq, symbol, side, type, lots, price, sl, tp, time: Date.now() };
    acc.pending.push(o);
    return o;
  }

  cancelPending(acc: Account, id: number) {
    acc.pending = acc.pending.filter((o) => o.id !== id);
  }

  modifyPosition(acc: Account, id: number, sl?: number, tp?: number) {
    const p = acc.positions.find((x) => x.id === id);
    if (!p) throw new Error('posizione non trovata');
    const q = this.quote(acc, p.symbol)!;
    this.checkStops(p.side, p.side === 'buy' ? q.bid : q.ask, sl, tp);
    p.sl = sl;
    p.tp = tp;
  }

  closePosition(acc: Account, id: number, reason: Trade['reason'] = 'manual'): Trade {
    const p = acc.positions.find((x) => x.id === id);
    if (!p) throw new Error('posizione non trovata');
    const q = this.quote(acc, p.symbol)!;
    const closePrice = p.side === 'buy' ? q.bid : q.ask;
    const pnl = this.pnlOf(acc, p);
    acc.balance += pnl + p.swap;
    acc.positions = acc.positions.filter((x) => x.id !== id);
    const t: Trade = {
      id: p.id, symbol: p.symbol, side: p.side, lots: p.lots, openPrice: p.openPrice, closePrice,
      openTime: p.openTime, closeTime: Date.now(), pnl: r2(pnl), swap: r2(p.swap), commission: r2(p.commission), reason,
    };
    acc.history.push(t);
    return t;
  }

  /** Chiamato a ogni tick grezzo: SL/TP, ordini pendenti, stop-out. Ritorna true se qualcosa è cambiato. */
  onTick(symbol: string): boolean {
    let changed = false;
    for (const acc of this.accounts.values()) {
      const q = this.quote(acc, symbol);
      if (!q) continue;
      for (const p of [...acc.positions]) {
        if (p.symbol !== symbol) continue;
        const px = p.side === 'buy' ? q.bid : q.ask;
        const hitSl = p.sl !== undefined && (p.side === 'buy' ? px <= p.sl : px >= p.sl);
        const hitTp = p.tp !== undefined && (p.side === 'buy' ? px >= p.tp : px <= p.tp);
        if (hitSl || hitTp) { this.closePosition(acc, p.id, hitSl ? 'sl' : 'tp'); changed = true; }
      }
      for (const o of [...acc.pending]) {
        if (o.symbol !== symbol) continue;
        const px = o.side === 'buy' ? q.ask : q.bid;
        const hit = o.side === 'buy'
          ? (o.type === 'limit' ? px <= o.price : px >= o.price)
          : (o.type === 'limit' ? px >= o.price : px <= o.price);
        if (!hit) continue;
        acc.pending = acc.pending.filter((x) => x.id !== o.id);
        try { this.openMarket(acc, o.symbol, o.side, o.lots, o.sl, o.tp); } catch { /* margine insufficiente: ordine annullato */ }
        changed = true;
      }
      changed = this.stopOut(acc) || changed;
    }
    return changed;
  }

  private stopOut(acc: Account): boolean {
    const stopLevel = this.pricing.group(acc.groupId).stopOutLevel;
    let closed = false;
    for (let guard = 0; guard < 50 && acc.positions.length; guard++) {
      const s = this.snapshot(acc);
      if (s.marginLevel === null || s.marginLevel >= stopLevel) break;
      const worst = [...s.positions].sort((a, b) => a.pnl - b.pnl)[0];
      this.closePosition(acc, worst.id, 'stopout');
      closed = true;
    }
    return closed;
  }

  /** Addebita/accredita lo swap notturno su tutte le posizioni aperte. */
  applyRollover(now: Date, groupId?: string): number {
    let n = 0;
    for (const acc of this.accounts.values()) {
      if (groupId && acc.groupId !== groupId) continue;
      const group = this.pricing.group(acc.groupId);
      for (const p of acc.positions) {
        const inst = this.inst(p.symbol);
        const weekend = now.getUTCDay() === 6 || now.getUTCDay() === 0;
        if (weekend && inst.cls !== 'crypto') continue;
        const swap = resolveSwap(group, inst);
        const price = this.market.mid(p.symbol) ?? p.openPrice;
        p.swap += swapAmountUsd(inst, swap, p.side, p.lots, this.market.toUsd(inst.quote),
          this.notionalUsd(inst, p.lots, price), now);
        n++;
      }
    }
    return n;
  }
}
