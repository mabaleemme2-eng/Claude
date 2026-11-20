import { useState } from 'react';
import { api, type Account, type Instrument } from '../api';
import { setAccount, useTicks } from '../feed';
import { instName, locale, t, tErr, useLang } from '../i18n';

export default function OrderPanel({ inst }: { inst: Instrument }) {
  useLang();
  const tick = useTicks()[inst.symbol];
  const [type, setType] = useState<'market' | 'limit' | 'stop'>('market');
  const [lots, setLots] = useState(String(inst.minLot));
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [lastSym, setLastSym] = useState(inst.symbol);
  if (lastSym !== inst.symbol) { setLastSym(inst.symbol); setLots(String(inst.minLot)); setSl(''); setTp(''); setPrice(''); setMsg(undefined); }

  const spread = tick ? (tick.ask - tick.bid) / inst.pip : 0;
  const send = async (side: 'buy' | 'sell') => {
    try {
      const a = await api<Account>('/api/orders', { method: 'POST', body: { symbol: inst.symbol, side, type, lots: Number(lots), price: price || undefined, sl: sl || undefined, tp: tp || undefined } });
      setAccount(a);
      setMsg({ ok: true, text: type === 'market' ? t(side === 'buy' ? 'buyExecuted' : 'sellExecuted') : t('pendingPlaced') });
    } catch (e) { setMsg({ ok: false, text: tErr((e as Error).message) }); }
  };
  const step = (dir: number) => setLots(String(Math.max(inst.minLot, Math.min(inst.maxLot, Number((Number(lots) + dir * inst.lotStep).toFixed(2))))));

  return (
    <aside className="order">
      <h3>{inst.symbol} <small>{instName(inst.symbol, inst.name)}</small></h3>
      <div className="seg full">
        {(['market', 'limit', 'stop'] as const).map((x) => <button key={x} className={type === x ? 'on' : ''} onClick={() => setType(x)}>{t(x)}</button>)}
      </div>
      <div className="quote-btns">
        <button className="sell" onClick={() => send('sell')}><small>{t('sell')}</small><b>{tick ? tick.bid.toFixed(inst.digits) : '—'}</b></button>
        <span className="spread">{spread.toFixed(1)}</span>
        <button className="buy" onClick={() => send('buy')}><small>{t('buy')}</small><b>{tick ? tick.ask.toFixed(inst.digits) : '—'}</b></button>
      </div>
      <label>{t('volumeLots')}</label>
      <div className="stepper"><button onClick={() => step(-1)}>−</button><input value={lots} onChange={(e) => setLots(e.target.value)} /><button onClick={() => step(1)}>+</button></div>
      {type !== 'market' && (<><label>{t('orderPrice')}</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={tick?.bid.toFixed(inst.digits)} /></>)}
      <label>{t('slPrice')}</label><input value={sl} onChange={(e) => setSl(e.target.value)} placeholder={t('optional')} />
      <label>{t('tpPrice')}</label><input value={tp} onChange={(e) => setTp(e.target.value)} placeholder={t('optional')} />
      <p className="hint">{t('contractInfo', { size: inst.contractSize.toLocaleString(locale()), min: inst.minLot, max: inst.maxLot, pip: inst.pip })}</p>
      {msg && <p className={msg.ok ? 'msg ok' : 'msg err'}>{msg.text}</p>}
    </aside>
  );
}
