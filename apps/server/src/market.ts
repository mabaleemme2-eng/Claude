import { EventEmitter } from 'node:events';
import { INSTRUMENTS, type Instrument } from './instruments.js';

export interface RawTick {
  symbol: string;
  bid: number;
  ask: number;
  time: number; // ms
}

/**
 * Interfaccia da implementare per agganciare un provider reale
 * (FIX / WebSocket di Finnhub, Polygon, cTrader, Oanda, bridge MT5…).
 * Il resto della piattaforma consuma solo RawTick.
 */
export interface PriceFeed {
  start(onTick: (t: RawTick) => void): void;
  stop(): void;
}

export const gauss = () => {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Feed simulato: passeggiata casuale con lieve ritorno verso il prezzo iniziale. */
export class SimulatedFeed implements PriceFeed {
  private mids = new Map<string, number>();
  private timer?: NodeJS.Timeout;

  start(onTick: (t: RawTick) => void) {
    for (const i of INSTRUMENTS) this.mids.set(i.symbol, i.start);
    this.timer = setInterval(() => {
      for (const i of INSTRUMENTS) {
        if (Math.random() > 0.7) continue;
        onTick(this.step(i));
      }
    }, 250);
  }

  stop() {
    clearInterval(this.timer);
  }

  private step(i: Instrument): RawTick {
    let mid = this.mids.get(i.symbol)!;
    mid *= 1 + gauss() * i.vol + ((i.start - mid) / i.start) * 0.0005;
    this.mids.set(i.symbol, mid);
    const half = (i.rawSpreadPips * i.pip * (0.85 + Math.random() * 0.4)) / 2;
    const r = (v: number) => Number(v.toFixed(i.digits));
    return { symbol: i.symbol, bid: r(mid - half), ask: r(mid + half), time: Date.now() };
  }
}

/** Ultimo prezzo grezzo per strumento + evento 'tick'. */
export class Market extends EventEmitter {
  private last = new Map<string, RawTick>();

  constructor(feed: PriceFeed) {
    super();
    feed.start((t) => {
      this.last.set(t.symbol, t);
      this.emit('tick', t);
    });
  }

  raw(symbol: string): RawTick | undefined {
    return this.last.get(symbol);
  }

  mid(symbol: string): number | undefined {
    const t = this.last.get(symbol);
    return t ? (t.bid + t.ask) / 2 : undefined;
  }

  /** Quanti USD vale 1 unità di `ccy` (EUR→USD usa EURUSD, CHF→USD usa 1/USDCHF…). */
  toUsd(ccy: string): number {
    if (ccy === 'USD') return 1;
    const direct = this.mid(`${ccy}USD`);
    if (direct) return direct;
    const inverse = this.mid(`USD${ccy}`);
    return inverse ? 1 / inverse : 1;
  }
}
