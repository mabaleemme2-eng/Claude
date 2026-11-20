import fs from 'node:fs';
import path from 'node:path';
import type { AssetClass, Instrument, SwapRule } from './instruments.js';

/**
 * MOTORE PREZZI
 * ─────────────
 * prezzo cliente = prezzo grezzo del liquidity provider + regola di spread.
 * Risoluzione (la prima che esiste vince):
 *   1. override del singolo cliente  →  account.spreadOverrides[symbol]
 *   2. override del gruppo per simbolo →  group.symbolSpread[symbol]
 *   3. regola del gruppo per classe di asset → group.classSpread[cls]
 * Sopra il risultato si applica il moltiplicatore di sessione (allargamenti in news/rollover).
 */

export type SpreadMode = 'raw' | 'fixed' | 'markup_pips' | 'markup_pct';

export interface SpreadRule {
  mode: SpreadMode;
  /** raw: ignorato · fixed: pip · markup_pips: pip aggiunti · markup_pct: % dello spread grezzo */
  value: number;
  /** limiti sullo spread finale, in pip */
  min?: number;
  max?: number;
}

export interface SessionRule {
  name: string;
  /** giorni UTC 0=dom…6=sab; vuoto = tutti */
  days: number[];
  from: string; // 'HH:MM' UTC
  to: string;
  multiplier: number;
  /** se presente, limita a queste classi */
  classes?: AssetClass[];
}

export interface GroupConfig {
  id: string;
  name: string;
  leverage: number;
  marginCallLevel: number;
  stopOutLevel: number;
  swapFree: boolean;
  /** maggiorazione del broker sullo swap: aumenta gli addebiti e riduce gli accrediti (%) */
  swapMarkupPct: number;
  rolloverHourUtc: number;
  classSpread: Record<AssetClass, SpreadRule>;
  symbolSpread: Record<string, SpreadRule>;
  /** commissione per lotto e per lato (USD) */
  commissionPerLot: Record<AssetClass, number>;
  swapOverrides: Record<string, SwapRule>;
  sessions: SessionRule[];
}

export interface PricingConfig {
  groups: GroupConfig[];
}

const rule = (mode: SpreadMode, value: number, min?: number, max?: number): SpreadRule => ({ mode, value, min, max });
const allClasses = (r: SpreadRule): Record<AssetClass, SpreadRule> => ({
  forex: { ...r }, crypto: { ...r }, index: { ...r }, commodity: { ...r }, stock: { ...r },
});

const ROLLOVER_WIDEN: SessionRule = { name: 'Rollover', days: [], from: '21:55', to: '22:10', multiplier: 4 };

export function defaultConfig(): PricingConfig {
  return {
    groups: [
      {
        id: 'standard', name: 'Standard · spread con markup', leverage: 100, marginCallLevel: 100, stopOutLevel: 50,
        swapFree: false, swapMarkupPct: 20, rolloverHourUtc: 22,
        classSpread: {
          forex: rule('markup_pips', 1.2), crypto: rule('markup_pct', 40), index: rule('markup_pips', 0.8),
          commodity: rule('markup_pips', 1.5), stock: rule('markup_pct', 30),
        },
        symbolSpread: { EURUSD: rule('fixed', 1.4, 1.4) },
        commissionPerLot: { forex: 0, crypto: 0, index: 0, commodity: 0, stock: 0 },
        swapOverrides: {}, sessions: [ROLLOVER_WIDEN],
      },
      {
        id: 'ecn', name: 'ECN · spread grezzo + commissione', leverage: 200, marginCallLevel: 100, stopOutLevel: 40,
        swapFree: false, swapMarkupPct: 10, rolloverHourUtc: 22,
        classSpread: {
          forex: rule('markup_pips', 0.1), crypto: rule('markup_pct', 5), index: rule('markup_pips', 0.1),
          commodity: rule('markup_pips', 0.2), stock: rule('markup_pct', 5),
        },
        symbolSpread: {},
        commissionPerLot: { forex: 3.5, crypto: 0, index: 0, commodity: 3.5, stock: 0 },
        swapOverrides: {}, sessions: [ROLLOVER_WIDEN],
      },
      {
        id: 'islamic', name: 'Islamico · senza swap', leverage: 100, marginCallLevel: 100, stopOutLevel: 50,
        swapFree: true, swapMarkupPct: 0, rolloverHourUtc: 22,
        classSpread: {
          forex: rule('markup_pips', 1.8), crypto: rule('markup_pct', 50), index: rule('markup_pips', 1.2),
          commodity: rule('markup_pips', 2.2), stock: rule('markup_pct', 40),
        },
        symbolSpread: {}, commissionPerLot: { forex: 0, crypto: 0, index: 0, commodity: 0, stock: 0 },
        swapOverrides: {}, sessions: [ROLLOVER_WIDEN],
      },
      {
        id: 'fixed', name: 'Spread fisso (market maker)', leverage: 100, marginCallLevel: 100, stopOutLevel: 50,
        swapFree: false, swapMarkupPct: 30, rolloverHourUtc: 22,
        classSpread: {
          forex: rule('fixed', 2), crypto: rule('fixed', 60), index: rule('fixed', 2),
          commodity: rule('fixed', 4), stock: rule('fixed', 10),
        },
        symbolSpread: {}, commissionPerLot: { forex: 0, crypto: 0, index: 0, commodity: 0, stock: 0 },
        swapOverrides: {}, sessions: [],
      },
    ],
  };
}

const FILE = path.resolve(process.cwd(), 'data', 'pricing.json');

export class PricingStore {
  config: PricingConfig;
  constructor() {
    this.config = this.load();
  }
  private load(): PricingConfig {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8')) as PricingConfig;
    } catch {
      return defaultConfig();
    }
  }
  save() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(this.config, null, 2));
  }
  group(id: string): GroupConfig {
    return this.config.groups.find((g) => g.id === id) ?? this.config.groups[0];
  }
  updateGroup(g: GroupConfig) {
    const i = this.config.groups.findIndex((x) => x.id === g.id);
    if (i < 0) throw new Error('gruppo sconosciuto');
    this.config.groups[i] = g;
    this.save();
  }
  reset() {
    this.config = defaultConfig();
    this.save();
  }
}

export function resolveSpreadRule(
  group: GroupConfig, inst: Instrument, clientOverrides?: Record<string, SpreadRule>,
): SpreadRule {
  return clientOverrides?.[inst.symbol] ?? group.symbolSpread[inst.symbol] ?? group.classSpread[inst.cls];
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** moltiplicatore massimo tra le sessioni attive */
export function sessionMultiplier(group: GroupConfig, inst: Instrument, now: Date): number {
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const day = now.getUTCDay();
  let mult = 1;
  for (const s of group.sessions) {
    if (s.days.length && !s.days.includes(day)) continue;
    if (s.classes && !s.classes.includes(inst.cls)) continue;
    const from = toMin(s.from);
    const to = toMin(s.to);
    const inside = from <= to ? mins >= from && mins < to : mins >= from || mins < to;
    if (inside) mult = Math.max(mult, s.multiplier);
  }
  return mult;
}

export interface Quote {
  bid: number;
  ask: number;
}

const EPS = 1e-9;
/** bid per difetto, ask per eccesso: l'arrotondamento non riduce mai lo spread del broker. */
const down = (v: number, digits: number) => Number((Math.floor(v * 10 ** digits + EPS) / 10 ** digits).toFixed(digits));
const up = (v: number, digits: number) => Number((Math.ceil(v * 10 ** digits - EPS) / 10 ** digits).toFixed(digits));

/** Applica la regola allo spread grezzo. Il prezzo medio resta quello del provider. */
export function applySpread(raw: Quote, inst: Instrument, r: SpreadRule, mult = 1): Quote {
  const rawSpread = raw.ask - raw.bid;
  let spread: number;
  switch (r.mode) {
    case 'raw': spread = rawSpread; break;
    case 'fixed': spread = r.value * inst.pip; break;
    case 'markup_pips': spread = rawSpread + r.value * inst.pip; break;
    case 'markup_pct': spread = rawSpread * (1 + r.value / 100); break;
  }
  if (r.min !== undefined) spread = Math.max(spread, r.min * inst.pip);
  if (r.max !== undefined) spread = Math.min(spread, r.max * inst.pip);
  spread *= mult;
  const mid = (raw.bid + raw.ask) / 2;
  return { bid: down(mid - spread / 2, inst.digits), ask: up(mid + spread / 2, inst.digits) };
}

/** Swap effettivo (override gruppo > default strumento) con la maggiorazione del broker. */
export function resolveSwap(group: GroupConfig, inst: Instrument): SwapRule {
  const base = group.swapOverrides[inst.symbol] ?? inst.swap;
  if (group.swapFree) return { ...base, long: 0, short: 0 };
  const adj = (v: number) => (v < 0 ? v * (1 + group.swapMarkupPct / 100) : v * (1 - group.swapMarkupPct / 100));
  return { ...base, long: adj(base.long), short: adj(base.short) };
}

/**
 * Swap in USD per una posizione per una notte.
 * `quoteToUsd`: tasso quote→USD · `notionalUsd`: nozionale della posizione in USD.
 */
export function swapAmountUsd(
  inst: Instrument, swap: SwapRule, side: 'buy' | 'sell', lots: number,
  quoteToUsd: number, notionalUsd: number, now: Date,
): number {
  const v = side === 'buy' ? swap.long : swap.short;
  let amount: number;
  switch (swap.mode) {
    case 'pips': amount = v * inst.pip * inst.contractSize * lots * quoteToUsd; break;
    case 'percent': amount = (v / 100) * notionalUsd / 365; break;
    case 'money': amount = v * lots; break;
  }
  return amount * (swap.tripleDay === now.getUTCDay() ? 3 : 1);
}
