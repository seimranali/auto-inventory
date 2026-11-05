import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, vehicleTitle } from '../format';
import { formatDate } from '../dates';
import { t } from '../i18n';

// Slide-in panel from the right; closes on Escape or backdrop click.
// Portaled to <body> and stops submits so it never interacts with the page's form.
export function Drawer({ title, children, footer, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()} onSubmit={e => e.stopPropagation()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2>{t(title)}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

const Row = ({ k, v }) => (v || v === 0 ? <div><dt>{t(k)}</dt><dd>{v}</dd></div> : null);

// Quick party preview from the Buying / Sell pickers, without leaving the form
export default function PartyDrawer({ id, onClose }) {
  const { data, error, loading } = useAsync(() => api.party(id), [id]);
  const p = data?.party;
  const intl = p?.scope === 'International';
  const deals = data ? [
    ...data.purchases.map(v => ({ v, kind: 'Bought', date: v.purchase_date, amount: v.total_cost })),
    ...data.sales.map(v => ({ v, kind: 'Sold', date: v.sale_date, amount: v.sale_price })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6) : [];

  return (
    <Drawer title="Party Profile" onClose={onClose}
      footer={p && <Link className="btn primary" to={`/parties/${p.id}`} target="_blank">{t('Open full profile')} ↗</Link>}>
      {loading && <div className="empty">{t('Loading…')}</div>}
      {error && <div className="error-box">{error.message}</div>}
      {p && <>
        <div className="pdw-head">
          <span className={`pd-avatar ${intl ? 'intl' : ''}`}>{p.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <h3>{p.name}</h3>
            <div className="muted">{[p.code, p.role, p.category].filter(Boolean).join(' · ')}</div>
            <span className={`badge ${intl ? 'b-export' : 'b-local'}`}>{t(p.scope)}</span>
          </div>
        </div>

        <div className="pdw-stats">
          <div><small>{t('Bought from them')}</small><b>{data.totals.purchases.count}</b><span>{money(data.totals.purchases.value)}</span></div>
          <div><small>{t('Sold to them')}</small><b>{data.totals.sales.count}</b><span>{money(data.totals.sales.value)}</span></div>
          <div><small>{t('Balance Due')}</small><b className={data.totals.sales.receivable > 0 ? 'neg' : ''}>{money(data.totals.sales.receivable)}</b></div>
        </div>

        <h4 className="vd-h">{t('Contact')}</h4>
        <dl className="pd-list">
          <Row k="Contact Person" v={p.contact_person} />
          <Row k="Phone" v={p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`}>{p.phone}</a>} />
          <Row k="WhatsApp" v={p.whatsapp} />
          <Row k="Email" v={p.email && <a href={`mailto:${p.email}`}>{p.email}</a>} />
          <Row k="Address" v={[p.postal_code, p.prefecture || p.state, p.city, p.address, p.building, intl ? p.country : null].filter(Boolean).join(', ')} />
          <Row k="Port" v={p.port} />
        </dl>

        {(p.bank_name || p.account_no) && <>
          <h4 className="vd-h">{t('Bank')}</h4>
          <dl className="pd-list">
            <Row k="Bank" v={[p.bank_name, p.bank_branch].filter(Boolean).join(' · ')} />
            <Row k="Account" v={[p.account_title, p.account_no || p.iban].filter(Boolean).join(' · ')} />
            <Row k="SWIFT" v={p.swift} />
          </dl>
        </>}

        <h4 className="vd-h">{t('Recent deals')}</h4>
        {deals.length ? (
          <ul className="pdw-deals">
            {deals.map(({ v, kind, date, amount }) => (
              <li key={`${kind}-${v.id}`}>
                <div><b>{vehicleTitle(v)}</b><small className="muted">{t(kind)} · {formatDate(date)} · {v.stock_no}</small></div>
                <span>{money(amount)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{t('No deals yet.')}</p>}

        {p.notes && <><h4 className="vd-h">{t('Notes')}</h4><p className="vd-notes">{p.notes}</p></>}
      </>}
    </Drawer>
  );
}
