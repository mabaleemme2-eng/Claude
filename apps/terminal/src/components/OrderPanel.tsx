import { useState } from 'react';
import { api, type Account, type Instrument } from '../api';
import { setAccount, useTicks } from '../feed';

export default function OrderPanel({ inst }: { inst: Instrument }) {
  const t = useTicks()[inst.symbol];
  const [type, setType] = useState<'market' | 'limit' | 'stop'>('market');
  const [lots, setLots] = useState(String(inst.minLot));
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [lastSym, setLastSym] = useState(inst.symbol);
  if (lastSym !== inst.symbol) { setLastSym(inst.symbol); setLots(String(inst.minLot)); setSl(''); setTp(''); setPrice(''); setMsg(undefined); }

  const spread = t ? (t.ask - t.bid) / inst.pip : 0;
  const send = async (side: 'buy' | 'sell') => {
    try {
      const a = await api<Account>('/api/orders', { method: 'POST', body: { symbol: inst.symbol, side, type, lots: Number(lots), price: price || undefined, sl: sl || undefined, tp: tp || undefined } });
      setAccount(a);
      setMsg({ ok: true, text: type === 'market' ? `${side === 'buy' ? 'Buy' : 'Sell'} executed` : 'Pending order placed' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const step = (dir: number) => setLots(String(Math.max(inst.minLot, Math.min(inst.maxLot, Number((Number(lots) + dir * inst.lotStep).toFixed(2))))));

  return (
    <aside className="order">
      <h3>{inst.symbol} <small>{inst.name}</small></h3>
      <div className="seg full">
        {(['market', 'limit', 'stop'] as const).map((x) => <button key={x} className={type === x ? 'on' : ''} onClick={() => setType(x)}>{x === 'market' ? 'Market' : x === 'limit' ? 'Limit' : 'Stop'}</button>)}
      </div>
      <div className="quote-btns">
        <button className="sell" onClick={() => send('sell')}><small>SELL</small><b>{t ? t.bid.toFixed(inst.digits) : '—'}</b></button>
        <span className="spread">{spread.toFixed(1)}</span>
        <button className="buy" onClick={() => send('buy')}><small>BUY</small><b>{t ? t.ask.toFixed(inst.digits) : '—'}</b></button>
      </div>
      <label>Volume (lots)</label>
      <div className="stepper"><button onClick={() => step(-1)}>−</button><input value={lots} onChange={(e) => setLots(e.target.value)} /><button onClick={() => step(1)}>+</button></div>
      {type !== 'market' && (<><label>Order price</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t?.bid.toFixed(inst.digits)} /></>)}
      <label>Stop Loss (price)</label><input value={sl} onChange={(e) => setSl(e.target.value)} placeholder="optional" />
      <label>Take Profit (price)</label><input value={tp} onChange={(e) => setTp(e.target.value)} placeholder="optional" />
      <p className="hint">Contract: {inst.contractSize.toLocaleString('en-US')} · Lots {inst.minLot}–{inst.maxLot} · Pip {inst.pip}</p>
      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'}>{msg.text}</p>}
    </aside>
  );
}
