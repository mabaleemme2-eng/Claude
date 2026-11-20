import WebSocket from 'ws';
import { INSTRUMENTS } from './instruments.js';
import { proxyAgent, requestJson } from './httpJson.js';
import type { PriceFeed, RawTick } from './market.js';

/**
 * Hyperliquid, mercati HIP-3 del dex `xyz` (trade.xyz): perpetual su indici, metalli, energia,
 * agricoli e azioni. Dati pubblici, nessuna chiave, tick in tempo reale. Sono prezzi di perpetual
 * (liquidi e allineati allo spot), non il feed del mercato di riferimento.
 */
export const HL_WS = process.env.HL_WS ?? 'wss://api.hyperliquid.xyz/ws';
export const HL_INFO = process.env.HL_INFO ?? 'https://api.hyperliquid.xyz/info';

export class HyperliquidFeed implements PriceFeed {
  private ws?: WebSocket;
  private stopped = false;
  private ping?: NodeJS.Timeout;
  private onTick?: (t: RawTick) => void;

  start(onTick: (t: RawTick) => void) {
    this.onTick = onTick;
    this.connect();
  }

  private connect() {
    const map = new Map(INSTRUMENTS.filter((i) => i.source === 'hyperliquid').map((i) => [i.feedId!, i.symbol]));
    if (!map.size) return;
    void this.seed(map);
    this.ws = new WebSocket(HL_WS, proxyAgent ? { agent: proxyAgent } : undefined);
    this.ws.on('open', () => {
      for (const coin of map.keys()) this.ws!.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'bbo', coin } }));
      clearInterval(this.ping);
      this.ping = setInterval(() => this.ws?.send(JSON.stringify({ method: 'ping' })), 30_000);
    });
    this.ws.on('message', (d) => {
      try {
        const m = JSON.parse(String(d));
        if (m.channel !== 'bbo') return;
        const symbol = map.get(m.data.coin);
        const [bid, ask] = m.data.bbo ?? [];
        if (symbol && bid && ask) this.onTick?.({ symbol, bid: Number(bid.px), ask: Number(ask.px), time: Date.now() });
      } catch { /* messaggio non valido */ }
    });
    this.ws.on('error', (e) => console.warn('[hyperliquid] errore:', e.message));
    this.ws.on('close', () => {
      clearInterval(this.ping);
      if (!this.stopped) setTimeout(() => this.connect(), 2000);
    });
  }

  /** Il WebSocket invia solo le variazioni: parto dal book attuale così anche i titoli poco scambiati hanno un prezzo. */
  private async seed(map: Map<string, string>) {
    const coins = [...map.keys()];
    for (let i = 0; i < coins.length; i += 8) {
      await Promise.all(coins.slice(i, i + 8).map(async (coin) => {
        try {
          const b = await requestJson<{ levels: { px: string }[][] }>(HL_INFO, { type: 'l2Book', coin });
          const bid = Number(b.levels[0]?.[0]?.px);
          const ask = Number(b.levels[1]?.[0]?.px);
          if (bid > 0 && ask >= bid) this.onTick?.({ symbol: map.get(coin)!, bid, ask, time: Date.now() });
        } catch { /* il WebSocket lo recupera */ }
      }));
    }
  }

  stop() { this.stopped = true; clearInterval(this.ping); this.ws?.close(); }
}
