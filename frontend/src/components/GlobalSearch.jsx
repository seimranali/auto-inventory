import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { NAV } from '../nav';
import { t } from '../i18n';
import { money, vehicleTitle } from '../format';
import { formatDate } from '../dates';
import NavIcon from './NavIcon';
import { Thumb } from './Media';
import { StatusBadge, SaleTypeBadge } from './Badge';

const RECENT_KEY = 'globalSearchRecent';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
const saveRecent = list => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))); } catch { /* storage unavailable */ } };

function Highlight({ text, q }) {
  const s = String(text ?? '');
  const i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return s;
  return <>{s.slice(0, i)}<mark>{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Header search: live results across vehicles, invoices, parties and pages.
 * Ctrl/⌘+K or "/" focuses it from anywhere; ↑/↓ + Enter to open; Esc to close.
 */
export default function GlobalSearch() {
  const nav = useNavigate();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(readRecent);
  const wrap = useRef();
  const input = useRef();
  const list = useRef();
  const term = q.trim();

  // Global shortcuts
  useEffect(() => {
    const onKey = e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Debounced fetch; aborts stale requests so results never arrive out of order
  useEffect(() => {
    if (term.length < 2 || !can('vehicles:read')) { setRes(null); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api.search(term, ctrl.signal).then(r => { setRes(r); setLoading(false); }).catch(e => { if (e.name !== 'AbortError') setLoading(false); });
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  const pages = useMemo(() => {
    const available = NAV.filter(n => !n.head && can(n.perm));
    if (!term) return [];
    const q2 = term.toLowerCase();
    return available.filter(n => `${n.label} ${t(n.label)} ${n.keywords || ''}`.toLowerCase().includes(q2)).slice(0, 4);
  }, [term, can]);

  // Flat, ordered list of selectable items (keyboard order = render order)
  const groups = useMemo(() => {
    const g = [];
    if (!term) {
      if (recent.length) g.push({ title: 'Recent searches', items: recent.map(r => ({ key: `r-${r}`, kind: 'recent', label: r, run: () => setQ(r) })) });
      g.push({ title: 'Quick actions', items: NAV.filter(n => ['/vehicles/new', '/sales/new', '/parties', '/inventory'].includes(n.to) && can(n.perm))
        .map(n => ({ key: n.to, kind: 'page', page: n, run: () => nav(n.to) })) });
      return g;
    }
    if (res?.vehicles.length) g.push({ title: 'Vehicles', items: res.vehicles.map(v => ({ key: `v-${v.id}`, kind: 'vehicle', v, run: () => nav(`/vehicles/${v.id}`) })) });
    if (res?.invoices.length) g.push({ title: 'Invoices', items: res.invoices.map(v => ({ key: `i-${v.id}`, kind: 'invoice', v, run: () => nav(`/vehicles/${v.id}/invoice`) })) });
    if (res?.parties.length) g.push({ title: 'Parties', items: res.parties.map(p => ({ key: `p-${p.id}`, kind: 'party', p, run: () => nav(`/parties/${p.id}`) })) });
    if (pages.length) g.push({ title: 'Pages', items: pages.map(n => ({ key: n.to, kind: 'page', page: n, run: () => nav(n.to) })) });
    g.push({ title: '', items: [{ key: 'all', kind: 'all', run: () => nav(`/inventory?q=${encodeURIComponent(term)}`) }] });
    return g;
  }, [term, res, pages, recent, can]);
  const flat = groups.flatMap(g => g.items);

  useEffect(() => { setActive(0); }, [term, res]);
  useEffect(() => { list.current?.querySelector('.gs-item.active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const choose = item => {
    if (!item) return;
    if (item.kind !== 'recent' && term) {
      const next = [term, ...recent.filter(r => r.toLowerCase() !== term.toLowerCase())];
      setRecent(next.slice(0, 6));
      saveRecent(next);
    }
    item.run();
    if (item.kind !== 'recent') { setOpen(false); setQ(''); input.current?.blur(); }
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
  };

  let idx = -1;
  const row = (item, content) => {
    const i = ++idx;
    return (
      <li key={item.key} role="option" aria-selected={i === active} className={`gs-item gs-${item.kind} ${i === active ? 'active' : ''}`}
        onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); choose(item); }}>
        {content}
      </li>
    );
  };

  const renderItem = item => {
    switch (item.kind) {
      case 'vehicle': {
        const v = item.v;
        return row(item, <>
          <Thumb name={v.cover} />
          <div className="gs-main">
            <b><Highlight text={vehicleTitle(v)} q={term} /></b>
            <small><Highlight text={v.stock_no} q={term} /> · <Highlight text={v.chassis_no || '-'} q={term} />{v.lot_no ? <> · Lot <Highlight text={v.lot_no} q={term} /></> : null}{v.color ? ` · ${v.color}` : ''}</small>
          </div>
          <StatusBadge status={v.status} />
        </>);
      }
      case 'invoice': {
        const v = item.v, due = (v.sale_price || 0) - (v.amount_received || 0);
        return row(item, <>
          <span className="gs-icon gs-icon-inv"><NavIcon name="sell" size={18} /></span>
          <div className="gs-main">
            <b><Highlight text={v.invoice_no} q={term} /> · <Highlight text={v.buyer_name} q={term} /></b>
            <small>{formatDate(v.sale_date)} · {vehicleTitle(v)} · <SaleTypeBadge type={v.sale_type} /></small>
          </div>
          <span className={`gs-amount ${due > 0 ? 'neg' : ''}`}>{due > 0 ? `${money(due)} due` : money(v.sale_price)}</span>
        </>);
      }
      case 'party': {
        const p = item.p, intl = p.scope === 'International';
        return row(item, <>
          <span className={`avatar ${intl ? 'avatar-intl' : ''}`}>{p.name.slice(0, 1).toUpperCase()}</span>
          <div className="gs-main">
            <b><Highlight text={p.name} q={term} />{p.name_kana ? <span className="gs-kana"> <Highlight text={p.name_kana} q={term} /></span> : null}</b>
            <small><Highlight text={p.code} q={term} /> · {p.role} · {p.category}{p.phone ? <> · <Highlight text={p.phone} q={term} /></> : null}</small>
          </div>
          <span className="gs-meta">{intl ? p.country : p.city || p.country}</span>
        </>);
      }
      case 'page':
        return row(item, <>
          <span className="gs-icon"><NavIcon name={item.page.icon} size={18} /></span>
          <div className="gs-main"><b>{term ? <Highlight text={t(item.page.label)} q={term} /> : t(item.page.label)}</b></div>
          <span className="gs-meta">{t('Go to ↵')}</span>
        </>);
      case 'recent':
        return row(item, <>
          <span className="gs-icon"><NavIcon name="clock" size={16} /></span>
          <div className="gs-main"><span>{item.label}</span></div>
        </>);
      default:
        return row(item, <>
          <span className="gs-icon"><NavIcon name="inventory" size={16} /></span>
          <div className="gs-main"><span>{t('See all vehicles matching')} “<b>{term}</b>”</span></div>
          <span className="gs-meta">↵</span>
        </>);
    }
  };

  const empty = term.length >= 2 && !loading && res && !res.vehicles.length && !res.invoices.length && !res.parties.length && !pages.length;

  return (
    <div className={`topbar-search gs ${open ? 'open' : ''}`} ref={wrap}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
      </svg>
      <input ref={input} value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        placeholder={t('Search vehicles, chassis, invoices, parties…')} role="combobox" aria-expanded={open} aria-controls="gs-list" aria-autocomplete="list" />
      {loading && <span className="gs-spinner" aria-label="Searching" />}
      {q ? <button type="button" className="gs-clear" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Clear search">×</button>
        : <kbd className="gs-kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd>}

      {open && (
        <div className="gs-panel">
          {term.length === 1 && <div className="gs-hint">{t('Keep typing…')}</div>}
          {empty && <div className="gs-empty">{t('No results for “{q}”.', { q: term })}</div>}
          <ul id="gs-list" ref={list} role="listbox" className="gs-list">
            {groups.map(g => (
              <li key={g.title || 'tail'} className="gs-group">
                {g.title && <div className="gs-group-title">{t(g.title)}{g.title === 'Recent searches' && (
                  <button type="button" onMouseDown={e => { e.preventDefault(); setRecent([]); saveRecent([]); }}>{t('Clear')}</button>)}</div>}
                <ul>{g.items.map(renderItem)}</ul>
              </li>
            ))}
          </ul>
          <div className="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {t('navigate')}</span><span><kbd>↵</kbd> {t('open')}</span><span><kbd>Esc</kbd> {t('close')}</span></div>
        </div>
      )}
    </div>
  );
}
