import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { INSTRUMENTS, BY_SYMBOL } from './instruments.js';
import { BinanceFeed, CompositeFeed, Market, SimulatedFeed } from './market.js';
import { HyperliquidFeed } from './hyperliquid.js';
import { KrakenFeed } from './kraken.js';
import { buildCatalog } from './catalog.js';
import { registerLoaders } from './loaders.js';
import { CandleStore, TF, type TfKey } from './candles.js';
import { PricingStore, applySpread, resolveSpreadRule, resolveSwap, sessionMultiplier, type GroupConfig } from './pricing.js';
import { TradingEngine } from './trading.js';

/** USE_REAL_FEEDS=0 per tornare a tutto simulato (es. senza accesso a internet). */
const REAL = process.env.USE_REAL_FEEDS !== '0';
if (REAL) await buildCatalog();

const PORT = Number(process.env.PORT ?? 4000);
/** Chiave amministratore provvisoria: da sostituire con vera autenticazione (JWT/RBAC) nel CRM. */
const PROD = process.env.NODE_ENV === 'production';
const GENERATED_KEY = !process.env.ADMIN_KEY && PROD;
const ADMIN_KEY = process.env.ADMIN_KEY ?? (PROD ? randomBytes(12).toString('hex') : 'dev-admin');

const pricing = new PricingStore();
const market = new Market(new CompositeFeed([
  new SimulatedFeed(),
  ...(REAL ? [new BinanceFeed(), new HyperliquidFeed(), new KrakenFeed()] : []),
]));
const candles = new CandleStore();
if (REAL) registerLoaders(candles);
{
  const by = (src: string) => INSTRUMENTS.filter((i) => i.source === src).length;
  console.log(`Strumenti: ${INSTRUMENTS.length} · live: binance ${by('binance')}, hyperliquid ${by('hyperliquid')}, kraken ${by('kraken')}, incroci ${by('cross')} · simulati: ${INSTRUMENTS.filter((i) => i.source === 'sim').map((i) => i.symbol).join(', ') || 'nessuno'}`);
}
const engine = new TradingEngine(market, pricing);
/** Conto di riferimento: serve solo per costruire le candele (prezzo bid del gruppo standard). */
const demo = engine.createAccount('demo', 'Conto Demo', 'standard', 10000);

/** Ogni browser ha il suo conto demo (id generato dal client): chi apre il link non tocca i conti degli altri. */
const MAX_ACCOUNTS = 500;
const touched = new Map<string, number>();
function accountOf(id: unknown) {
  const key = typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id) ? id : 'demo';
  let a = engine.accounts.get(key);
  if (!a) {
    if (engine.accounts.size >= MAX_ACCOUNTS) {
      const oldest = [...touched.entries()].filter(([k]) => k !== 'demo').sort((x, y) => x[1] - y[1])[0];
      if (oldest) { engine.accounts.delete(oldest[0]); touched.delete(oldest[0]); }
    }
    a = engine.createAccount(key, 'Conto Demo', 'standard', 10000);
  }
  touched.set(key, Date.now());
  return a;
}

// ───────────── interfaccia web (build di apps/terminal) servita dallo stesso indirizzo ─────────────
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../terminal/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
function serveStatic(urlPath: string, res: http.ServerResponse) {
  let file = path.join(WEB_ROOT, decodeURIComponent(urlPath));
  if (!file.startsWith(WEB_ROOT)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html'); // SPA
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Interfaccia non compilata: esegui "npm run build".');
    return;
  }
  const ext = path.extname(file);
  const hashed = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

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
  if (m === 'GET' && !p.startsWith('/api')) return serveStatic(p, res);
  const acc = accountOf(req.headers['x-account-id']);

  try {
    if (m === 'GET' && p === '/api/instruments') return send(INSTRUMENTS.map(({ vol, start, ...i }) => i));

    if (m === 'GET' && p === '/api/candles') {
      const tf = (url.searchParams.get('tf') ?? 'M1') as TfKey;
      if (!(tf in TF)) throw new HttpError(400, 'timeframe non valida');
      const symbol = url.searchParams.get('symbol') ?? '';
      if (!BY_SYMBOL.has(symbol)) throw new HttpError(404, 'simbolo sconosciuto');
      await candles.ensure(symbol, tf);
      return send(candles.get(symbol, tf, Number(url.searchParams.get('limit') ?? 500)));
    }

    if (m === 'GET' && p === '/api/account') return send(engine.snapshot(acc));
    if (m === 'GET' && p === '/api/groups') return send(pricing.config.groups.map((g) => ({ id: g.id, name: g.name })));
    if (m === 'POST' && p === '/api/account/group') {
      const b = await readBody(req);
      if (!pricing.config.groups.some((g) => g.id === b.groupId)) throw new HttpError(400, 'gruppo sconosciuto');
      acc.groupId = b.groupId;
      return send(engine.snapshot(acc));
    }
    if (m === 'POST' && p === '/api/account/reset') {
      acc.balance = 10000; acc.positions = []; acc.pending = []; acc.history = [];
      return send(engine.snapshot(acc));
    }

    if (m === 'POST' && p === '/api/orders') {
      const b = await readBody(req);
      if (b.type === 'limit' || b.type === 'stop') {
        engine.placePending(acc, b.symbol, b.side, b.type, Number(b.lots), Number(b.price), num(b.sl), num(b.tp));
      } else {
        engine.openMarket(acc, b.symbol, b.side, Number(b.lots), num(b.sl), num(b.tp));
      }
      return send(engine.snapshot(acc));
    }
    let mm = p.match(/^\/api\/positions\/(\d+)$/);
    if (mm && m === 'DELETE') { engine.closePosition(acc, Number(mm[1])); return send(engine.snapshot(acc)); }
    if (mm && m === 'PATCH') {
      const b = await readBody(req);
      engine.modifyPosition(acc, Number(mm[1]), num(b.sl), num(b.tp));
      return send(engine.snapshot(acc));
    }
    mm = p.match(/^\/api\/pending\/(\d+)$/);
    if (mm && m === 'DELETE') { engine.cancelPending(acc, Number(mm[1])); return send(engine.snapshot(acc)); }

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
        return send({ positionsCharged: n, account: engine.snapshot(acc) });
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
const clients = new Map<WebSocket, { acc: ReturnType<typeof accountOf>; lastPush: number }>();
wss.on('connection', (ws, req) => {
  const acc = accountOf(new URL(req.url ?? '/', 'http://x').searchParams.get('acc'));
  clients.set(ws, { acc, lastPush: Date.now() });
  // snapshot dei prezzi attuali: i mercati poco mossi non manderebbero nulla finché non cambiano
  for (const i of INSTRUMENTS) {
    const q = engine.quote(acc, i.symbol);
    const raw = market.raw(i.symbol);
    if (q && raw) ws.send(JSON.stringify({ type: 'tick', symbol: i.symbol, bid: q.bid, ask: q.ask, time: raw.time }));
  }
  ws.send(JSON.stringify({ type: 'account', data: engine.snapshot(acc) }));
  ws.on('close', () => clients.delete(ws));
});

market.on('tick', (t) => {
  const ref = engine.quote(demo, t.symbol, new Date(t.time));
  if (ref) candles.update(t.symbol, t.time, ref.bid);
  const changed = engine.onTick(t.symbol);
  const now = Date.now();
  for (const [c, st] of clients) {
    if (c.readyState !== c.OPEN) continue;
    const q = engine.quote(st.acc, t.symbol, new Date(t.time));
    if (q) c.send(JSON.stringify({ type: 'tick', symbol: t.symbol, bid: q.bid, ask: q.ask, time: t.time }));
    if (changed || now - st.lastPush > 400) {
      st.lastPush = now;
      c.send(JSON.stringify({ type: 'account', data: engine.snapshot(st.acc) }));
    }
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

server.listen(PORT, () => {
  console.log(`Piattaforma su http://localhost:${PORT}`);
  if (GENERATED_KEY) console.log(`CHIAVE ADMIN generata (imposta ADMIN_KEY per fissarla): ${ADMIN_KEY}`);
  else if (ADMIN_KEY === 'dev-admin') console.log('Chiave admin di sviluppo: dev-admin');
});
