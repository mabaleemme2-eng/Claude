import WebSocket from 'ws';
import { BY_SYMBOL } from './instruments.js';
import type { Candle, CandleStore, TfKey } from './candles.js';
import { proxyAgent, requestJson } from './httpJson.js';
import type { PriceFeed, RawTick } from './market.js';

/**
 * Hyperliquid, mercati HIP-3 del dex `xyz` (trade.xyz): perpetual su forex, indici, metalli,
 * petrolio e azioni. Dati pubblici, nessuna chiave, tick in tempo reale.
 * Sono prezzi di perpetual (liquidi e allineati allo spot: oro ≈ PAXG, EUR ≈ EURUSDT), non il feed
 * interbancario: per vendere ai clienti serve un contratto con un provider autorizzato.
 */
const WS_URL = process.env.HL_WS ?? 'wss://api.hyperliquid.xyz/ws';
const INFO_URL = process.env.HL_INFO ?? 'https://api.hyperliquid.xyz/info';

/** simbolo piattaforma → mercato Hyperliquid */
export const HL_DIRECT: Record<string, string> = {
  EURUSD: 'xyz:EUR', GBPUSD: 'xyz:GBP', USDJPY: 'xyz:JPY',
  US500: 'xyz:SP500', US100: 'xyz:XYZ100', JP225: 'xyz:JP225',
  XAUUSD: 'xyz:GOLD', XAGUSD: 'xyz:SILVER', USOIL: 'xyz:CL',
  AAPL: 'xyz:AAPL', TSLA: 'xyz:TSLA', NVDA: 'xyz:NVDA', MSFT: 'xyz:MSFT',
};
/** cambi incrociati calcolati dai due lati: num × den^pow */
export const HL_CROSS: Record<string, { a: string; b: string; op: 'mul' | 'div' }> = {
  EURGBP: { a: 'EURUSD', b: 'GBPUSD', op: 'div' },
  EURJPY: { a: 'EURUSD', b: 'USDJPY', op: 'mul' },
  GBPJPY: { a: 'GBPUSD', b: 'USDJPY', op: 'mul' },
};
export const HL_SYMBOLS = [...Object.keys(HL_DIRECT), ...Object.keys(HL_CROSS)];

interface Bbo { bid: number; ask: number }

export class HyperliquidFeed implements PriceFeed {
  private ws?: WebSocket;
  private stopped = false;
  private ping?: NodeJS.Timeout;
  private last = new Map<string, Bbo>();
  private onTick?: (t: RawTick) => void;

  start(onTick: (t: RawTick) => void) {
    this.onTick = onTick;
    this.connect();
  }

  private emit(symbol: string, b: Bbo) {
    const inst = BY_SYMBOL.get(symbol)!;
    const r = (v: number) => Number(v.toFixed(inst.digits));
    this.last.set(symbol, b);
    this.onTick?.({ symbol, bid: r(b.bid), ask: r(b.ask), time: Date.now() });
  }

  private connect() {
    const reverse = new Map(Object.entries(HL_DIRECT).map(([k, v]) => [v, k]));
    this.ws = new WebSocket(WS_URL, proxyAgent ? { agent: proxyAgent } : undefined);
    this.ws.on('open', () => {
      for (const coin of Object.values(HL_DIRECT)) {
        this.ws!.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'bbo', coin } }));
      }
      clearInterval(this.ping);
      this.ping = setInterval(() => this.ws?.send(JSON.stringify({ method: 'ping' })), 30_000);
    });
    this.ws.on('message', (d) => {
      try {
        const m = JSON.parse(String(d));
        if (m.channel !== 'bbo') return;
        const symbol = reverse.get(m.data.coin);
        const [bid, ask] = m.data.bbo ?? [];
        if (!symbol || !bid || !ask) return;
        this.emit(symbol, { bid: Number(bid.px), ask: Number(ask.px) });
        for (const [cross, c] of Object.entries(HL_CROSS)) {
          if (c.a !== symbol && c.b !== symbol) continue;
          const A = this.last.get(c.a);
          const B = this.last.get(c.b);
          if (!A || !B) continue;
          this.emit(cross, c.op === 'mul'
            ? { bid: A.bid * B.bid, ask: A.ask * B.ask }
            : { bid: A.bid / B.ask, ask: A.ask / B.bid });
        }
      } catch { /* messaggio non valido */ }
    });
    this.ws.on('error', (e) => console.warn('[hyperliquid] errore:', e.message));
    this.ws.on('close', () => {
      clearInterval(this.ping);
      if (!this.stopped) setTimeout(() => this.connect(), 2000);
    });
  }

  stop() {
    this.stopped = true;
    clearInterval(this.ping);
    this.ws?.close();
  }
}

const INTERVAL: Record<TfKey, { hl: string; ms: number }> = {
  M1: { hl: '1m', ms: 60_000 }, M5: { hl: '5m', ms: 300_000 }, M15: { hl: '15m', ms: 900_000 },
  H1: { hl: '1h', ms: 3_600_000 }, H4: { hl: '4h', ms: 14_400_000 }, D1: { hl: '1d', ms: 86_400_000 },
};

async function fetchBars(coin: string, tf: TfKey): Promise<Candle[]> {
  const { hl, ms } = INTERVAL[tf];
  const end = Date.now();
  const rows = await requestJson<{ t: number; o: string; h: string; l: string; c: string }[]>(INFO_URL, {
    type: 'candleSnapshot', req: { coin, interval: hl, startTime: end - 1000 * ms, endTime: end },
  });
  return rows.map((k) => ({ time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c }));
}

function combine(a: Candle[], b: Candle[], op: 'mul' | 'div'): Candle[] {
  const bm = new Map(b.map((x) => [x.time, x]));
  const f = (x: number, y: number) => (op === 'mul' ? x * y : x / y);
  const out: Candle[] = [];
  for (const x of a) {
    const y = bm.get(x.time);
    if (!y) continue;
    const o = f(x.open, y.open);
    const c = f(x.close, y.close);
    const ext = [o, c, f(x.high, y.high), f(x.low, y.low), f(x.high, y.low), f(x.low, y.high)];
    out.push({ time: x.time, open: o, close: c, high: Math.max(...ext), low: Math.min(...ext) });
  }
  return out;
}

/** Sostituisce lo storico sintetico con barre reali (le crociere sono composte dalle due componenti). */
export async function loadHyperliquidHistory(store: CandleStore): Promise<string[]> {
  const ok: string[] = [];
  const round = (sym: string, bars: Candle[]) => {
    const d = BY_SYMBOL.get(sym)!.digits;
    const r = (v: number) => Number(v.toFixed(d));
    return bars.map((x) => ({ time: x.time, open: r(x.open), high: r(x.high), low: r(x.low), close: r(x.close) }));
  };
  for (const tf of Object.keys(INTERVAL) as TfKey[]) {
    const data = new Map<string, Candle[]>();
    for (const [sym, coin] of Object.entries(HL_DIRECT)) {
      try { data.set(sym, await fetchBars(coin, tf)); if (tf === 'M1') ok.push(sym); }
      catch (e) { if (tf === 'M1') console.warn(`[hyperliquid] storico ${sym}:`, (e as Error).message); }
    }
    for (const [sym, bars] of data) store.setSeries(sym, tf, round(sym, bars));
    for (const [sym, c] of Object.entries(HL_CROSS)) {
      const a = data.get(c.a); const b = data.get(c.b);
      if (a && b) { store.setSeries(sym, tf, round(sym, combine(a, b, c.op))); if (tf === 'M1') ok.push(sym); }
    }
  }
  return ok;
}
