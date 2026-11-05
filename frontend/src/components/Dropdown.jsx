import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';

export const Chevron = () => (
  <svg className="dd-caret" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

/**
 * Searchable dropdown with sorting, grouping and async loading.
 *
 * options      string[] | { value, label, group?, description?, count? }[]
 * loadOptions  async (query) => options   — fetched on open and as the user types (debounced)
 * loadDeps     array; changing it clears cached async options (e.g. [make] for a model list)
 * groupBy      'group' (default, uses option.group) | (option) => string | false
 * sort         'none' (default) | 'asc' | 'desc' | (a, b) => number
 * sortable     show an A→Z / Z→A toggle in the panel
 * creatable    allow typing a value that is not in the list
 * clearable    show a × button when a value is set (default true)
 * action       { label, onClick(query) } — a pinned link under the list (e.g. "+ Add new party")
 */
export default function Dropdown({
  value, onChange, options = [], loadOptions, loadDeps = [], groupBy = 'group', sort = 'none', sortable = false,
  creatable = false, clearable = true, searchable = true, placeholder = '— Select —', disabled, className = '', id, action,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [sortDir, setSortDir] = useState(sort);
  const root = useRef();
  const search = useRef();
  const list = useRef();
  const reqId = useRef(0);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = e => !root.current?.contains(e.target) && close();
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // The panel is fixed-positioned under (or above, when there's no room) the control, so a scrolling
  // container such as a modal body never clips it. It follows the control while the page scrolls.
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      const r = root.current?.getBoundingClientRect();
      if (!r) return;
      const want = 360, gap = 4, margin = 8;
      const below = window.innerHeight - r.bottom - margin, above = r.top - margin;
      const up = below < Math.min(want, 240) && above > below;
      const maxHeight = Math.max(160, Math.min(want, up ? above : below) - gap);
      const width = Math.min(Math.max(r.width, 220), window.innerWidth - 2 * margin);
      const left = Math.min(Math.max(margin, r.left), window.innerWidth - width - margin);
      setPos(up ? { left, width, bottom: window.innerHeight - r.top + gap, maxHeight } : { left, width, top: r.bottom + gap, maxHeight });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  // Invalidate async results when dependencies change
  useEffect(() => { setRemote(null); }, loadDeps);

  // Debounced async load while open
  useEffect(() => {
    if (!open || !loadOptions) return;
    const my = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      loadOptions(query)
        .then(r => my === reqId.current && (setRemote(r), setError(null)))
        .catch(e => my === reqId.current && setError(e.message))
        .finally(() => my === reqId.current && setLoading(false));
    }, remote ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, query, ...loadDeps]);

  const normalized = useMemo(() => {
    const src = loadOptions ? [...(remote || []), ...options] : options;
    const seen = new Set();
    return src.map(o => (typeof o === 'object' ? { ...o, label: t(o.label), group: t(o.group) } : { value: o, label: t(String(o)) }))
      .filter(o => !seen.has(o.value) && seen.add(o.value));
  }, [options, remote, loadOptions]);

  const selected = normalized.find(o => String(o.value) === String(value));
  const displayLabel = selected ? selected.label : value || '';

  // Filter → sort → group
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = q ? normalized.filter(o => `${o.label} ${o.description || ''} ${o.group || ''}`.toLowerCase().includes(q)) : normalized;
    if (typeof sortDir === 'function') items = [...items].sort(sortDir);
    else if (sortDir !== 'none') items = [...items].sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }) * (sortDir === 'desc' ? -1 : 1));
    const keyOf = groupBy === false ? () => '' : typeof groupBy === 'function' ? groupBy : o => o[groupBy] || '';
    const map = new Map();
    items.forEach(o => { const k = keyOf(o); map.has(k) || map.set(k, []); map.get(k).push(o); });
    const out = [...map.entries()];
    if (sortDir !== 'none' && typeof sortDir !== 'function') out.sort(([a], [b]) => a.localeCompare(b) * (sortDir === 'desc' ? -1 : 1));
    return out;
  }, [normalized, query, sortDir, groupBy]);

  const flat = groups.flatMap(([, items]) => items);
  const canCreate = creatable && query.trim() && !normalized.some(o => String(o.label).toLowerCase() === query.trim().toLowerCase());
  const choices = canCreate ? [...flat, { value: query.trim(), label: query.trim(), create: true }] : flat;

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => { list.current?.querySelector('.dd-option.active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function openPanel() {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => search.current?.focus(), 0);
  }
  function close() { setOpen(false); setQuery(''); }
  function pick(o) { onChange(o ? o.value : ''); close(); }

  function onKey(e) {
    if (!open && ['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); return openPanel(); }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, choices.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choices[active] && pick(choices[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close();
  }

  const highlight = text => {
    const q = query.trim();
    const i = q ? String(text).toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return text;
    const s = String(text);
    return <>{s.slice(0, i)}<mark>{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>;
  };

  let idx = -1;
  return (
    <div ref={root} className={`dd ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`} onKeyDown={onKey}>
      <button type="button" id={id} className="dd-control" onClick={() => (open ? close() : openPanel())} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className={displayLabel ? 'dd-value' : 'dd-placeholder'}>{displayLabel || t(placeholder)}</span>
        {clearable && value && !disabled && (
          <span className="dd-clear" role="button" title="Clear" onMouseDown={e => { e.stopPropagation(); e.preventDefault(); pick(null); }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        )}
        <Chevron />
      </button>

      {open && (
        <div className={`dd-panel ${pos?.bottom != null ? 'up' : ''}`} style={pos ? {
          position: 'fixed', left: pos.left, width: pos.width, minWidth: 0, maxWidth: 'none', maxHeight: pos.maxHeight,
          top: pos.top ?? 'auto', bottom: pos.bottom ?? 'auto',
        } : { visibility: 'hidden' }}>
          {(searchable || sortable) && (
            <div className="dd-tools">
              {searchable && (
                <input ref={search} className="dd-search" placeholder={t(creatable ? 'Search or type new…' : 'Search…')}
                  value={query} onChange={e => setQuery(e.target.value)} />
              )}
              {sortable && (
                <button type="button" className="dd-sort" title="Sort"
                  onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : d === 'desc' ? sort : 'asc'))}>
                  {sortDir === 'asc' ? 'A→Z' : sortDir === 'desc' ? 'Z→A' : 'Sort'}
                </button>
              )}
            </div>
          )}
          <ul ref={list} className="dd-list" role="listbox">
            {groups.map(([group, items]) => (
              <li key={group || '_'} className="dd-group">
                {group && <div className="dd-group-label">{group}<span>{items.length}</span></div>}
                <ul>
                  {items.map(o => {
                    const i = ++idx;
                    const isSel = String(o.value) === String(value);
                    return (
                      <li key={o.value} role="option" aria-selected={isSel}
                        className={`dd-option ${i === active ? 'active' : ''} ${isSel ? 'selected' : ''}`}
                        onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(o); }}>
                        <span className="dd-label">{highlight(o.label)}</span>
                        {o.description && <span className="dd-desc">{o.description}</span>}
                        {o.count != null && <span className="dd-count">{o.count}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {canCreate && (
              <li className={`dd-option dd-create ${active === choices.length - 1 ? 'active' : ''}`}
                onMouseEnter={() => setActive(choices.length - 1)} onMouseDown={e => { e.preventDefault(); pick(choices[choices.length - 1]); }}>
                + Use “{query.trim()}”
              </li>
            )}
            {loading && <li className="dd-status">{t('Loading…')}</li>}
            {error && <li className="dd-status dd-error">{error}</li>}
            {!loading && !error && !choices.length && <li className="dd-status">{t('No matches')}</li>}
          </ul>
          {action && (
            <button type="button" className="dd-action"
              onMouseDown={e => { e.preventDefault(); const q = query.trim(); close(); action.onClick(q); }}>
              {t(action.label)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
