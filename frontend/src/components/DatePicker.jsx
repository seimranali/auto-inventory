import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Calendar from './Calendar';
import { Chevron } from './Dropdown';
import { t } from '../i18n';
import { formatDate, parseDate, todayIso, fromIso, addMonths, toIso } from '../dates';

// Closes a popover on outside click / Escape
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onDoc = e => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = e => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

// Right-aligns the panel to its control when left alignment would run off the viewport
function usePanelAlign(open) {
  const panelRef = useRef();
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    if (!open) return setAlignRight(false);
    const panel = panelRef.current;
    if (!panel) return;
    const { left, width } = panel.parentElement.getBoundingClientRect();
    setAlignRight(left + panel.offsetWidth > window.innerWidth - 8 && left + width - panel.offsetWidth >= 8);
  }, [open]);
  return { panelRef, alignClass: alignRight ? 'align-right' : '' };
}

const CalendarIcon = () => (
  <svg className="dp-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

/**
 * Single date. Type a date (28/10/2026, 28 Oct 2026, 2026-10-28) or pick from the calendar.
 * value / onChange use ISO 'YYYY-MM-DD'; '' when empty.
 */
export function DatePicker({ value, onChange, min, max, placeholder = 'DD/MM/YYYY', clearable = true, disabled, id }) {
  const { open, setOpen, ref } = usePopover();
  const { panelRef, alignClass } = usePanelAlign(open);
  const [text, setText] = useState(formatDate(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(formatDate(value)); setInvalid(false); }, [value]);

  const commit = () => {
    const iso = parseDate(text);
    if (iso === null || (iso && ((min && iso < min) || (max && iso > max)))) return setInvalid(true);
    setInvalid(false);
    if (iso !== (value || '')) onChange(iso);
    else setText(formatDate(value));
  };
  const pick = iso => { onChange(iso); setOpen(false); };

  return (
    <div ref={ref} className={`dp ${open ? 'open' : ''}`}>
      <div className={`dp-control ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''}`}>
        <input id={id} value={text} placeholder={placeholder} disabled={disabled} title={invalid ? 'Invalid date' : undefined}
          onChange={e => setText(e.target.value)} onFocus={() => setOpen(true)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); setOpen(false); } }} />
        {clearable && value && !disabled && <button type="button" className="dp-clear" onClick={() => onChange('')} title="Clear">×</button>}
        <button type="button" className="dp-toggle" onClick={() => setOpen(o => !o)} disabled={disabled} aria-label="Open calendar"><CalendarIcon /></button>
      </div>
      {open && (
        <div ref={panelRef} className={`dp-panel ${alignClass}`}>
          <Calendar key={value} value={value} min={min} max={max} onPick={pick} />
          <div className="dp-foot">
            <button type="button" className="btn" onClick={() => pick(todayIso())}>{t('Today')}</button>
            {clearable && <button type="button" className="btn" onClick={() => pick('')}>{t('Clear')}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Date range with presets and two side-by-side months.
 * value { from, to }; presets { label: () => [from, to] }
 */
export function DateRangePicker({ value, onChange, presets = {}, placeholder = 'All dates' }) {
  const { open, setOpen, ref } = usePopover();
  const { panelRef, alignClass } = usePanelAlign(open);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => addMonths(fromIso(value.to) || new Date(), -1));

  useEffect(() => { if (open) { setDraft(value); setMonth(addMonths(fromIso(value.to) || new Date(), -1)); } }, [open]);

  const pick = iso => {
    // First click starts a new range, second click closes it
    if (!draft.from || draft.to) return setDraft({ from: iso, to: '' });
    const [from, to] = iso < draft.from ? [iso, draft.from] : [draft.from, iso];
    setDraft({ from, to });
    onChange({ ...value, from, to, preset: '' });
    setOpen(false);
  };
  const apply = (from, to, preset = '') => { onChange({ ...value, from, to, preset }); setOpen(false); };

  // A preset is "active" only when it was clicked (and still gives the same dates) — dates picked by hand
  // always show as dates, even if they happen to match a preset such as Last 3 Months
  const activePreset = value.preset && presets[value.preset]
    && (([f, t]) => f === value.from && t === value.to)(presets[value.preset]()) ? value.preset : null;
  const dates = value.from || value.to ? `${formatDate(value.from) || t('Start')} → ${formatDate(value.to) || t('Today')}` : '';
  const label = activePreset ? (dates ? `${t(activePreset)} · ${dates}` : t(activePreset)) : dates || t(placeholder);

  return (
    <div ref={ref} className={`dp dp-range ${open ? 'open' : ''}`}>
      <button type="button" className="dp-control dp-range-control" onClick={() => setOpen(o => !o)}>
        <CalendarIcon /><span>{label}</span><Chevron />
      </button>
      {open && (
        <div ref={panelRef} className={`dp-panel dp-range-panel ${alignClass}`}>
          <div className="dp-presets">
            {Object.entries(presets).map(([name, fn]) => (
              <button key={name} type="button" className={`dp-preset ${name === activePreset ? 'on' : ''}`} onClick={() => apply(...fn(), name)}>{t(name)}</button>
            ))}
          </div>
          <div>
            <div className="dp-months">
              <Calendar range={draft} onPick={pick} month={month} onMonthChange={setMonth} />
              <Calendar range={draft} onPick={pick} month={addMonths(month, 1)} onMonthChange={m => setMonth(addMonths(m, -1))} />
            </div>
            <div className="dp-foot">
              <span className="muted">
                {draft.from && !draft.to ? t('From {date} — pick an end date', { date: formatDate(draft.from) }) : t('Pick a start date')}
              </span>
              <button type="button" className="btn" onClick={() => apply('', '')}>{t('Clear')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DATE_PRESETS = {
  Today: () => [todayIso(), todayIso()],
  'Last 7 Days': () => { const d = new Date(); return [toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6)), todayIso()]; },
  'This Month': () => { const d = new Date(); return [toIso(new Date(d.getFullYear(), d.getMonth(), 1)), todayIso()]; },
  'Last Month': () => { const d = new Date(); return [toIso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toIso(new Date(d.getFullYear(), d.getMonth(), 0))]; },
  'Last 3 Months': () => { const d = new Date(); return [toIso(new Date(d.getFullYear(), d.getMonth() - 2, 1)), todayIso()]; },
  'This Year': () => [`${new Date().getFullYear()}-01-01`, todayIso()],
  'Last Year': () => { const y = new Date().getFullYear() - 1; return [`${y}-01-01`, `${y}-12-31`]; },
  'All Time': () => ['', ''],
};
