import { useState } from 'react';
import { api, type Account } from '../api';
import { setAccount } from '../feed';
import { locale, t, tErr, useLang, type Key } from '../i18n';

const fmt = (v: number) => v.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time = (ms: number) => new Date(ms).toLocaleTimeString(locale());

export default function Positions({ acc, onSelect }: { acc: Account | null; onSelect: (s: string) => void }) {
  useLang();
  const [tab, setTab] = useState<'pos' | 'pend' | 'hist'>('pos');
  const run = async (path: string, method: string, body?: unknown) => {
    try { setAccount(await api<Account>(path, { method, body })); } catch (e) { alert(tErr((e as Error).message)); }
  };
  const edit = (id: number, sl?: number, tp?: number) => {
    const nsl = prompt(t('slPrompt'), sl ? String(sl) : '');
    if (nsl === null) return;
    const ntp = prompt(t('tpPrompt'), tp ? String(tp) : '');
    if (ntp === null) return;
    void run(`/api/positions/${id}`, 'PATCH', { sl: nsl || undefined, tp: ntp || undefined });
  };
  return (
    <div className="positions">
      <div className="tabs">
        <button className={tab === 'pos' ? 'on' : ''} onClick={() => setTab('pos')}>{t('tabPositions')} ({acc?.positions.length ?? 0})</button>
        <button className={tab === 'pend' ? 'on' : ''} onClick={() => setTab('pend')}>{t('tabPending')} ({acc?.pending.length ?? 0})</button>
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>{t('tabHistory')}</button>
        <span className="grow" />
        <button className="link" onClick={() => confirm(t('resetConfirm')) && run('/api/account/reset', 'POST')}>{t('resetDemo')}</button>
      </div>
      <div className="tbl-wrap">
        {tab === 'pos' && (
          <table><thead><tr><th>{t('symbol')}</th><th>{t('thSide')}</th><th>{t('thLots')}</th><th>{t('thOpen')}</th><th>SL</th><th>TP</th><th>Swap</th><th>{t('thComm')}</th><th>{t('pnl')}</th><th /></tr></thead>
            <tbody>{acc?.positions.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p.symbol)}>
                <td>{p.symbol}</td><td className={p.side === 'buy' ? 'pos' : 'neg'}>{t(p.side)}</td><td>{p.lots}</td><td>{p.openPrice}</td>
                <td>{p.sl ?? '—'}</td><td>{p.tp ?? '—'}</td><td>{fmt(p.swap)}</td><td>{fmt(-p.commission)}</td>
                <td className={p.pnl >= 0 ? 'pos' : 'neg'}><b>{fmt(p.pnl)}</b></td>
                <td className="act"><button onClick={(e) => { e.stopPropagation(); edit(p.id, p.sl, p.tp); }}>{t('btnSlTp')}</button><button onClick={(e) => { e.stopPropagation(); void run(`/api/positions/${p.id}`, 'DELETE'); }}>{t('btnClose')}</button></td>
              </tr>))}</tbody></table>
        )}
        {tab === 'pend' && (
          <table><thead><tr><th>{t('symbol')}</th><th>{t('thType')}</th><th>{t('thLots')}</th><th>{t('thPrice')}</th><th>SL</th><th>TP</th><th /></tr></thead>
            <tbody>{acc?.pending.map((o) => (
              <tr key={o.id}><td>{o.symbol}</td><td>{o.side.toUpperCase()} {o.type.toUpperCase()}</td><td>{o.lots}</td><td>{o.price}</td><td>{o.sl ?? '—'}</td><td>{o.tp ?? '—'}</td>
                <td className="act"><button onClick={() => run(`/api/pending/${o.id}`, 'DELETE')}>{t('btnCancel')}</button></td></tr>))}</tbody></table>
        )}
        {tab === 'hist' && (
          <table><thead><tr><th>{t('symbol')}</th><th>{t('thSide')}</th><th>{t('thLots')}</th><th>{t('thOpen')}</th><th>{t('thClose')}</th><th>{t('thReason')}</th><th>{t('thTime')}</th><th>Swap</th><th>{t('pnl')}</th></tr></thead>
            <tbody>{acc?.history.map((h) => (
              <tr key={h.id}><td>{h.symbol}</td><td>{t(h.side)}</td><td>{h.lots}</td><td>{h.openPrice}</td><td>{h.closePrice}</td><td>{t(`reason.${h.reason}` as Key)}</td><td>{time(h.closeTime)}</td><td>{fmt(h.swap)}</td>
                <td className={h.pnl >= 0 ? 'pos' : 'neg'}>{fmt(h.pnl)}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
