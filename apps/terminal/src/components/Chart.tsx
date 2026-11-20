import { useEffect, useRef, useState } from 'react';
import {
  createChart, CandlestickSeries, LineSeries, AreaSeries, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp, type SeriesType,
} from 'lightweight-charts';
import { api, type Candle, type Instrument, type Position } from '../api';
import { onTick } from '../feed';

const TFS = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'] as const;
const TF_SEC: Record<string, number> = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };
type ChartType = 'candles' | 'line' | 'area';
type Pt = { time: UTCTimestamp; value: number };

const sma = (c: Candle[], n: number): Pt[] => {
  const out: Pt[] = [];
  let sum = 0;
  c.forEach((x, i) => {
    sum += x.close;
    if (i >= n) sum -= c[i - n].close;
    if (i >= n - 1) out.push({ time: x.time as UTCTimestamp, value: sum / n });
  });
  return out;
};
const ema = (c: Candle[], n: number): Pt[] => {
  const k = 2 / (n + 1);
  let prev = c[0]?.close ?? 0;
  return c.map((x) => { prev = x.close * k + prev * (1 - k); return { time: x.time as UTCTimestamp, value: prev }; });
};
const bollinger = (c: Candle[], n = 20, m = 2): { up: Pt[]; low: Pt[] } => {
  const up: Pt[] = []; const low: Pt[] = [];
  for (let i = n - 1; i < c.length; i++) {
    const w = c.slice(i - n + 1, i + 1).map((x) => x.close);
    const mean = w.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    up.push({ time: c[i].time as UTCTimestamp, value: mean + m * sd });
    low.push({ time: c[i].time as UTCTimestamp, value: mean - m * sd });
  }
  return { up, low };
};

export default function Chart({ inst, positions }: { inst: Instrument; positions: Position[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi>();
  const mainRef = useRef<ISeriesApi<SeriesType>>();
  const indRef = useRef<ISeriesApi<'Line'>[]>([]);
  const data = useRef<Candle[]>([]);
  const askLine = useRef<IPriceLine>();
  const bidLine = useRef<IPriceLine>();
  const posLines = useRef<IPriceLine[]>([]);
  const [tf, setTf] = useState<(typeof TFS)[number]>('M5');
  const [type, setType] = useState<ChartType>('candles');
  const [ind, setInd] = useState({ sma: false, ema: false, bb: false });
  const [last, setLast] = useState<Candle>();

  // create the chart once
  useEffect(() => {
    const el = box.current!;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#9aa3b2', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: '#1e2230' }, horzLines: { color: '#1e2230' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = undefined; };
  }, []);

  const buildMain = () => {
    const chart = chartRef.current!;
    if (mainRef.current) chart.removeSeries(mainRef.current);
    askLine.current = bidLine.current = undefined;
    posLines.current = [];
    const priceFormat = { type: 'price' as const, precision: inst.digits, minMove: 1 / 10 ** inst.digits };
    let s: ISeriesApi<SeriesType>;
    if (type === 'candles') s = chart.addSeries(CandlestickSeries, { upColor: '#089981', downColor: '#f23645', borderUpColor: '#089981', borderDownColor: '#f23645', wickUpColor: '#089981', wickDownColor: '#f23645', priceFormat });
    else if (type === 'line') s = chart.addSeries(LineSeries, { color: '#2962ff', lineWidth: 2, priceFormat });
    else s = chart.addSeries(AreaSeries, { lineColor: '#2962ff', topColor: 'rgba(41,98,255,.35)', bottomColor: 'rgba(41,98,255,0)', priceFormat });
    mainRef.current = s;
    setMain();
  };
  const setMain = () => {
    const s = mainRef.current!;
    const d = data.current;
    (s as ISeriesApi<any>).setData(type === 'candles' ? d : d.map((c) => ({ time: c.time, value: c.close })));
    askLine.current = s.createPriceLine({ price: d.at(-1)?.close ?? 0, color: '#f23645', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'ASK' });
    bidLine.current = s.createPriceLine({ price: d.at(-1)?.close ?? 0, color: '#089981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BID' });
  };
  const buildInd = () => {
    const chart = chartRef.current!;
    indRef.current.forEach((s) => chart.removeSeries(s));
    indRef.current = [];
    const d = data.current;
    const add = (pts: Pt[], color: string) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(pts);
      indRef.current.push(s);
    };
    if (ind.sma) add(sma(d, 20), '#ff9800');
    if (ind.ema) add(ema(d, 50), '#e040fb');
    if (ind.bb) { const b = bollinger(d); add(b.up, '#26c6da'); add(b.low, '#26c6da'); }
  };

  // load data on every symbol/timeframe change
  useEffect(() => {
    let off = false;
    api<Candle[]>(`/api/candles?symbol=${inst.symbol}&tf=${tf}&limit=600`).then((c) => {
      if (off || !chartRef.current) return;
      data.current = c;
      setLast(c.at(-1));
      buildMain();
      buildInd();
      chartRef.current.timeScale().fitContent();
    });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst.symbol, tf, type]);

  useEffect(() => { if (data.current.length && chartRef.current) buildInd(); /* eslint-disable-next-line */ }, [ind]);

  // aggiornamento live
  useEffect(() => onTick((symbol, t, time) => {
    if (symbol !== inst.symbol || !mainRef.current || !data.current.length) return;
    const bucket = (Math.floor(time / 1000 / TF_SEC[tf]) * TF_SEC[tf]) as UTCTimestamp;
    const d = data.current;
    let c = d[d.length - 1];
    if (c.time === bucket) { c.high = Math.max(c.high, t.bid); c.low = Math.min(c.low, t.bid); c.close = t.bid; }
    else if (bucket > c.time) { c = { time: bucket, open: c.close, high: t.bid, low: t.bid, close: t.bid }; d.push(c); }
    (mainRef.current as ISeriesApi<any>).update(type === 'candles' ? c : { time: c.time, value: c.close });
    askLine.current?.applyOptions({ price: t.ask });
    bidLine.current?.applyOptions({ price: t.bid });
    setLast({ ...c });
  }), [inst.symbol, tf, type]);

  // price lines for open positions
  useEffect(() => {
    const s = mainRef.current;
    if (!s) return;
    posLines.current.forEach((l) => s.removePriceLine(l));
    posLines.current = [];
    for (const p of positions) {
      const mk = (price: number, color: string, title: string) =>
        posLines.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title }));
      mk(p.openPrice, p.side === 'buy' ? '#2962ff' : '#ff9800', `${p.side === 'buy' ? 'BUY' : 'SELL'} ${p.lots}`);
      if (p.sl) mk(p.sl, '#f23645', 'SL');
      if (p.tp) mk(p.tp, '#089981', 'TP');
    }
  }, [positions, type, tf, inst.symbol]);

  const d = inst.digits;
  return (
    <div className="chart-wrap">
      <div className="chart-bar">
        <b className="chart-title">{inst.symbol} <small>{inst.name}</small></b>
        <div className="seg">{TFS.map((x) => <button key={x} className={x === tf ? 'on' : ''} onClick={() => setTf(x)}>{x}</button>)}</div>
        <div className="seg">
          {(['candles', 'line', 'area'] as ChartType[]).map((x) => <button key={x} className={x === type ? 'on' : ''} onClick={() => setType(x)}>{x === 'candles' ? 'Candles' : x === 'line' ? 'Line' : 'Area'}</button>)}
        </div>
        <div className="seg">
          <button className={ind.sma ? 'on' : ''} onClick={() => setInd({ ...ind, sma: !ind.sma })}>SMA 20</button>
          <button className={ind.ema ? 'on' : ''} onClick={() => setInd({ ...ind, ema: !ind.ema })}>EMA 50</button>
          <button className={ind.bb ? 'on' : ''} onClick={() => setInd({ ...ind, bb: !ind.bb })}>Bollinger</button>
        </div>
        {last && <span className="ohlc">O {last.open.toFixed(d)} H {last.high.toFixed(d)} L {last.low.toFixed(d)} C {last.close.toFixed(d)}</span>}
      </div>
      <div ref={box} className="chart" />
    </div>
  );
}
