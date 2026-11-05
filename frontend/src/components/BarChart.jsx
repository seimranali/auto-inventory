import { useMemo, useRef, useState } from 'react';
import { t } from '../i18n';

// Categorical slots (validated: CVD ΔE 24.7, normal ΔE 33.6, contrast ≥ 3:1). Assign in this order, never cycled.
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#16a34a', '#7c3aed'];

const niceStep = max => {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) || pow;
};

/**
 * Grouped vertical bar chart (inline SVG, one y-axis, zero baseline).
 * data    [{ label, ...values }]
 * series  [{ key, label, color? }]
 * format  value formatter for axis ticks and tooltip
 */
export default function BarChart({ data, series, format = v => v, height = 220, tickFormat = format }) {
  const wrap = useRef();
  const [hover, setHover] = useState(null);
  const W = 640, H = height, pad = { t: 12, r: 8, b: 26, l: 56 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;

  const { min, max, ticks } = useMemo(() => {
    const vals = data.flatMap(d => series.map(s => d[s.key] || 0));
    const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
    const step = niceStep(Math.max(hi - lo, 1));
    const top = Math.ceil(hi / step) * step || step, bottom = Math.floor(lo / step) * step;
    const t = [];
    for (let v = bottom; v <= top + step / 2; v += step) t.push(v);
    return { min: bottom, max: top, ticks: t };
  }, [data, series]);

  const y = v => pad.t + ((max - v) / (max - min)) * innerH;
  const band = innerW / data.length;
  const groupW = Math.min(band * 0.64, 22 * series.length + 2 * (series.length - 1));
  const barW = (groupW - 2 * (series.length - 1)) / series.length; // 2px surface gap between adjacent bars
  const colorOf = (s, i) => s.color || SERIES_COLORS[i];

  // Bar with 4px rounded data-end, square at the zero baseline
  const bar = (x, v) => {
    const y0 = y(0), y1 = y(v), h = Math.abs(y1 - y0);
    if (h < 0.5) return '';
    const r = Math.min(4, h, barW / 2), up = v >= 0;
    const top = up ? y1 : y0, bot = up ? y0 : y1;
    return up
      ? `M${x},${bot}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${bot}Z`
      : `M${x},${top}V${bot - r}Q${x},${bot} ${x + r},${bot}H${x + barW - r}Q${x + barW},${bot} ${x + barW},${bot - r}V${top}Z`;
  };

  return (
    <div className="chart" ref={wrap}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s, i) => <span key={s.key}><i style={{ background: colorOf(s, i) }} />{t(s.label)}</span>)}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map(s => s.label).join(' and ') + ' by ' + data.map(d => d.label).join(', ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-zero' : 'chart-grid'} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-tick">{tickFormat(t)}</text>
          </g>
        ))}
        {data.map((d, gi) => {
          const gx = pad.l + band * gi + (band - groupW) / 2;
          return (
            <g key={d.label}>
              {hover === gi && <rect x={pad.l + band * gi} y={pad.t} width={band} height={innerH} className="chart-hover-band" />}
              {series.map((s, si) => <path key={s.key} d={bar(gx + si * (barW + 2), d[s.key] || 0)} fill={colorOf(s, si)} />)}
              <text x={pad.l + band * gi + band / 2} y={H - 8} textAnchor="middle" className="chart-tick">{d.label}</text>
              {/* Hit target: the whole column, larger than the bars */}
              <rect x={pad.l + band * gi} y={pad.t} width={band} height={innerH} fill="transparent"
                onMouseEnter={() => setHover(gi)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%` }}>
          <strong>{data[hover].fullLabel || data[hover].label}</strong>
          {series.map((s, i) => (
            <div key={s.key}><i style={{ background: colorOf(s, i) }} />{t(s.label)}<b>{format(data[hover][s.key] || 0)}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// 100% stacked horizontal bar for a part-to-whole split: items [{ label, value, display }]
export function SplitBar({ items }) {
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0) || 1;
  return (
    <div className="split">
      <div className="split-bar">
        {items.map((it, i) => it.value > 0 && (
          <div key={it.label} title={`${it.label}: ${it.display}`}
            style={{ width: `${(it.value / total) * 100}%`, background: SERIES_COLORS[i] }} />
        ))}
      </div>
      <div className="split-legend">
        {items.map((it, i) => (
          <div key={it.label}>
            <span><i style={{ background: SERIES_COLORS[i] }} />{t(it.label)}</span>
            <b>{Math.round((Math.max(0, it.value) / total) * 100)}%</b>
            <small>{it.display}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
