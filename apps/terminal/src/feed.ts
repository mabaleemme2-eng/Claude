import { useSyncExternalStore } from 'react';
import type { Account } from './api';

export interface Tick { bid: number; ask: number; dir: 1 | -1 | 0 }
type TickListener = (symbol: string, t: Tick, time: number) => void;

let ticks: Record<string, Tick> = {};
let account: Account | null = null;
let connected = false;
const subs = new Set<() => void>();
const tickListeners = new Set<TickListener>();
// con centinaia di tick al secondo si aggiorna l'interfaccia al massimo una volta per frame
let scheduled = false;
const flush = () => { scheduled = false; subs.forEach((f) => f()); };
const notify = () => {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush); else setTimeout(flush, 16);
};

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => { connected = true; notify(); };
  ws.onclose = () => { connected = false; notify(); setTimeout(connect, 1500); };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'tick' && m.bid !== undefined) {
      const prev = ticks[m.symbol];
      const t: Tick = { bid: m.bid, ask: m.ask, dir: prev ? (m.bid > prev.bid ? 1 : m.bid < prev.bid ? -1 : prev.dir) : 0 };
      ticks = { ...ticks, [m.symbol]: t };
      tickListeners.forEach((l) => l(m.symbol, t, m.time));
    } else if (m.type === 'account') account = m.data;
    notify();
  };
}
connect();

const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export const useTicks = () => useSyncExternalStore(subscribe, () => ticks);
export const useAccount = () => useSyncExternalStore(subscribe, () => account);
export const useConnected = () => useSyncExternalStore(subscribe, () => connected);
export const onTick = (l: TickListener) => { tickListeners.add(l); return () => { tickListeners.delete(l); }; };
export const setAccount = (a: Account) => { account = a; notify(); };
