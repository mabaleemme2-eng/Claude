import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { BINANCE_MAP, BINANCE_REST } from './market.js';
import type { CandleStore, Candle, TfKey } from './candles.js';

const INTERVAL: Record<TfKey, string> = { M1: '1m', M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1d' };

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

/** GET JSON che rispetta il proxy aziendale (il fetch nativo di Node lo ignora). */
function getJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(url, { agent }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body) as T) : reject(new Error(`HTTP ${res.statusCode}`))));
    }).on('error', reject);
  });
}

/** Scarica lo storico reale delle crypto (klines pubbliche) e sostituisce quello sintetico. */
export async function loadBinanceHistory(store: CandleStore): Promise<string[]> {
  const ok: string[] = [];
  for (const [symbol, pair] of Object.entries(BINANCE_MAP)) {
    try {
      for (const tf of Object.keys(INTERVAL) as TfKey[]) {
        const rows = await getJson<[number, string, string, string, string][]>(
          `${BINANCE_REST}/api/v3/klines?symbol=${pair}&interval=${INTERVAL[tf]}&limit=1000`);
        const bars: Candle[] = rows.map((k) => ({
          time: Math.floor(k[0] / 1000), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]),
        }));
        store.setSeries(symbol, tf, bars);
      }
      ok.push(symbol);
    } catch (e) {
      console.warn(`[binance] storico ${symbol} non disponibile, resto il sintetico:`, (e as Error).message);
    }
  }
  return ok;
}
