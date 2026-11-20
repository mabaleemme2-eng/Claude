import { useState } from 'react';
import { api, type Account } from '../api';
import { setAccount } from '../feed';

const fmt = (v: number) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (ms: number) => new Date(ms).toLocaleTimeString('it-IT');

export default function Positions({ acc, onSelect }: { acc: Account | null; onSelect: (s: string) => void }) {
  const [tab, setTab] = useState<'pos' | 'pend' | 'hist'>('pos');
  const run = async (path: string, method: string, body?: unknown) => {
    try { setAccount(await api<Account>(path, { method, body })); } catch (e) { alert((e as Error).message); }
  };
  const edit = (id: number, sl?: number, tp?: number) => {
    const nsl = prompt('Stop Loss (vuoto = nessuno)', sl ? String(sl) : '');
    if (nsl === null) return;
    const ntp = prompt('Take Profit (vuoto = nessuno)', tp ? String(tp) : '');
    if (ntp === null) return;
    void run(`/api/positions/${id}`, 'PATCH', { sl: nsl || undefined, tp: ntp || undefined });
  };
  return (
    <div className="positions">
      <div className="tabs">
        <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>Posizioni ({acc?.positions.length ?? 0})</button>
        <button className={tab === 'pend' ? 'on' : ''} onClick={() => setTab('pend')}>Ordini pendenti ({acc?.pending.length ?? 0})</button>
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>Storico</button>
        <span className="grow" />
        <button className="link" onClick={() => confirm('Azzerare il conto demo?') && run('/api/account/reset', 'POST')}>Reset demo</button>
      </div>
      <div className="tbl-wrap">
        {tab === 'pos' && (
          <table><thead><tr><th>Simbolo</th><th>Lato</th><th>Lotti</th><th>Apertura</th><th>SL</th><th>TP</th><th>Swap</th><th>Comm.</th><th>P&amp;L</th><th /></tr></thead>
            <tbody>{acc?.positions.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p.symbol)}>
                <td>{p.symbol}</td><td className={p.side === 'buy' ? 'pos' : 'neg'}>{p.side === 'buy' ? 'BUY' : 'SELL'}</td><td>{p.lots}</td><td>{p.openPrice}</td>
                <td>{p.sl ?? '—'}</td><td>{p.tp ?? '—'}</td><td>{fmt(p.swap)}</td><td>{fmt(-p.commission)}</td>
                <td className={p.pnl >= 0 ? 'pos' : 'neg'}><b>{fmt(p.pnl)}</b></td>
                <td className="act"><button onClick={(e) => { e.stopPropagation(); edit(p.id, p.sl, p.tp); }}>SL/TP</button><button onClick={(e) => { e.stopPropagation(); void run(`/api/positions/${p.id}`, 'DELETE'); }}>Chiudi</button></td>
              </tr>))}</tbody></table>
        )}
        {tab === 'pend' && (
          <table><thead><tr><th>Simbolo</th><th>Tipo</th><th>Lotti</th><th>Prezzo</th><th>SL</th><th>TP</th><th /></tr></thead>
            <tbody>{acc?.pending.map((o) => (
              <tr key={o.id}><td>{o.symbol}</td><td>{o.side.toUpperCase()} {o.type.toUpperCase()}</td><td>{o.lots}</td><td>{o.price}</td><td>{o.sl ?? '—'}</td><td>{o.tp ?? '—'}</td>
                <td className="act"><button onClick={() => run(`/api/pending/${o.id}`, 'DELETE')}>Annulla</button></td></tr>))}</tbody></table>
        )}
        {tab === 'hist' && (
          <table><thead><tr><th>Simbolo</th><th>Lato</th><th>Lotti</th><th>Apertura</th><th>Chiusura</th><th>Motivo</th><th>Ora</th><th>Swap</th><th>P&amp;L</th></tr></thead>
            <tbody>{acc?.history.map((h) => (
              <tr key={h.id}><td>{h.symbol}</td><td>{h.side.toUpperCase()}</td><td>{h.lots}</td><td>{h.openPrice}</td><td>{h.closePrice}</td><td>{h.reason}</td><td>{time(h.closeTime)}</td><td>{fmt(h.swap)}</td>
                <td className={h.pnl >= 0 ? 'pos' : 'neg'}>{fmt(h.pnl)}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
