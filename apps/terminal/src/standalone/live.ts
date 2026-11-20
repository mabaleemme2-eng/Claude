/**
 * Live prices straight from the browser: public WebSocket feeds of Binance, Hyperliquid and Kraken
 * (no keys). Same sources and rules as the server feeds, written for the browser's native WebSocket.
 */
import { INSTRUMENTS, BY_SYMBOL } from '../../../server/src/instruments';
import { CrossBuilder, fxPairs } from '../../../server/src/forex';

export interface LiveTick { symbol: string; bid: number; ask: number; time: number }
export type LiveSource = 'binance' | 'hyperliquid' | 'kraken' | 'cross';

type Handler = (t: LiveTick, source: LiveSource) => void;

function socket(url: string, onOpen: (ws: WebSocket) => void, onMsg: (data: any) => void, keepAliveMs = 0) {
  let closed = false;
  let ws: WebSocket;
  let timer: ReturnType<typeof setInterval> | undefined;
  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      onOpen(ws);
      if (keepAliveMs) { clearInterval(timer); timer = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ method: 'ping' })), keepAliveMs); }
    };
    ws.onmessage = (e) => { try { onMsg(JSON.parse(e.data)); } catch { /* invalid message */ } };
    ws.onclose = () => { clearInterval(timer); if (!closed) setTimeout(connect, 2000); };
    ws.onerror = () => ws.close();
  };
  connect();
  return () => { closed = true; clearInterval(timer); ws.close(); };
}

export function startLive(handler: Handler): () => void {
  const stops: (() => void)[] = [];
  const bySource = (s: string) => INSTRUMENTS.filter((i) => (i.source as string) === s && i.feedId);
  const cross = new CrossBuilder(fxPairs().filter((p) => (BY_SYMBOL.get(p.symbol)?.source as string) === 'cross'));
  const emit = (source: LiveSource) => (t: LiveTick) => handler(t, source);

  const feed = (source: Exclude<LiveSource, 'cross'>, t: LiveTick) => {
    handler(t, source);
    cross.handle(t, emit('cross'));
  };

  const bin = new Map(bySource('binance').map((i) => [i.feedId!, i.symbol]));
  if (bin.size) {
    stops.push(socket('wss://data-stream.binance.vision/ws',
      (ws) => ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: [...bin.keys()].map((s) => `${s.toLowerCase()}@bookTicker`), id: 1 })),
      (m) => { const symbol = bin.get(m.s); if (symbol) feed('binance', { symbol, bid: Number(m.b), ask: Number(m.a), time: Date.now() }); }));
  }

  const hl = new Map(bySource('hyperliquid').map((i) => [i.feedId!, i.symbol]));
  if (hl.size) {
    stops.push(socket('wss://api.hyperliquid.xyz/ws',
      (ws) => { for (const coin of hl.keys()) ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'bbo', coin } })); },
      (m) => {
        if (m.channel !== 'bbo') return;
        const symbol = hl.get(m.data.coin);
        const [bid, ask] = m.data.bbo ?? [];
        if (symbol && bid && ask) feed('hyperliquid', { symbol, bid: Number(bid.px), ask: Number(ask.px), time: Date.now() });
      }, 30_000));
  }

  const kr = new Map(bySource('kraken').map((i) => [i.feedId!, i.symbol]));
  if (kr.size) {
    stops.push(socket('wss://ws.kraken.com/v2',
      (ws) => ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'ticker', symbol: [...kr.keys()], event_trigger: 'bbo' } })),
      (m) => {
        if (m.channel !== 'ticker' || !Array.isArray(m.data)) return;
        for (const x of m.data) {
          const symbol = kr.get(x.symbol);
          if (symbol && x.bid > 0 && x.ask > 0) feed('kraken', { symbol, bid: x.bid, ask: x.ask, time: Date.now() });
        }
      }));
  }
  return () => stops.forEach((s) => s());
}
