import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { useAuth } from '../auth';
import { money, compact, pct, margin } from '../format';
import { MONTHS, formatDate } from '../dates';
import {
  PageHeader, StatCard, DataTable, Button, Tabs, Loader, ErrorBox, EmptyState, useToast, vehicleColumns,
} from '../components';
import BarChart from '../components/BarChart';
import NavIcon from '../components/NavIcon';
import { RoleTag, ScopeTag } from './PartiesPage';

const JP_ACCOUNT_LABEL = { Ordinary: '普通', Current: '当座', Savings: '貯蓄' };
const has = v => v !== null && v !== undefined && v !== '';
const digits = s => (s || '').replace(/[^\d+]/g, '');

// Only rows that have a value; nothing renders "-"
function Details({ items }) {
  const shown = items.filter(([, v]) => has(v));
  if (!shown.length) return <p className="muted pd-none">Nothing recorded yet.</p>;
  return (
    <dl className="pd-list">
      {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

// Fields that make a profile useful for invoicing / payments, per country & scope
const KEY_FIELDS = p => {
  if (p.country === 'Japan') {
    const corp = p.category && p.category !== 'Individual';
    const trader = ['Dealer', 'Auction House', 'Company', 'Agent'].includes(p.category);
    return [
      ['phone', 'Phone'], ['postal_code', '〒 Postal code'], ['prefecture', 'Prefecture'], ['city', 'City'], ['address', 'Street'],
      corp ? ['corporate_number', '法人番号'] : ['id_no', 'ID number'], ['invoice_reg_no', 'Invoice reg. no'],
      ...(trader ? [['antique_license', '古物商 licence']] : []),
      ['bank_name', 'Bank'], ['bank_branch_code', 'Branch code'], ['account_no', 'Account no'],
    ];
  }
  return [
    ['phone', 'Phone'], ['email', 'Email'], ['id_no', 'ID number'], ['address', 'Address'], ['city', 'City'],
    ...(p.scope === 'International' ? [['country', 'Country'], ['swift', 'SWIFT']] : [['ntn', 'NTN']]),
    ['bank_name', 'Bank'], ['account_no', 'Account no'],
  ];
};

// 〒100-0001 Tokyo, Chiyoda-ku, Chiyoda 1-1-1, Auto Bldg 5F
const jpAddress = p => [p.postal_code && `〒${p.postal_code}`, p.prefecture, p.city, p.address, p.building].filter(Boolean).join(', ');

export default function PartyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data, error, loading } = useAsync(() => api.party(id), [id]);
  const [tab, setTab] = useState(null);

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  const { party: p, purchases, sales, totals } = data;
  const intl = p.scope === 'International';
  const jp = p.country === 'Japan';
  const isBuyer = p.role !== 'Seller', isSeller = p.role !== 'Buyer';
  const canEdit = can('vehicles:write') || can('sales:write');
  const active = tab || (isBuyer && sales.length ? 'sales' : isSeller ? 'purchases' : 'sales');

  const remove = async () => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try { await api.deleteParty(id); toast('Party deleted'); nav('/parties'); } catch (e) { toast(e.message, 'error'); }
  };
  const open = v => nav(`/vehicles/${v.id}`);

  // Seller-side outcomes: how vehicles bought from them performed
  const soldOn = purchases.filter(v => v.status === 'Sold');
  const sellerProfit = soldOn.reduce((a, v) => a + (v.profit || 0), 0);
  const sellerRevenue = soldOn.reduce((a, v) => a + (v.sale_price || 0), 0);
  const inStock = purchases.filter(v => v.status !== 'Sold');
  const over = p.credit_limit && totals.sales.receivable > p.credit_limit;

  // Activity by month: purchases from them vs sales to them
  const monthMap = new Map();
  purchases.forEach(v => { const m = v.purchase_date?.slice(0, 7); if (m) monthMap.set(m, { ...(monthMap.get(m) || { bought: 0, sold: 0 }), bought: (monthMap.get(m)?.bought || 0) + 1 }); });
  sales.forEach(v => { const m = v.sale_date?.slice(0, 7); if (m) monthMap.set(m, { ...(monthMap.get(m) || { bought: 0, sold: 0 }), sold: (monthMap.get(m)?.sold || 0) + 1 }); });
  const activity = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([m, c]) => ({ label: `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`, ...c }));
  const dealDates = [...purchases.map(v => v.purchase_date), ...sales.map(v => v.sale_date)].filter(Boolean).sort();

  const missing = KEY_FIELDS(p).filter(([f]) => !has(p[f]));
  const complete = Math.round(((KEY_FIELDS(p).length - missing.length) / KEY_FIELDS(p).length) * 100);

  return (
    <>
      <PageHeader title={<>{p.name} <RoleTag role={p.role} /> <ScopeTag scope={p.scope} /></>}
        subtitle={[p.code, p.category, intl ? p.country : p.city].filter(Boolean).join(' · ')}
        actions={<>
          <Button onClick={() => window.print()}>Print</Button>
          {canEdit && <Button variant="primary" to={`/parties/${id}/edit`}>Edit</Button>}
          {can('vehicles:write') && <Button variant="danger" onClick={remove}>Delete</Button>}
        </>} />

      {p.active === 0 && <div className="error-box" style={{ marginBottom: 14 }}>This party is inactive and hidden from the buyer / seller pickers.</div>}

      <div className="vd-layout">
        {/* ---------- Main ---------- */}
        <div className="vd-main">
          <div className="kpi-grid">
            {isSeller && <StatCard icon="buy" accent="blue" label="Bought From Them" value={totals.purchases.count}
              hint={`Total cost ${money(totals.purchases.value)}`} />}
            {isSeller && <StatCard icon="profit" accent="green" label="Profit on Their Vehicles" value={money(sellerProfit)} tone="auto" raw={sellerProfit}
              hint={soldOn.length ? `${soldOn.length} resold · ${pct(margin(sellerProfit, sellerRevenue))} margin` : 'None resold yet'} />}
            {isSeller && <StatCard icon="inventory" accent="violet" label="Still in Stock" value={inStock.length}
              hint={inStock.length ? `${money(inStock.reduce((a, v) => a + (v.total_cost || 0), 0))} at cost` : 'All resold'} />}
            {isBuyer && <StatCard icon="sell" accent="violet" label="Sold To Them" value={totals.sales.count}
              hint={`Sales ${money(totals.sales.value)}`} />}
            {isBuyer && <StatCard icon="profit" accent="green" label="Profit From Them" value={money(totals.sales.profit)} tone="auto" raw={totals.sales.profit}
              hint={`${pct(margin(totals.sales.profit, totals.sales.value))} margin`} />}
            {isBuyer && <StatCard icon="cash" accent="amber" label="Balance Due" value={money(totals.sales.receivable)}
              tone={totals.sales.receivable > 0 ? 'neg' : undefined}
              hint={p.credit_limit ? `Limit ${money(p.credit_limit)}${over ? ' · OVER LIMIT' : ''}` : `Received ${compact(totals.sales.received)}`} />}
          </div>

          {activity.length > 0 && (
            <div className="panel">
              <div className="row spread panel-head"><h2>Activity</h2>
                <span className="muted">{dealDates.length} deal{dealDates.length === 1 ? '' : 's'} · since {formatDate(dealDates[0])}</span></div>
              <BarChart data={activity} height={180} format={v => `${v} vehicle${v === 1 ? '' : 's'}`} tickFormat={v => v}
                series={[...(isSeller ? [{ key: 'bought', label: 'Bought from them' }] : []), ...(isBuyer ? [{ key: 'sold', label: 'Sold to them' }] : [])]} />
            </div>
          )}

          <div className="panel grid-panel">
            <Tabs value={active} onChange={setTab} tabs={[
              ...(isBuyer ? [{ id: 'sales', label: `Sold to Them (${sales.length})` }] : []),
              ...(isSeller ? [{ id: 'purchases', label: `Bought from Them (${purchases.length})` }] : []),
            ]} />
            {active === 'sales' && (sales.length ? (
              <DataTable rows={sales} exportName={`sales-${p.code}`} onRowClick={open} pageSize={20} columns={[
                ...vehicleColumns('photo', 'stock_no', 'vehicle', 'sale_date', 'sale_type', 'destination'),
                { key: 'invoice_no', label: 'Invoice', render: v => (v.invoice_no ? <Link to={`/vehicles/${v.id}/invoice`} onClick={e => e.stopPropagation()}>{v.invoice_no}</Link> : '-') },
                ...vehicleColumns('sale_price'),
                { key: 'amount_received', label: 'Received', align: 'right', format: money, total: 'sum' },
                { key: 'due', label: 'Balance', align: 'right', value: v => (v.sale_price || 0) - (v.amount_received || 0), total: 'sum',
                  format: n => (n > 0 ? <b className="neg">{money(n)}</b> : <span className="paid-tag">Paid</span>) },
              ]} />
            ) : <EmptyState>No sales to {p.name} yet.</EmptyState>)}
            {active === 'purchases' && (purchases.length ? (
              <DataTable rows={purchases} exportName={`purchases-${p.code}`} onRowClick={open} pageSize={20}
                columns={vehicleColumns('photo', 'stock_no', 'vehicle', 'purchase_date', 'grade', 'status', 'purchase_price', 'total_cost', 'sale_price', 'profit')} />
            ) : <EmptyState>No purchases from {p.name} yet.</EmptyState>)}
          </div>
        </div>

        {/* ---------- Side ---------- */}
        <aside className="vd-side">
          <div className="panel pd-profile">
            <span className={`pd-avatar ${intl ? 'intl' : ''}`}>{p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            <h2>{p.name}</h2>
            {p.name_kana && <div className="muted pd-kana">{p.name_kana}</div>}
            {p.company_name && p.company_name !== p.name && <div className="muted">{p.company_name}</div>}
            <div className="pd-loc"><NavIcon name="company" size={14} />
              {(jp ? [p.city, p.prefecture, p.country] : [p.city, p.state, p.country]).filter(Boolean).join(', ') || 'Location not set'}</div>
            <div className="pd-actions">
              <a className={`btn ${p.phone ? '' : 'disabled'}`} href={p.phone ? `tel:${digits(p.phone)}` : undefined}>Call</a>
              <a className={`btn ${p.whatsapp || p.phone ? '' : 'disabled'}`} target="_blank" rel="noreferrer"
                href={p.whatsapp || p.phone ? `https://wa.me/${digits(p.whatsapp || p.phone).replace('+', '')}` : undefined}>WhatsApp</a>
              <a className={`btn ${p.email ? '' : 'disabled'}`} href={p.email ? `mailto:${p.email}` : undefined}>Email</a>
            </div>
          </div>

          {missing.length > 0 && (
            <div className="panel pd-complete">
              <div className="row spread"><b>Profile {complete}% complete</b>{canEdit && <Link to={`/parties/${id}/edit`}>Complete →</Link>}</div>
              <div className="progress wide"><span style={{ width: `${complete}%` }} /></div>
              <small className="muted">Missing: {missing.map(([, l]) => l).join(', ')}</small>
            </div>
          )}

          <div className="panel">
            <h2 className="vd-side-h">Contact</h2>
            <Details items={[
              ['Contact person', p.contact_person && <>{p.contact_person}{p.designation ? <small> · {p.designation}</small> : null}</>],
              ['Phone', p.phone && <a href={`tel:${digits(p.phone)}`}>{p.phone}</a>],
              ['Alt. phone', p.alt_phone && <a href={`tel:${digits(p.alt_phone)}`}>{p.alt_phone}</a>],
              ['WhatsApp', p.whatsapp],
              ['Email', p.email && <a href={`mailto:${p.email}`}>{p.email}</a>],
              ['Website', p.website],
            ]} />
          </div>

          {jp ? <>
            <div className="panel">
              <h2 className="vd-side-h">Registration 登録情報</h2>
              <Details items={[
                ['法人番号', p.corporate_number], ['Invoice reg.', p.invoice_reg_no],
                ['古物商 licence', p.antique_license && <>{p.antique_license}{p.antique_license_authority ? <small> · {p.antique_license_authority}</small> : null}</>],
                ['Auction member', p.auction_member_no], [p.id_type || 'ID', p.id_no],
              ]} />
            </div>
            <div className="panel">
              <h2 className="vd-side-h">Address 住所</h2>
              <Details items={[
                ['Address', jpAddress(p) || null], ['Country', intl ? p.country : null], ['Nearest port', p.port],
              ]} />
            </div>
            <div className="panel">
              <h2 className="vd-side-h">Bank 振込先</h2>
              <Details items={[
                ['Bank', p.bank_name && <>{p.bank_name}{p.bank_branch ? <small> · {p.bank_branch}{p.bank_branch_code ? ` (${p.bank_branch_code})` : ''}</small> : null}</>],
                ['Account', p.account_no && `${JP_ACCOUNT_LABEL[p.account_type] || ''} ${p.account_no}`.trim()],
                ['Holder 名義', p.account_title], ['SWIFT / BIC', p.swift],
                ['Currency', p.currency], ['Credit limit', p.credit_limit ? money(p.credit_limit) : null],
              ]} />
            </div>
          </> : <>
            <div className="panel">
              <h2 className="vd-side-h">Identity & Address</h2>
              <Details items={[
                [p.id_type || 'ID', p.id_no], [intl ? 'Tax / VAT' : 'NTN', p.ntn], ['STRN', p.strn],
                ['Address', p.address && <span style={{ whiteSpace: 'pre-line' }}>{p.address}</span>],
                ['City', p.city], [intl ? 'State / Province' : 'Province', p.state], ['Postal code', p.postal_code], ['Country', p.country],
                ['Default port', p.port],
              ]} />
            </div>
            <div className="panel">
              <h2 className="vd-side-h">Banking</h2>
              <Details items={[
                ['Currency', p.currency], ['Credit limit', p.credit_limit ? money(p.credit_limit) : null],
                ['Bank', p.bank_name], ['Account title', p.account_title], ['Account no', p.account_no], ['IBAN', p.iban], ['SWIFT / BIC', p.swift],
              ]} />
            </div>
          </>}

          {p.notes && <div className="panel"><h2 className="vd-side-h">Notes</h2><p className="vd-notes">{p.notes}</p></div>}

          <p className="muted" style={{ fontSize: 12, margin: '0 4px' }}>
            Added {formatDate(p.created_at?.slice(0, 10))}{p.updated_at ? ` · updated ${formatDate(p.updated_at.slice(0, 10))}` : ''}
            {dealDates.length ? ` · last deal ${formatDate(dealDates[dealDates.length - 1])}` : ''}
          </p>
        </aside>
      </div>
    </>
  );
}
