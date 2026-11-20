import type { Instrument } from '../api';
import { useTicks } from '../feed';

const CLASSES: [Instrument['cls'], string][] = [
  ['forex', 'Forex'], ['crypto', 'Crypto'], ['index', 'Indici'], ['commodity', 'Materie prime'], ['stock', 'Azioni'],
];

export default function Watchlist({ instruments, selected, onSelect }: { instruments: Instrument[]; selected: string; onSelect: (s: string) => void }) {
  const ticks = useTicks();
  return (
    <aside className="watchlist">
      <div className="wl-head"><span>Simbolo</span><span>Bid</span><span>Ask</span></div>
      {CLASSES.map(([cls, label]) => (
        <div key={cls}>
          <div className="wl-group">{label}</div>
          {instruments.filter((i) => i.cls === cls).map((i) => {
            const t = ticks[i.symbol];
            return (
              <div key={i.symbol} className={`wl-row ${selected === i.symbol ? 'sel' : ''}`} onClick={() => onSelect(i.symbol)}>
                <span className="sym" title={i.name}>{i.symbol}</span>
                <span className={t ? (t.dir > 0 ? 'pos' : t.dir < 0 ? 'neg' : '') : ''}>{t ? t.bid.toFixed(i.digits) : '—'}</span>
                <span className={t ? (t.dir > 0 ? 'pos' : t.dir < 0 ? 'neg' : '') : ''}>{t ? t.ask.toFixed(i.digits) : '—'}</span>
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
