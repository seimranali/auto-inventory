import { useState } from 'react';
import { getLang } from '../i18n';
import { monthNames, weekdayNames, addMonths, fromIso, monthGrid, toIso, todayIso } from '../dates';

const ja = () => getLang() === 'ja';

/**
 * Month calendar with day / month / year views (click the title to zoom out).
 * value      selected ISO date
 * range      { from, to } to shade a range; hover previews it while picking the end
 * min / max  ISO bounds; days outside are disabled
 */
export default function Calendar({ value, range, min, max, onPick, month: monthProp, onMonthChange }) {
  const [own, setOwn] = useState(() => fromIso(value) || fromIso(range?.from) || new Date());
  const month = monthProp || own;
  const setMonth = d => (onMonthChange ? onMonthChange(d) : setOwn(d));
  const [view, setView] = useState('days');
  const [hover, setHover] = useState(null);
  const today = todayIso();
  const y = month.getFullYear();

  const disabled = iso => (min && iso < min) || (max && iso > max);

  if (view === 'months') {
    return (
      <div className="cal">
        <Header title={y} onTitle={() => setView('years')} onPrev={() => setMonth(new Date(y - 1, month.getMonth(), 1))} onNext={() => setMonth(new Date(y + 1, month.getMonth(), 1))} />
        <div className="cal-grid cal-grid-3">
          {monthNames().map((m, i) => (
            <button key={m} type="button" className={`cal-cell ${i === month.getMonth() ? 'selected' : ''}`}
              onClick={() => { setMonth(new Date(y, i, 1)); setView('days'); }}>{m}</button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'years') {
    const start = Math.floor(y / 12) * 12;
    return (
      <div className="cal">
        <Header title={`${start} – ${start + 11}`} onPrev={() => setMonth(new Date(y - 12, month.getMonth(), 1))} onNext={() => setMonth(new Date(y + 12, month.getMonth(), 1))} />
        <div className="cal-grid cal-grid-3">
          {Array.from({ length: 12 }, (_, i) => start + i).map(yr => (
            <button key={yr} type="button" className={`cal-cell ${yr === y ? 'selected' : ''}`}
              onClick={() => { setMonth(new Date(yr, month.getMonth(), 1)); setView('months'); }}>{yr}</button>
          ))}
        </div>
      </div>
    );
  }

  // Range shading: a fixed range, or from + hovered day while choosing the end
  let lo = range?.from, hi = range?.to;
  if (range?.from && !range.to && hover) [lo, hi] = hover < range.from ? [hover, range.from] : [range.from, hover];

  return (
    <div className="cal" onMouseLeave={() => setHover(null)}>
      <Header title={ja() ? `${y}年${month.getMonth() + 1}月` : `${monthNames()[month.getMonth()]} ${y}`} onTitle={() => setView('months')}
        onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} />
      <div className="cal-grid">
        {weekdayNames().map(d => <div key={d} className="cal-weekday">{d}</div>)}
        {monthGrid(month).map(d => {
          const iso = toIso(d);
          const cls = [
            'cal-cell', 'cal-day',
            d.getMonth() !== month.getMonth() && 'outside',
            iso === today && 'today',
            (iso === value || iso === lo || iso === hi) && 'selected',
            lo && hi && iso > lo && iso < hi && 'in-range',
            d.getDay() % 6 === 0 && 'weekend',
          ].filter(Boolean).join(' ');
          return (
            <button key={iso} type="button" className={cls} disabled={disabled(iso)}
              onMouseEnter={() => setHover(iso)} onClick={() => onPick(iso)}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

function Header({ title, onTitle, onPrev, onNext }) {
  return (
    <div className="cal-head">
      <button type="button" className="cal-nav" onClick={onPrev} aria-label="Previous">‹</button>
      <button type="button" className="cal-title" onClick={onTitle} disabled={!onTitle}>{title}</button>
      <button type="button" className="cal-nav" onClick={onNext} aria-label="Next">›</button>
    </div>
  );
}
