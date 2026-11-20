// Takes a snapshot of the running platform (instruments, current prices, recent real history)
// and writes it to apps/terminal/demo-data. The browser-only demo is built from this snapshot.
// Usage: node scripts/snapshot.mjs [serverUrl] [adminKey]
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4000';
const KEY = process.argv[3] ?? 'dev-admin';
const OUT = path.resolve('apps/terminal/demo-data');
const BARS = { M5: 300, H1: 250, D1: 150 };

const get = async (p, headers = {}) => {
  const r = await fetch(BASE + p, { headers });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const round = (v) => Number(v.toPrecision(9));

fs.mkdirSync(path.join(OUT, 'history'), { recursive: true });
const instruments = await get('/api/instruments');
fs.writeFileSync(path.join(OUT, 'instruments.json'), JSON.stringify(instruments));

const prices = {};
const queue = instruments.map((i) => i.symbol);
let done = 0;
async function worker() {
  while (queue.length) {
    const symbol = queue.shift();
    try {
      const pv = await get(`/api/admin/preview?symbol=${symbol}&group=ecn`, { 'x-admin-key': KEY });
      prices[symbol] = [pv.raw.bid, pv.raw.ask];
      const hist = {};
      for (const [tf, n] of Object.entries(BARS)) {
        const c = await get(`/api/candles?symbol=${symbol}&tf=${tf}&limit=${n}`);
        hist[tf] = c.map((x) => [x.time, round(x.open), round(x.high), round(x.low), round(x.close)]);
      }
      fs.writeFileSync(path.join(OUT, 'history', `${symbol}.json`), JSON.stringify(hist));
    } catch (e) {
      console.warn('skip', symbol, e.message);
    }
    if (++done % 20 === 0) console.log(`${done}/${instruments.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(path.join(OUT, 'prices.json'), JSON.stringify({ takenAt: new Date().toISOString(), prices }));
console.log(`snapshot: ${Object.keys(prices).length} instruments at ${new Date().toISOString()}`);
