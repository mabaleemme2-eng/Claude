import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { proxyAgent } from './httpJson.js';
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
  private list: Instrument[];

  /** `only`: simula solo questi simboli (gli altri arrivano da feed reali). */
  constructor(only?: Set<string>) {
    this.list = only ? INSTRUMENTS.filter((i) => only.has(i.symbol)) : INSTRUMENTS;
  }

  start(onTick: (t: RawTick) => void) {
    for (const i of this.list) this.mids.set(i.symbol, i.start);
    this.timer = setInterval(() => {
      for (const i of this.list) {
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

/** Crypto reali da Binance (dati pubblici, nessuna chiave). USDT è trattato come USD. */
export const BINANCE_MAP: Record<string, string> = {
  BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', SOLUSD: 'SOLUSDT', XRPUSD: 'XRPUSDT',
};
const BINANCE_WS = process.env.BINANCE_WS ?? 'wss://data-stream.binance.vision';
export const BINANCE_REST = process.env.BINANCE_REST ?? 'https://data-api.binance.vision';

export class BinanceFeed implements PriceFeed {
  private ws?: WebSocket;
  private stopped = false;
  private onTick?: (t: RawTick) => void;
  /** simboli per cui è arrivato almeno un tick reale */
  readonly live = new Set<string>();

  start(onTick: (t: RawTick) => void) {
    this.onTick = onTick;
    this.connect();
  }

  private connect() {
    const reverse = new Map(Object.entries(BINANCE_MAP).map(([k, v]) => [v, k]));
    const streams = Object.values(BINANCE_MAP).map((s) => `${s.toLowerCase()}@bookTicker`).join('/');
    this.ws = new WebSocket(`${BINANCE_WS}/stream?streams=${streams}`, proxyAgent ? { agent: proxyAgent } : undefined);
    this.ws.on('message', (d) => {
      try {
        const m = JSON.parse(String(d)).data;
        const symbol = reverse.get(m?.s);
        if (!symbol) return;
        const inst = INSTRUMENTS.find((i) => i.symbol === symbol)!;
        const r = (v: string) => Number(Number(v).toFixed(inst.digits));
        this.live.add(symbol);
        this.onTick?.({ symbol, bid: r(m.b), ask: r(m.a), time: Date.now() });
      } catch { /* messaggio non valido */ }
    });
    this.ws.on('error', (e) => console.warn('[binance] errore:', e.message));
    this.ws.on('close', () => {
      if (!this.stopped) setTimeout(() => this.connect(), 2000);
    });
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
  }
}

/** Unisce più feed: ogni strumento ha la sua fonte. */
export class CompositeFeed implements PriceFeed {
  constructor(private feeds: PriceFeed[]) {}
  start(onTick: (t: RawTick) => void) { this.feeds.forEach((f) => f.start(onTick)); }
  stop() { this.feeds.forEach((f) => f.stop()); }
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
