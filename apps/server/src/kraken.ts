import WebSocket from 'ws';
import { INSTRUMENTS } from './instruments.js';
import { proxyAgent } from './httpJson.js';
import type { PriceFeed, RawTick } from './market.js';

const KRAKEN_WS = process.env.KRAKEN_WS ?? 'wss://ws.kraken.com/v2';

/** Forex spot da Kraken (WebSocket v2, canale ticker, dati pubblici senza chiave). */
export class KrakenFeed implements PriceFeed {
  private ws?: WebSocket;
  private stopped = false;
  private onTick?: (t: RawTick) => void;

  start(onTick: (t: RawTick) => void) {
    this.onTick = onTick;
    this.connect();
  }

  private connect() {
    const map = new Map(INSTRUMENTS.filter((i) => i.source === 'kraken').map((i) => [i.feedId!, i.symbol]));
    if (!map.size) return;
    this.ws = new WebSocket(KRAKEN_WS, proxyAgent ? { agent: proxyAgent } : undefined);
    this.ws.on('open', () => this.ws!.send(JSON.stringify({
      method: 'subscribe', params: { channel: 'ticker', symbol: [...map.keys()], event_trigger: 'bbo' },
    })));
    this.ws.on('message', (d) => {
      try {
        const m = JSON.parse(String(d));
        if (m.channel !== 'ticker' || !Array.isArray(m.data)) return;
        for (const x of m.data) {
          const symbol = map.get(x.symbol);
          if (symbol && x.bid > 0 && x.ask > 0) this.onTick?.({ symbol, bid: x.bid, ask: x.ask, time: Date.now() });
        }
      } catch { /* messaggio non valido */ }
    });
    this.ws.on('error', (e) => console.warn('[kraken] errore:', e.message));
    this.ws.on('close', () => { if (!this.stopped) setTimeout(() => this.connect(), 2000); });
  }

  stop() { this.stopped = true; this.ws?.close(); }
}
