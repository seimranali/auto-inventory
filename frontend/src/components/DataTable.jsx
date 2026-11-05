import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Button from './Button';
import Dropdown from './Dropdown';
import { t } from '../i18n';

const PAGE_SIZES = [10, 20, 50, 100];
const BLANK = '\u0000blank'; // select-filter key for empty values

// True while the browser prints, so paginated tables print every row
function usePrinting() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true));
    const off = () => setPrinting(false);
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => { window.removeEventListener('beforeprint', on); window.removeEventListener('afterprint', off); };
  }, []);
  return printing;
}

// "1.5M" -> 1500000, "250k" -> 250000, "12,500" -> 12500, "JPY 1,028,000" / "¥500k" / "58,400 km" / "12%" -> the number
const parseNum = s => {
  const clean = String(s).trim().replace(/^(?:[a-z]{3}|[¥$€£₨])\s*/i, '').replace(/\s*(?:km|cc|d|days?|%)$/i, '');
  const m = /^(-?[\d.,]+)\s*([kmb])?$/i.exec(clean);
  if (!m) return NaN;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return n * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]?.toLowerCase()] || 1);
};

// Numeric filter expressions: >5M  <=30000  =2021  1M-5M  (plain number = exact match).
// percent columns hold fractions (0.129) but are typed as shown (12.9 or 12.9%)
function numberMatcher(expr, percent = false) {
  const e = expr.replace(/\s/g, '');
  const scale = v => (percent ? Math.round(v * 1000) / 10 : v);
  const NUM = '-?[\\d.,]+[kmb]?%?';
  let m = new RegExp(`^(>=|<=|>|<|=)(.+)$`).exec(e);
  if (m) {
    const n = parseNum(m[2]);
    if (isNaN(n)) return null;
    const cmp = { '>': v => v > n, '<': v => v < n, '>=': v => v >= n, '<=': v => v <= n, '=': v => v === n }[m[1]];
    return v => cmp(scale(v));
  }
  m = new RegExp(`^(${NUM})-(${NUM})$`, 'i').exec(e.replace(/^(?:[a-z]{3}|[¥$€£])/i, ''));
  if (m) {
    const a = parseNum(m[1]), b = parseNum(m[2]);
    return isNaN(a) || isNaN(b) ? null : v => scale(v) >= Math.min(a, b) && scale(v) <= Math.max(a, b);
  }
  const n = parseNum(e);
  return isNaN(n) ? null : v => scale(v) === n;
}

// Which filter control a column gets: explicit col.filter, else select for groupable, number for right-aligned, text otherwise
const filterType = c => (typeof c.filter === 'string' ? c.filter : c.groupable ? 'select' : c.align === 'right' ? 'number' : 'text');

const GroupIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M7 13h14M7 18h14M3 13h.01M3 18h.01" />
  </svg>
);

const FunnelIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h18l-7 8.5V19l-4 2v-8.5Z" />
  </svg>
);

/** Floating per-column filter panel, fixed-positioned under the header icon so the table's overflow can't clip it */
function FilterPopover({ col, type, value, options, anchor, onChange, onClose }) {
  const ref = useRef();
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState('');
  const bad = type === 'number' && draft.trim() && !numberMatcher(draft, col.percent);
  const shown = search.trim() ? options.filter(([val]) => t(val).toLowerCase().includes(search.trim().toLowerCase())) : options;

  useEffect(() => {
    const onDoc = e => !ref.current?.contains(e.target) && !e.target.closest?.('.th-filter') && onClose();
    const onKey = e => e.key === 'Escape' && onClose();
    const onScroll = e => !ref.current?.contains(e.target) && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    ref.current?.querySelector('input')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, []);

  const W = 240;
  const left = Math.max(8, Math.min(anchor.right - W, window.innerWidth - W - 8));
  const apply = v => { onChange(v); onClose(); };

  return (
    <div ref={ref} className="filter-pop" style={{ top: anchor.bottom + 6, left, width: W }} role="dialog" aria-label={`Filter ${col.label}`}>
      <div className="filter-pop-head">{t("Filter")} · {t(col.label)}</div>
      {type === 'select' ? <>
        {options.length > 8 && (
          <input className="filter-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search…')}
            onKeyDown={e => { if (e.key === 'Enter' && shown.length === 1) { e.preventDefault(); apply(shown[0][0]); } }} />
        )}
        <ul className="filter-options">
          {!search && <li className={!value ? 'on' : ''} onClick={() => apply('')}>{t("All")}</li>}
          {shown.map(([val, n]) => (
            <li key={val} className={value === val ? 'on' : ''} onClick={() => apply(val)}>
              <span>{val === BLANK ? <i className="muted">{t('(blank)')}</i> : t(val)}</span><small>{n}</small>
            </li>
          ))}
          {!shown.length && <li className="muted">{t('No matches')}</li>}
        </ul>
      </> : (
        <form onSubmit={e => { e.preventDefault(); if (!bad) apply(draft); }}>
          <input className={bad ? 'bad' : ''} value={draft} onChange={e => setDraft(e.target.value)}
            placeholder={type === 'number' ? (col.percent ? 'e.g. >10, <5%, 5-15' : 'e.g. >5M, <30000, 1M-5M') : 'Contains…'} />
          {type === 'number' && <div className="filter-help">Use &gt; &lt; &gt;= &lt;= = or a range a-b. k / M / B allowed{col.percent ? '; values are in %' : ''}.</div>}
          <div className="filter-pop-actions">
            <button type="button" className="btn" onClick={() => apply('')}>Clear</button>
            <button type="submit" className="btn primary" disabled={bad}>Apply</button>
          </div>
        </form>
      )}
    </div>
  );
}

const SortIcon = ({ dir }) => (
  <svg className="sort-icon" viewBox="0 0 10 14" width="9" height="12" aria-hidden="true">
    <path d="M5 1 9 5.5H1Z" className={dir === 1 ? 'on' : ''} />
    <path d="M5 13 1 8.5h8Z" className={dir === -1 ? 'on' : ''} />
  </svg>
);

/**
 * Data grid: sorting, optional per-column filters, grouping, pagination, totals row, CSV export.
 *
 * columns: [{ key, label, render?(row), value?(row), align?: 'right', total?: 'sum' | (rows) => node,
 *             format?(n), filter?: false, groupable?: boolean }]
 * filterable  show a filter input under each header (columns opt out with filter: false)
 * groupable   show a "Group by" picker listing columns with groupable: true
 * pageSize    rows per page; omit for no pagination
 * onPrint     show a Print button next to Export CSV
 * footerRows  extra rows under the totals: [{ label, values: { columnKey: node }, className? }]
 */
export default function DataTable({
  columns, rows, onRowClick, emptyText = 'No records found.', exportName, rowKey = 'id',
  filterable = false, groupable = false, pageSize: initialPageSize, toolbar, onPrint, footerRows = [],
}) {
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null); // { key, anchor: DOMRect }
  const [groupKey, setGroupKey] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize || 0);

  const getValue = (col, row) => (col.value ? col.value(row) : row[col.key]);
  // Text search matches the raw value and what the cell shows (e.g. "JPY 1,028,000", "58,400 km")
  const text = (col, row) => {
    const raw = getValue(col, row);
    const shown = col.format ? col.format(raw) : null;
    return `${raw ?? ''} ${typeof shown === 'string' || typeof shown === 'number' ? shown : ''}`.toLowerCase();
  };
  const selectKey = (col, row) => String(getValue(col, row) ?? '') || BLANK;

  // Filter → sort
  const filtered = useMemo(() => {
    const tests = Object.entries(filters).filter(([, v]) => v.trim()).map(([k, v]) => {
      const col = columns.find(c => c.key === k);
      if (!col) return () => true;
      const type = filterType(col);
      if (type === 'select') return r => selectKey(col, r) === v;
      if (type === 'number') {
        const match = numberMatcher(v, col.percent);
        if (match) return r => { const x = getValue(col, r); return x != null && x !== '' && !isNaN(Number(x)) && match(Number(x)); };
      }
      const q = v.trim().toLowerCase();
      return r => text(col, r).includes(q);
    });
    return tests.length ? rows.filter(r => tests.every(t => t(r))) : rows;
  }, [rows, filters, columns]);

  // Distinct values (with counts) for select-type column filters
  const distinct = useMemo(() => {
    if (!filterable) return {};
    const out = {};
    columns.filter(c => c.label && c.filter !== false && filterType(c) === 'select').forEach(c => {
      const counts = new Map();
      rows.forEach(r => { const v = selectKey(c, r); counts.set(v, (counts.get(v) || 0) + 1); });
      // (blank) last
      out[c.key] = [...counts.entries()].sort(([a], [b]) => (a === BLANK) - (b === BLANK) || a.localeCompare(b, undefined, { numeric: true }));
    });
    return out;
  }, [rows, columns, filterable]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find(c => c.key === sort.key);
    return [...filtered].sort((a, b) => {
      const x = getValue(col, a), y = getValue(col, b);
      if (x == null || x === '') return 1;
      if (y == null || y === '') return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
    });
  }, [filtered, sort, columns]);

  // Group (groups keep the sorted row order; group names sort A→Z)
  const groupCol = columns.find(c => c.key === groupKey);
  const groups = useMemo(() => {
    if (!groupCol) return null;
    const map = new Map();
    sorted.forEach(r => {
      const k = String(getValue(groupCol, r) ?? '') || '(blank)';
      map.has(k) || map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sorted, groupCol]);

  // Display items: group headers + visible rows; pagination slices these
  const items = useMemo(() => {
    if (!groups) return sorted.map(r => ({ row: r }));
    return groups.flatMap(([name, rs]) => [{ group: name, rows: rs }, ...(collapsed.has(name) ? [] : rs.map(r => ({ row: r })))]);
  }, [groups, sorted, collapsed]);

  const pages = pageSize ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;
  useEffect(() => { setPage(1); }, [filters, sort, groupKey, pageSize, rows]);
  useEffect(() => { if (page > pages) setPage(pages); }, [pages]);
  const printing = usePrinting();
  const visible = pageSize && !printing ? items.slice((page - 1) * pageSize, page * pageSize) : items;

  const hasTotals = columns.some(c => c.total);
  const totalFor = (col, rs) => {
    if (typeof col.total === 'function') return col.total(rs);
    if (col.total === 'sum') {
      const s = rs.reduce((acc, r) => acc + (Number(getValue(col, r)) || 0), 0);
      return col.format ? col.format(s) : s;
    }
    return '';
  };

  const exportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cols = columns.filter(c => c.label);
    const lines = [cols.map(c => esc(c.label)).join(',')];
    sorted.forEach(r => lines.push(cols.map(c => esc(getValue(c, r))).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${exportName}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleSort = key => setSort(s => (s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 }));
  const toggleGroup = name => setCollapsed(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const activeFilters = Object.values(filters).filter(v => v.trim()).length;
  const groupOptions = columns.filter(c => c.groupable).map(c => ({ value: c.key, label: t(c.label) }));
  const showToolbar = toolbar || exportName || groupable || filterable;

  const cell = (c, r) => (c.render ? c.render(r) : c.format ? c.format(getValue(c, r)) : getValue(c, r) ?? '-');
  const from = items.length ? (page - 1) * pageSize + 1 : 0;

  return (
    <div className="grid-wrap">
      {showToolbar && (
        <div className="grid-toolbar no-print">
          <div className="row">
            {toolbar}
            {groupable && (
              <Dropdown value={groupKey} onChange={g => { setGroupKey(g); setCollapsed(new Set()); }} options={groupOptions}
                placeholder="Group by…" searchable={false} />
            )}
            {groups && (
              <>
                <Button onClick={() => setCollapsed(new Set())}>Expand all</Button>
                <Button onClick={() => setCollapsed(new Set(groups.map(([g]) => g)))}>Collapse all</Button>
              </>
            )}
            {activeFilters > 0 && <Button onClick={() => setFilters({})}>{t("Clear column filters")} ({activeFilters})</Button>}
          </div>
          <div className="row">
            <span className="muted">{sorted.length === rows.length ? t("{n} records", { n: rows.length }) : t("{n} of {total} records", { n: sorted.length, total: rows.length })}</span>
            {onPrint && sorted.length > 0 && <Button onClick={onPrint}>{t('Print')}</Button>}
            {exportName && sorted.length > 0 && <Button onClick={exportCsv}>Export CSV</Button>}
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`${c.align === 'right' ? 'num' : ''} ${c.label ? 'sortable' : ''} ${sort.key === c.key ? 'sorted' : ''}`}
                  onClick={() => c.label && toggleSort(c.key)} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
                  title={c.label ? t(sort.key !== c.key ? 'Sort ascending' : sort.dir > 0 ? 'Sort descending' : 'Clear sort') : undefined}>
                  <span className="th-inner">
                    {t(c.label)}
                    {c.label && <SortIcon dir={sort.key === c.key ? sort.dir : 0} />}
                    {groupable && c.groupable && (
                      <button type="button" className={`th-filter th-group no-print ${groupKey === c.key ? 'active' : ''}`}
                        title={groupKey === c.key ? 'Remove grouping' : `Group by ${c.label}`} aria-label={`Group by ${c.label}`}
                        aria-pressed={groupKey === c.key}
                        onClick={e => { e.stopPropagation(); setGroupKey(g => (g === c.key ? '' : c.key)); setCollapsed(new Set()); }}>
                        <GroupIcon />
                      </button>
                    )}
                    {filterable && c.label && c.filter !== false && (
                      <button type="button" className={`th-filter no-print ${filters[c.key] ? 'active' : ''} ${openFilter?.key === c.key ? 'open' : ''}`}
                        title={filters[c.key] ? `Filtered: ${filters[c.key]}` : `Filter ${c.label}`} aria-label={`Filter ${c.label}`}
                        onClick={e => {
                          e.stopPropagation();
                          setOpenFilter(o => (o?.key === c.key ? null : { key: c.key, anchor: e.currentTarget.getBoundingClientRect() }));
                        }}>
                        <FunnelIcon />
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={columns.length} className="empty">{t(emptyText)}</td></tr>}
            {visible.map((it, i) => it.group != null ? (
              <tr key={`g-${it.group}`} className="group-row" onClick={() => toggleGroup(it.group)}>
                {columns.map((c, ci) => ci === 0 ? (
                  <td key={c.key} colSpan={1} className="group-label">
                    <span className={`group-caret ${collapsed.has(it.group) ? '' : 'open'}`}>▸</span>
                  </td>
                ) : ci === 1 ? (
                  <td key={c.key} colSpan={1}><b>{t(it.group)}</b> <span className="group-count">{it.rows.length}</span></td>
                ) : (
                  <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.total ? totalFor(c, it.rows) : ''}</td>
                ))}
              </tr>
            ) : (
              <tr key={it.row[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(it.row) : undefined} className={onRowClick ? 'clickable' : ''}>
                {columns.map(c => <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{cell(c, it.row)}</td>)}
              </tr>
            ))}
          </tbody>
          {hasTotals && sorted.length > 0 && (
            <tfoot>
              <tr>
                {columns.map((c, i) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{i === 0 && !c.total ? t('Total') : totalFor(c, sorted)}</td>
                ))}
              </tr>
              {footerRows.map(fr => {
                // The label spans every column up to the first one with a value
                const first = Math.max(1, columns.findIndex(c => c.key in fr.values));
                return (
                  <tr key={fr.label} className={`footer-row ${fr.className || ''}`}>
                    <td colSpan={first} className="footer-label">{t(fr.label)}</td>
                    {columns.slice(first).map(c => (
                      <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{fr.values[c.key] ?? ''}</td>
                    ))}
                  </tr>
                );
              })}
            </tfoot>
          )}
        </table>
      </div>
      {openFilter && (() => {
        const col = columns.find(c => c.key === openFilter.key);
        return (
          <FilterPopover key={col.key} col={col} type={filterType(col)} value={filters[col.key] || ''} options={distinct[col.key] || []}
            anchor={openFilter.anchor} onClose={() => setOpenFilter(null)}
            onChange={v => setFilters(f => ({ ...f, [col.key]: v }))} />
        );
      })()}
      {(activeFilters > 0 || groupCol) && (
        <div className="filter-chips no-print">
          {groupCol && (
            <span className="filter-chip group-chip">
              <GroupIcon /> {t("Grouped by")}: <b>{t(groupCol.label)}</b> · {groups.length}
              <button type="button" onClick={() => setGroupKey('')} aria-label="Remove grouping">×</button>
            </span>
          )}
          {Object.entries(filters).filter(([, v]) => v.trim()).map(([k, v]) => (
            <span key={k} className="filter-chip">
              {t(columns.find(c => c.key === k)?.label)}: <b>{v === BLANK ? t('(blank)') : t(v)}</b>
              <button type="button" onClick={() => setFilters(f => ({ ...f, [k]: '' }))} aria-label="Remove filter">×</button>
            </span>
          ))}
        </div>
      )}
      {pageSize > 0 && items.length > 0 && (
        <div className="pager no-print">
          <span className="muted">{t("Showing {from}–{to} of {total}", { from, to: Math.min(page * pageSize, items.length), total: items.length })}</span>
          <div className="row">
            <span className="muted">{t("Rows per page")}</span>
            <Dropdown value={pageSize} onChange={v => setPageSize(Number(v) || initialPageSize)} searchable={false} clearable={false}
              options={PAGE_SIZES.map(n => ({ value: n, label: String(n) }))} />
            <div className="pager-buttons">
              <button type="button" className="btn" disabled={page === 1} onClick={() => setPage(1)} aria-label="First page">«</button>
              <button type="button" className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page">‹</button>
              {pageNumbers(page, pages).map((p, i) => p === '…'
                ? <span key={`e${i}`} className="pager-gap">…</span>
                : <button key={p} type="button" className={`btn ${p === page ? 'on' : ''}`} onClick={() => setPage(p)}>{p}</button>)}
              <button type="button" className="btn" disabled={page === pages} onClick={() => setPage(p => p + 1)} aria-label="Next page">›</button>
              <button type="button" className="btn" disabled={page === pages} onClick={() => setPage(pages)} aria-label="Last page">»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 1 … 4 5 6 … 12
function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = [1, page - 1, page, page + 1, pages].filter(p => p >= 1 && p <= pages);
  const out = [];
  [...new Set(set)].sort((a, b) => a - b).forEach((p, i, arr) => { if (i && p - arr[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
}
