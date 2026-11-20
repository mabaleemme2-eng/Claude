import { useMemo, useState } from 'react';
import type { Instrument } from '../api';
import { useTicks } from '../feed';
import { instName, t, useLang, type Key } from '../i18n';

type Cls = Instrument['cls'];
const CLASSES: Cls[] = ['forex', 'crypto', 'index', 'commodity', 'stock'];

export default function Watchlist({ instruments, selected, onSelect }: { instruments: Instrument[]; selected: string; onSelect: (s: string) => void }) {
  useLang();
  const ticks = useTicks();
  const [q, setQ] = useState('');
  const [cls, setCls] = useState<Cls | 'all'>('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return instruments.filter((i) => (cls === 'all' || i.cls === cls) && (!n || i.symbol.toLowerCase().includes(n) || i.name.toLowerCase().includes(n) || instName(i.symbol, i.name).toLowerCase().includes(n)));
  }, [instruments, q, cls]);

  return (
    <aside className="watchlist">
      <div className="wl-search">
        <input placeholder={t('searchInstr', { n: instruments.length })} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={cls === 'all' ? 'on' : ''} onClick={() => setCls('all')}>{t('all')}</button>
          {CLASSES.map((c) => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{t(`cls.${c}` as Key)}</button>)}
        </div>
      </div>
      <div className="wl-head"><span>{t('symbol')}</span><span>{t('bid')}</span><span>{t('ask')}</span></div>
      {CLASSES.map((c) => {
        const rows = filtered.filter((i) => i.cls === c);
        if (!rows.length) return null;
        const shut = closed[c] && !q;
        return (
          <div key={c}>
            <div className="wl-group" onClick={() => setClosed({ ...closed, [c]: !closed[c] })}>{shut ? '▸' : '▾'} {t(`cls.${c}` as Key)} <small>({rows.length})</small></div>
            {!shut && rows.map((i) => {
              const tick = ticks[i.symbol];
              const color = tick ? (tick.dir > 0 ? 'pos' : tick.dir < 0 ? 'neg' : '') : '';
              return (
                <div key={i.symbol} className={`wl-row ${selected === i.symbol ? 'sel' : ''}`} onClick={() => onSelect(i.symbol)}>
                  <span className="sym" title={`${instName(i.symbol, i.name)} — ${t(`src.${i.source}` as Key)}`}>
                    <i className={`src ${i.source === 'sim' || i.source === 'demo' ? 'sim' : 'live'}`} />{i.symbol}
                  </span>
                  <span className={color}>{tick ? tick.bid.toFixed(i.digits) : '—'}</span>
                  <span className={color}>{tick ? tick.ask.toFixed(i.digits) : '—'}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {!filtered.length && <p className="hint" style={{ padding: 12 }}>{t('noResults')}</p>}
    </aside>
  );
}
