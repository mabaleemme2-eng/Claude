import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { INSTRUMENTS, BY_SYMBOL } from './instruments.js';
import { BINANCE_MAP, BinanceFeed, CompositeFeed, Market, SimulatedFeed } from './market.js';
import { loadBinanceHistory } from './binanceHistory.js';
import { HL_SYMBOLS, HyperliquidFeed, loadHyperliquidHistory } from './hyperliquid.js';
import { CandleStore, TF, type TfKey } from './candles.js';
import { PricingStore, applySpread, resolveSpreadRule, resolveSwap, sessionMultiplier, type GroupConfig } from './pricing.js';
import { TradingEngine } from './trading.js';

const PORT = Number(process.env.PORT ?? 4000);
/** Chiave amministratore provvisoria: da sostituire con vera autenticazione (JWT/RBAC) nel CRM. */
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin';

const pricing = new PricingStore();
/** USE_REAL_FEEDS=0 per tornare a tutto simulato (es. senza accesso a internet). */
const REAL = process.env.USE_REAL_FEEDS !== '0';
const realSymbols = new Set(REAL ? [...Object.keys(BINANCE_MAP), ...HL_SYMBOLS] : []);
const market = new Market(new CompositeFeed([
  new SimulatedFeed(new Set(INSTRUMENTS.map((i) => i.symbol).filter((s) => !realSymbols.has(s)))),
  ...(REAL ? [new BinanceFeed(), new HyperliquidFeed()] : []),
]));
const candles = new CandleStore();
if (REAL) {
  void loadBinanceHistory(candles).then((ok) => console.log(`[binance] storico reale: ${ok.join(', ') || 'nessuno'}`));
  void loadHyperliquidHistory(candles).then((ok) => console.log(`[hyperliquid] storico reale: ${ok.join(', ') || 'nessuno'}`));
  console.log(`Prezzi LIVE: crypto (Binance) + forex/indici/metalli/azioni (Hyperliquid). Ancora simulati: ${
    INSTRUMENTS.map((i) => i.symbol).filter((x) => !realSymbols.has(x)).join(', ')}`);
}
const engine = new TradingEngine(market, pricing);
const demo = engine.createAccount('demo', 'Conto Demo', 'standard', 10000);

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

const readBody = (req: http.IncomingMessage) =>
  new Promise<any>((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e6) reject(new HttpError(413, 'payload troppo grande')); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new HttpError(400, 'JSON non valido')); } });
  });

const num = (v: unknown): number | undefined => (v === undefined || v === null || v === '' ? undefined : Number(v));

function isAdmin(req: http.IncomingMessage) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) throw new HttpError(401, 'chiave amministratore mancante o errata');
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  const m = req.method ?? 'GET';
  const send = (data: unknown, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-admin-key', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE' });
    res.end(JSON.stringify(data));
  };
  if (m === 'OPTIONS') return send({});

  try {
    if (m === 'GET' && p === '/api/instruments') return send(INSTRUMENTS.map(({ vol, start, ...i }) => i));

    if (m === 'GET' && p === '/api/candles') {
      const tf = (url.searchParams.get('tf') ?? 'M1') as TfKey;
      if (!(tf in TF)) throw new HttpError(400, 'timeframe non valida');
      return send(candles.get(url.searchParams.get('symbol') ?? '', tf, Number(url.searchParams.get('limit') ?? 500)));
    }

    if (m === 'GET' && p === '/api/account') return send(engine.snapshot(demo));
    if (m === 'GET' && p === '/api/groups') return send(pricing.config.groups.map((g) => ({ id: g.id, name: g.name })));
    if (m === 'POST' && p === '/api/account/group') {
      const b = await readBody(req);
      if (!pricing.config.groups.some((g) => g.id === b.groupId)) throw new HttpError(400, 'gruppo sconosciuto');
      demo.groupId = b.groupId;
      return send(engine.snapshot(demo));
    }
    if (m === 'POST' && p === '/api/account/reset') {
      demo.balance = 10000; demo.positions = []; demo.pending = []; demo.history = [];
      return send(engine.snapshot(demo));
    }

    if (m === 'POST' && p === '/api/orders') {
      const b = await readBody(req);
      if (b.type === 'limit' || b.type === 'stop') {
        engine.placePending(demo, b.symbol, b.side, b.type, Number(b.lots), Number(b.price), num(b.sl), num(b.tp));
      } else {
        engine.openMarket(demo, b.symbol, b.side, Number(b.lots), num(b.sl), num(b.tp));
      }
      return send(engine.snapshot(demo));
    }
    let mm = p.match(/^\/api\/positions\/(\d+)$/);
    if (mm && m === 'DELETE') { engine.closePosition(demo, Number(mm[1])); return send(engine.snapshot(demo)); }
    if (mm && m === 'PATCH') {
      const b = await readBody(req);
      engine.modifyPosition(demo, Number(mm[1]), num(b.sl), num(b.tp));
      return send(engine.snapshot(demo));
    }
    mm = p.match(/^\/api\/pending\/(\d+)$/);
    if (mm && m === 'DELETE') { engine.cancelPending(demo, Number(mm[1])); return send(engine.snapshot(demo)); }

    // ── amministrazione prezzi ──
    if (p.startsWith('/api/admin/')) {
      isAdmin(req);
      if (m === 'GET' && p === '/api/admin/pricing') return send(pricing.config);
      if (m === 'PUT' && p === '/api/admin/pricing') {
        const g = (await readBody(req)) as GroupConfig;
        pricing.updateGroup(g);
        return send(g);
      }
      if (m === 'POST' && p === '/api/admin/pricing/reset') { pricing.reset(); return send(pricing.config); }
      if (m === 'POST' && p === '/api/admin/rollover') {
        const n = engine.applyRollover(new Date(), (await readBody(req)).groupId);
        return send({ positionsCharged: n, account: engine.snapshot(demo) });
      }
      // anteprima: grezzo vs prezzo cliente e swap effettivo per un gruppo
      if (m === 'GET' && p === '/api/admin/preview') {
        const inst = BY_SYMBOL.get(url.searchParams.get('symbol') ?? '');
        if (!inst) throw new HttpError(400, 'simbolo sconosciuto');
        const group = pricing.group(url.searchParams.get('group') ?? 'standard');
        const raw = market.raw(inst.symbol);
        if (!raw) throw new HttpError(503, 'prezzo non ancora disponibile');
        const rule = resolveSpreadRule(group, inst);
        const q = applySpread(raw, inst, rule, sessionMultiplier(group, inst, new Date()));
        return send({
          raw: { bid: raw.bid, ask: raw.ask, spreadPips: Number(((raw.ask - raw.bid) / inst.pip).toFixed(2)) },
          client: { ...q, spreadPips: Number(((q.ask - q.bid) / inst.pip).toFixed(2)) },
          rule, swap: resolveSwap(group, inst), commissionPerLot: group.commissionPerLot[inst.cls],
        });
      }
    }
    throw new HttpError(404, 'non trovato');
  } catch (e) {
    const err = e as Error;
    send({ error: err.message }, e instanceof HttpError ? e.status : 400);
  }
}

const server = http.createServer((req, res) => { void handle(req, res); });
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'account', data: engine.snapshot(demo) }));
  ws.on('close', () => clients.delete(ws));
});

let lastAccountPush = 0;
market.on('tick', (t) => {
  const q = engine.quote(demo, t.symbol, new Date(t.time));
  if (q) candles.update(t.symbol, t.time, q.bid);
  const changed = engine.onTick(t.symbol);
  const now = Date.now();
  const pushAccount = changed || now - lastAccountPush > 400;
  if (pushAccount) lastAccountPush = now;
  if (!clients.size) return;
  const tick = JSON.stringify({ type: 'tick', symbol: t.symbol, bid: q?.bid, ask: q?.ask, time: t.time });
  const acct = pushAccount ? JSON.stringify({ type: 'account', data: engine.snapshot(demo) }) : null;
  for (const c of clients) {
    if (c.readyState !== c.OPEN) continue;
    c.send(tick);
    if (acct) c.send(acct);
  }
});

// rollover automatico alla stessa ora UTC del gruppo
let lastRollover = '';
setInterval(() => {
  const now = new Date();
  const key = now.toISOString().slice(0, 10);
  const hour = pricing.group(demo.groupId).rolloverHourUtc;
  if (now.getUTCHours() >= hour && lastRollover !== key) {
    lastRollover = key;
    engine.applyRollover(now);
  }
}, 30_000);

server.listen(PORT, () => console.log(`API + WebSocket su http://localhost:${PORT}  (admin key: ${ADMIN_KEY === 'dev-admin' ? 'dev-admin' : '***'})`));
