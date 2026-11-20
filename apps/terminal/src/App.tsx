import { useEffect, useState } from 'react';
import { api, setAccountFromServer, type Instrument } from './apiHelpers';
import { useAccount, useConnected } from './feed';
import Watchlist from './components/Watchlist';
import Chart from './components/Chart';
import OrderPanel from './components/OrderPanel';
import Positions from './components/Positions';
import AdminPanel from './components/AdminPanel';

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));

export default function App() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [symbol, setSymbol] = useState('EURUSD');
  const [view, setView] = useState<'trade' | 'admin'>('trade');
  const [mtab, setMtab] = useState<'markets' | 'chart' | 'order' | 'pos'>('chart');
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const acc = useAccount();
  const connected = useConnected();

  useEffect(() => {
    api<Instrument[]>('/api/instruments').then(setInstruments);
    api<{ id: string; name: string }[]>('/api/groups').then(setGroups);
  }, [view]);

  const inst = instruments.find((i) => i.symbol === symbol);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">◆ BrokerOS <span>Terminal</span></div>
        <div className="metrics">
          <div><label>Balance</label><b>{fmt(acc?.balance)}</b></div>
          <div><label>Equity</label><b>{fmt(acc?.equity)}</b></div>
          <div><label>Margin</label><b>{fmt(acc?.margin)}</b></div>
          <div><label>Free margin</label><b>{fmt(acc?.freeMargin)}</b></div>
          <div><label>Level</label><b className={acc?.marginLevel != null && acc.marginLevel < 150 ? 'neg' : ''}>{acc?.marginLevel != null ? fmt(acc.marginLevel, 0) + '%' : '—'}</b></div>
          <div><label>P&amp;L</label><b className={(acc?.floating ?? 0) >= 0 ? 'pos' : 'neg'}>{fmt(acc?.floating)}</b></div>
        </div>
        <div className="top-right">
          <select value={acc?.groupId ?? ''} onChange={async (e) => setAccountFromServer(await api('/api/account/group', { method: 'POST', body: { groupId: e.target.value } }))} title="Account group (spread/swap)">
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className={view === 'admin' ? 'tab on' : 'tab'} onClick={() => setView(view === 'admin' ? 'trade' : 'admin')}>⚙ Pricing admin</button>
          <span className={connected ? 'dot on' : 'dot'} title={connected ? 'Connected' : 'Disconnected'} />
        </div>
      </header>
      {view === 'admin' ? (
        <AdminPanel instruments={instruments} />
      ) : (
        <main className={`trade m-${mtab}`}>
          <Watchlist instruments={instruments} selected={symbol} onSelect={(s) => { setSymbol(s); setMtab('chart'); }} />
          <section className="center">
            {inst && <Chart inst={inst} positions={(acc?.positions ?? []).filter((p) => p.symbol === symbol)} />}
            <Positions acc={acc} onSelect={setSymbol} />
          </section>
          {inst && <OrderPanel inst={inst} />}
        </main>
      )}
      {view === 'trade' && (
        <nav className="mnav">
          {([['markets', '☰', 'Markets'], ['chart', '📈', 'Chart'], ['order', '⚡', 'Order'], ['pos', '💼', `Positions${acc?.positions.length ? ` (${acc.positions.length})` : ''}`]] as const).map(([k, i, l]) => (
            <button key={k} className={mtab === k ? 'on' : ''} onClick={() => setMtab(k)}><span>{i}</span>{l}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
