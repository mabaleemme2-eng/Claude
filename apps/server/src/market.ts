import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { BY_SYMBOL, INSTRUMENTS, type Instrument } from './instruments.js';
import { CrossBuilder, fxPairs } from './forex.js';
import { proxyAgent } from './httpJson.js';

export interface RawTick {
  symbol: string;
  bid: number;
  ask: number;
  time: number; // ms
}

/**
 * Interfaccia da implementare per agganciare un provider reale
 * (FIX / WebSocket, bridge MT5…). Il resto della piattaforma consuma solo RawTick.
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

/** Feed simulato per gli strumenti senza fonte live (source = 'sim'). */
export class SimulatedFeed implements PriceFeed {
  private mids = new Map<string, number>();
  private timer?: NodeJS.Timeout;

  start(onTick: (t: RawTick) => void) {
    const list = INSTRUMENTS.filter((i) => i.source === 'sim');
    for (const i of list) this.mids.set(i.symbol, i.start);
    this.timer = setInterval(() => {
      for (const i of list) {
        if (Math.random() > 0.7) continue;
        onTick(this.step(i));
      }
    }, 250);
  }

  stop() { clearInterval(this.timer); }

  private step(i: Instrument): RawTick {
    let mid = this.mids.get(i.symbol)!;
    mid *= 1 + gauss() * i.vol + ((i.start - mid) / i.start) * 0.0005;
    this.mids.set(i.symbol, mid);
    const half = (i.rawSpreadPips * i.pip * (0.85 + Math.random() * 0.4)) / 2;
    return { symbol: i.symbol, bid: mid - half, ask: mid + half, time: Date.now() };
  }
}

export const BINANCE_WS = process.env.BINANCE_WS ?? 'wss://data-stream.binance.vision';
export const BINANCE_REST = process.env.BINANCE_REST ?? 'https://data-api.binance.vision';

/** Crypto spot da Binance (stream bookTicker, dati pubblici senza chiave). USDT trattato come USD. */
export class BinanceFeed implements PriceFeed {
  private ws?: WebSocket;
  private stopped = false;
  private onTick?: (t: RawTick) => void;

  start(onTick: (t: RawTick) => void) {
    this.onTick = onTick;
    this.connect();
  }

  private connect() {
    const map = new Map(INSTRUMENTS.filter((i) => i.source === 'binance').map((i) => [i.feedId!, i.symbol]));
    if (!map.size) return;
    this.ws = new WebSocket(`${BINANCE_WS}/ws`, proxyAgent ? { agent: proxyAgent } : undefined);
    this.ws.on('open', () => this.ws!.send(JSON.stringify({
      method: 'SUBSCRIBE', params: [...map.keys()].map((s) => `${s.toLowerCase()}@bookTicker`), id: 1,
    })));
    this.ws.on('message', (d) => {
      try {
        const m = JSON.parse(String(d));
        const symbol = map.get(m.s);
        if (symbol) this.onTick?.({ symbol, bid: Number(m.b), ask: Number(m.a), time: Date.now() });
      } catch { /* messaggio non valido */ }
    });
    this.ws.on('error', (e) => console.warn('[binance] errore:', e.message));
    this.ws.on('close', () => { if (!this.stopped) setTimeout(() => this.connect(), 2000); });
  }

  stop() { this.stopped = true; this.ws?.close(); }
}

/** Unisce più feed e aggiunge i cambi incrociati calcolati dai cambi con il dollaro. */
export class CompositeFeed implements PriceFeed {
  constructor(private feeds: PriceFeed[]) {}
  start(onTick: (t: RawTick) => void) {
    const cross = new CrossBuilder(fxPairs().filter((p) => BY_SYMBOL.get(p.symbol)?.source === 'cross'));
    const wrapped = (t: RawTick) => { onTick(t); cross.handle(t, onTick); };
    this.feeds.forEach((f) => f.start(wrapped));
  }
  stop() { this.feeds.forEach((f) => f.stop()); }
}

const MIN_INTERVAL_MS = 150;

/** Ultimo prezzo grezzo per strumento + evento 'tick' (al massimo uno ogni 150 ms per simbolo). */
export class Market extends EventEmitter {
  private last = new Map<string, RawTick>();
  private pending = new Set<string>();

  constructor(feed: PriceFeed) {
    super();
    feed.start((t) => this.ingest(t));
  }

  private ingest(t: RawTick) {
    const inst = BY_SYMBOL.get(t.symbol);
    if (!inst || !(t.bid > 0) || !(t.ask >= t.bid)) return;
    // quotazioni forex con spread assurdo = mercato illiquido: meglio nessun aggiornamento che un prezzo falso
    if (inst.cls === 'forex' && (t.ask - t.bid) / t.bid > 0.003) return;
    const r = (v: number) => Number(v.toFixed(inst.digits));
    this.last.set(t.symbol, { ...t, bid: r(t.bid), ask: r(t.ask) });
    if (this.pending.has(t.symbol)) return;
    this.pending.add(t.symbol);
    setTimeout(() => {
      this.pending.delete(t.symbol);
      this.emit('tick', this.last.get(t.symbol));
    }, MIN_INTERVAL_MS);
  }

  raw(symbol: string): RawTick | undefined { return this.last.get(symbol); }

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
