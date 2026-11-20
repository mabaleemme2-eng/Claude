import { useMemo, useState } from 'react';
import type { Instrument } from '../api';
import { useTicks } from '../feed';

type Cls = Instrument['cls'];
const CLASSES: [Cls, string][] = [
  ['forex', 'Forex'], ['crypto', 'Crypto'], ['index', 'Indici'], ['commodity', 'Materie prime'], ['stock', 'Azioni'],
];
const SOURCE_LABEL: Record<Instrument['source'], string> = {
  binance: 'Live · Binance', hyperliquid: 'Live · Hyperliquid', kraken: 'Live · Kraken',
  cross: 'Live · cambio incrociato calcolato', sim: 'SIMULATO · nessuna fonte live gratuita',
};

export default function Watchlist({ instruments, selected, onSelect }: { instruments: Instrument[]; selected: string; onSelect: (s: string) => void }) {
  const ticks = useTicks();
  const [q, setQ] = useState('');
  const [cls, setCls] = useState<Cls | 'all'>('all');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return instruments.filter((i) => (cls === 'all' || i.cls === cls) && (!n || i.symbol.toLowerCase().includes(n) || i.name.toLowerCase().includes(n)));
  }, [instruments, q, cls]);

  return (
    <aside className="watchlist">
      <div className="wl-search">
        <input placeholder={`Cerca tra ${instruments.length} strumenti…`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={cls === 'all' ? 'on' : ''} onClick={() => setCls('all')}>Tutti</button>
          {CLASSES.map(([c, l]) => <button key={c} className={cls === c ? 'on' : ''} onClick={() => setCls(c)}>{l}</button>)}
        </div>
      </div>
      <div className="wl-head"><span>Simbolo</span><span>Bid</span><span>Ask</span></div>
      {CLASSES.map(([c, label]) => {
        const rows = filtered.filter((i) => i.cls === c);
        if (!rows.length) return null;
        const shut = closed[c] && !q;
        return (
          <div key={c}>
            <div className="wl-group" onClick={() => setClosed({ ...closed, [c]: !closed[c] })}>{shut ? '▸' : '▾'} {label} <small>({rows.length})</small></div>
            {!shut && rows.map((i) => {
              const t = ticks[i.symbol];
              const color = t ? (t.dir > 0 ? 'pos' : t.dir < 0 ? 'neg' : '') : '';
              return (
                <div key={i.symbol} className={`wl-row ${selected === i.symbol ? 'sel' : ''}`} onClick={() => onSelect(i.symbol)}>
                  <span className="sym" title={`${i.name} — ${SOURCE_LABEL[i.source]}`}>
                    <i className={`src ${i.source === 'sim' ? 'sim' : 'live'}`} />{i.symbol}
                  </span>
                  <span className={color}>{t ? t.bid.toFixed(i.digits) : '—'}</span>
                  <span className={color}>{t ? t.ask.toFixed(i.digits) : '—'}</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {!filtered.length && <p className="hint" style={{ padding: 12 }}>Nessuno strumento trovato.</p>}
    </aside>
  );
}
