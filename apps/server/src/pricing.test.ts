import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BY_SYMBOL } from './instruments.js';
import { applySpread, defaultConfig, resolveSpreadRule, resolveSwap, sessionMultiplier, swapAmountUsd } from './pricing.js';

const eur = BY_SYMBOL.get('EURUSD')!;
const raw = { bid: 1.08440, ask: 1.08450 }; // 1 pip grezzo

test('markup_pips aggiunge pip allo spread grezzo, mantenendo il mid', () => {
  const q = applySpread(raw, eur, { mode: 'markup_pips', value: 1.2 });
  assert.equal(Number(((q.ask - q.bid) / eur.pip).toFixed(2)), 2.2);
  assert.equal(Number(((q.ask + q.bid) / 2).toFixed(5)), 1.08445);
});

test('fixed ignora lo spread grezzo; min/max limitano', () => {
  assert.equal(Number(((applySpread(raw, eur, { mode: 'fixed', value: 2 }).ask - applySpread(raw, eur, { mode: 'fixed', value: 2 }).bid) / eur.pip).toFixed(2)), 2);
  const q = applySpread(raw, eur, { mode: 'markup_pct', value: 0, min: 3 });
  assert.equal(Number(((q.ask - q.bid) / eur.pip).toFixed(2)), 3);
});

test('ordine di risoluzione: cliente > simbolo gruppo > classe', () => {
  const g = defaultConfig().groups[0];
  assert.deepEqual(resolveSpreadRule(g, eur), g.symbolSpread.EURUSD);
  const own = { mode: 'raw', value: 0 } as const;
  assert.deepEqual(resolveSpreadRule(g, eur, { EURUSD: own }), own);
  assert.deepEqual(resolveSpreadRule(g, BY_SYMBOL.get('GBPUSD')!), g.classSpread.forex);
});

test('sessione di rollover allarga lo spread', () => {
  const g = defaultConfig().groups[0];
  assert.equal(sessionMultiplier(g, eur, new Date('2026-03-04T22:00:00Z')), 4);
  assert.equal(sessionMultiplier(g, eur, new Date('2026-03-04T12:00:00Z')), 1);
});

test('swap: markup sugli addebiti, triplo il mercoledì, swap-free = 0', () => {
  const g = defaultConfig().groups[0];
  const s = resolveSwap(g, eur); // long -6.5 pip, markup 20% → -7.8
  assert.equal(Number(s.long.toFixed(2)), -7.8);
  const wed = new Date('2026-03-04T22:00:00Z'); // mercoledì
  const thu = new Date('2026-03-05T22:00:00Z');
  const a = swapAmountUsd(eur, s, 'buy', 1, 1, 108450, thu);
  assert.equal(Number(a.toFixed(2)), -78); // 7,8 pip x 10$
  assert.equal(Number(swapAmountUsd(eur, s, 'buy', 1, 1, 108450, wed).toFixed(2)), -234);
  const islamic = resolveSwap(defaultConfig().groups[2], eur);
  assert.equal(islamic.long, 0);
});
