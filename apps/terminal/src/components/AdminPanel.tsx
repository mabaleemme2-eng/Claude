import { useEffect, useState } from 'react';
import { ADMIN_KEY_STORAGE, adminKey, api, type AssetClass, type GroupConfig, type Instrument, type SpreadRule, type SwapRule } from '../api';
import { setAccount } from '../feed';

const CLASSES: [AssetClass, string][] = [['forex', 'Forex'], ['crypto', 'Crypto'], ['index', 'Indices'], ['commodity', 'Commodities'], ['stock', 'Stocks']];
const MODES: [SpreadRule['mode'], string][] = [['raw', 'Raw (no markup)'], ['markup_pips', 'Markup in pips'], ['markup_pct', 'Markup in %'], ['fixed', 'Fixed (pips)']];
const SWAP_MODES: [SwapRule['mode'], string][] = [['pips', 'Pips / lot'], ['percent', '% per year'], ['money', 'USD / lot']];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Preview { raw: { bid: number; ask: number; spreadPips: number }; client: { bid: number; ask: number; spreadPips: number }; rule: SpreadRule; swap: SwapRule; commissionPerLot: number }

const optNum = (v: string) => (v === '' ? undefined : Number(v));

function RuleEditor({ rule, onChange }: { rule: SpreadRule; onChange: (r: SpreadRule) => void }) {
  return (
    <>
      <td><select value={rule.mode} onChange={(e) => onChange({ ...rule, mode: e.target.value as SpreadRule['mode'] })}>{MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></td>
      <td><input type="number" step="0.1" disabled={rule.mode === 'raw'} value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} /></td>
      <td><input type="number" step="0.1" value={rule.min ?? ''} onChange={(e) => onChange({ ...rule, min: optNum(e.target.value) })} /></td>
      <td><input type="number" step="0.1" value={rule.max ?? ''} onChange={(e) => onChange({ ...rule, max: optNum(e.target.value) })} /></td>
    </>
  );
}

export default function AdminPanel({ instruments }: { instruments: Instrument[] }) {
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [gid, setGid] = useState('standard');
  const [key, setKey] = useState(adminKey());
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [prevSym, setPrevSym] = useState('EURUSD');
  const [preview, setPreview] = useState<Preview>();
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    try { setGroups((await api<{ groups: GroupConfig[] }>('/api/admin/pricing', { admin: true })).groups); setMsg(undefined); setDirty(false); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  useEffect(() => { void load(); }, [key]);
  const g = groups.find((x) => x.id === gid);
  const refreshPreview = async () => {
    try { setPreview(await api<Preview>(`/api/admin/preview?symbol=${prevSym}&group=${gid}`, { admin: true })); } catch { setPreview(undefined); }
  };
  useEffect(() => { if (!dirty) { void refreshPreview(); const t = setInterval(refreshPreview, 1000); return () => clearInterval(t); } }, [prevSym, gid, dirty, groups]);

  if (!g) return <div className="admin"><p className="msg err">{msg?.text ?? 'Loading…'}</p>
    <label>Admin key</label><input value={key} onChange={(e) => { setKey(e.target.value); try { localStorage.setItem(ADMIN_KEY_STORAGE, e.target.value); } catch { /* */ } }} /></div>;

  const upd = (patch: Partial<GroupConfig>) => { setGroups(groups.map((x) => (x.id === gid ? { ...x, ...patch } : x))); setDirty(true); };
  const save = async () => {
    try { await api('/api/admin/pricing', { method: 'PUT', body: g, admin: true }); setDirty(false); setMsg({ ok: true, text: 'Saved: the new prices are live immediately' }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const setSymRule = (sym: string, r?: SpreadRule) => {
    const next = { ...g.symbolSpread };
    if (r) next[sym] = r; else delete next[sym];
    upd({ symbolSpread: next });
  };
  const setSwap = (sym: string, r?: SwapRule) => {
    const next = { ...g.swapOverrides };
    if (r) next[sym] = r; else delete next[sym];
    upd({ swapOverrides: next });
  };

  return (
    <div className="admin">
      <div className="admin-head">
        <h2>Pricing · Spreads · Swaps</h2>
        <select value={gid} onChange={(e) => setGid(e.target.value)}>{groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button className="primary" disabled={!dirty} onClick={save}>Save changes</button>
        <button onClick={load}>Discard</button>
        <button onClick={async () => { if (confirm('Restore the defaults of all groups?')) { await api('/api/admin/pricing/reset', { method: 'POST', admin: true }); void load(); } }}>Restore defaults</button>
        <button onClick={async () => { const r = await api<{ positionsCharged: number; account: any }>('/api/admin/rollover', { method: 'POST', body: { groupId: gid }, admin: true }); setAccount(r.account); setMsg({ ok: true, text: `Rollover applied to ${r.positionsCharged} positions` }); }}>Run rollover now</button>
        {msg && <span className={msg.ok ? 'msg ok' : 'msg err'}>{msg.text}</span>}
      </div>

      <div className="admin-grid">
        <section className="card">
          <h3>Group settings</h3>
          <div className="form-grid">
            <label>Leverage</label><input type="number" value={g.leverage} onChange={(e) => upd({ leverage: Number(e.target.value) })} />
            <label>Margin call %</label><input type="number" value={g.marginCallLevel} onChange={(e) => upd({ marginCallLevel: Number(e.target.value) })} />
            <label>Stop-out %</label><input type="number" value={g.stopOutLevel} onChange={(e) => upd({ stopOutLevel: Number(e.target.value) })} />
            <label>Swap markup %</label><input type="number" value={g.swapMarkupPct} onChange={(e) => upd({ swapMarkupPct: Number(e.target.value) })} />
            <label>Rollover (UTC hour)</label><input type="number" min={0} max={23} value={g.rolloverHourUtc} onChange={(e) => upd({ rolloverHourUtc: Number(e.target.value) })} />
            <label>Islamic account (swap-free)</label><input type="checkbox" checked={g.swapFree} onChange={(e) => upd({ swapFree: e.target.checked })} />
          </div>
          <p className="hint">The swap markup increases charges and reduces credits compared with the instrument's base value.</p>
        </section>

        <section className="card">
          <h3>Client price preview (live)</h3>
          <select value={prevSym} onChange={(e) => setPrevSym(e.target.value)}>{instruments.map((i) => <option key={i.symbol}>{i.symbol}</option>)}</select>
          {preview && (
            <table className="mini"><tbody>
              <tr><th /><th>Bid</th><th>Ask</th><th>Spread (pip)</th></tr>
              <tr><td>Provider (raw)</td><td>{preview.raw.bid}</td><td>{preview.raw.ask}</td><td>{preview.raw.spreadPips}</td></tr>
              <tr><td><b>Client</b></td><td><b>{preview.client.bid}</b></td><td><b>{preview.client.ask}</b></td><td><b>{preview.client.spreadPips}</b></td></tr>
              <tr><td>Swap long / short</td><td colSpan={3}>{preview.swap.long.toFixed(2)} / {preview.swap.short.toFixed(2)} ({preview.swap.mode})</td></tr>
              <tr><td>Commission / lot</td><td colSpan={3}>{preview.commissionPerLot} USD per side</td></tr>
            </tbody></table>
          )}
          {dirty && <p className="hint">Save to see the effect of your changes in the preview.</p>}
        </section>
      </div>

      <section className="card">
        <h3>Spreads and commissions by asset class</h3>
        <table><thead><tr><th>Class</th><th>Mode</th><th>Value</th><th>Min (pips)</th><th>Max (pips)</th><th>Commission / lot (USD)</th></tr></thead>
          <tbody>{CLASSES.map(([c, l]) => (
            <tr key={c}><td>{l}</td>
              <RuleEditor rule={g.classSpread[c]} onChange={(r) => upd({ classSpread: { ...g.classSpread, [c]: r } })} />
              <td><input type="number" step="0.5" value={g.commissionPerLot[c]} onChange={(e) => upd({ commissionPerLot: { ...g.commissionPerLot, [c]: Number(e.target.value) } })} /></td></tr>))}</tbody></table>
      </section>

      <section className="card">
        <h3>Per-symbol spread overrides · Per-symbol swaps</h3>
        <p className="hint">Leave “—” to inherit the class rule. The swap starts from the instrument's base value: an override replaces it.</p>
        <div className="tbl-wrap tall">
          <table><thead><tr><th>Symbol</th><th>Raw spread (pips)</th><th colSpan={4}>Spread override</th><th colSpan={4}>Swap override</th></tr></thead>
            <tbody>{instruments.map((i) => {
              const r = g.symbolSpread[i.symbol];
              const s = g.swapOverrides[i.symbol];
              return (
                <tr key={i.symbol}><td><b>{i.symbol}</b></td><td>{i.rawSpreadPips}</td>
                  {r ? (<><RuleEditor rule={r} onChange={(x) => setSymRule(i.symbol, x)} /></>)
                    : (<td colSpan={4}><button onClick={() => setSymRule(i.symbol, { mode: 'markup_pips', value: 1 })}>— set</button></td>)}
                  {s ? (<>
                    <td><select value={s.mode} onChange={(e) => setSwap(i.symbol, { ...s, mode: e.target.value as SwapRule['mode'] })}>{SWAP_MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></td>
                    <td><input type="number" step="0.1" value={s.long} onChange={(e) => setSwap(i.symbol, { ...s, long: Number(e.target.value) })} /></td>
                    <td><input type="number" step="0.1" value={s.short} onChange={(e) => setSwap(i.symbol, { ...s, short: Number(e.target.value) })} /></td>
                    <td><button onClick={() => setSwap(i.symbol, undefined)}>✕</button></td></>)
                    : (<td colSpan={4}><button onClick={() => setSwap(i.symbol, { ...i.swap })}>base: {i.swap.long} / {i.swap.short} — edit</button></td>)}
                </tr>);
            })}</tbody></table>
        </div>
      </section>

      <section className="card">
        <h3>Sessions · spread widening (news, rollover, market opens)</h3>
        <table><thead><tr><th>Name</th><th>From (UTC)</th><th>To (UTC)</th><th>Multiplier</th><th>Days</th><th /></tr></thead>
          <tbody>{g.sessions.map((s, idx) => {
            const set = (p: Partial<typeof s>) => upd({ sessions: g.sessions.map((x, k) => (k === idx ? { ...x, ...p } : x)) });
            return (
              <tr key={idx}><td><input value={s.name} onChange={(e) => set({ name: e.target.value })} /></td>
                <td><input type="time" value={s.from} onChange={(e) => set({ from: e.target.value })} /></td>
                <td><input type="time" value={s.to} onChange={(e) => set({ to: e.target.value })} /></td>
                <td><input type="number" step="0.5" min={1} value={s.multiplier} onChange={(e) => set({ multiplier: Number(e.target.value) })} /></td>
                <td className="days">{DAYS.map((d, n) => <label key={d}><input type="checkbox" checked={s.days.length === 0 || s.days.includes(n)} onChange={(e) => {
                  const cur = s.days.length ? s.days : [0, 1, 2, 3, 4, 5, 6];
                  const next = e.target.checked ? [...cur, n] : cur.filter((x) => x !== n);
                  set({ days: next.length === 7 ? [] : next });
                }} />{d}</label>)}</td>
                <td><button onClick={() => upd({ sessions: g.sessions.filter((_, k) => k !== idx) })}>✕</button></td></tr>);
          })}</tbody></table>
        <button onClick={() => upd({ sessions: [...g.sessions, { name: 'New session', days: [], from: '12:30', to: '12:45', multiplier: 3 }] })}>+ Add session</button>
      </section>
    </div>
  );
}
