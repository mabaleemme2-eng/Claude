import { useSyncExternalStore, useState } from 'react';
import { t, useLang } from './i18n';

/** In-page replacements for confirm()/prompt()/alert(), which embedded pages and some browsers block. */
interface Dlg { kind: 'confirm' | 'prompt' | 'alert'; message: string; value: string; resolve: (v: any) => void }
let current: Dlg | null = null;
const subs = new Set<() => void>();
const set = (d: Dlg | null) => { current = d; subs.forEach((f) => f()); };

export const askConfirm = (message: string) => new Promise<boolean>((resolve) => set({ kind: 'confirm', message, value: '', resolve }));
export const askPrompt = (message: string, value = '') => new Promise<string | null>((resolve) => set({ kind: 'prompt', message, value, resolve }));
export const notify = (message: string) => new Promise<void>((resolve) => set({ kind: 'alert', message, value: '', resolve }));

export function DialogHost() {
  useLang();
  const d = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current);
  const [text, setText] = useState('');
  const [lastId, setLastId] = useState<Dlg | null>(null);
  if (d !== lastId) { setLastId(d); setText(d?.value ?? ''); }
  if (!d) return null;
  const done = (v: unknown) => { set(null); d.resolve(v); };
  return (
    <div className="modal-back" onClick={() => done(d.kind === 'confirm' ? false : d.kind === 'prompt' ? null : undefined)}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{d.message}</p>
        {d.kind === 'prompt' && (
          <input id="dialog-input" autoFocus value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') done(text); }} />
        )}
        <div className="modal-actions">
          {d.kind !== 'alert' && <button onClick={() => done(d.kind === 'confirm' ? false : null)}>{t('btnCancel')}</button>}
          <button className="primary" onClick={() => done(d.kind === 'confirm' ? true : d.kind === 'prompt' ? text : undefined)}>{t('ok')}</button>
        </div>
      </div>
    </div>
  );
}
