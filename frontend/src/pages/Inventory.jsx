import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync } from '../hooks';
import { STATUSES, SALE_TYPES } from '../constants';
import { money, vehicleTitle } from '../format';
import { PageHeader, DataTable, Dropdown, Button, Loader, ErrorBox, vehicleColumns } from '../components';

const EMPTY = { q: '', status: '', make: '', sale_type: '' };

export default function Inventory() {
  const nav = useNavigate();
  const { can } = useAuth();
  const { data, error, loading } = useAsync(() => api.vehicles());
  const [params] = useSearchParams();
  const [f, setF] = useState({ ...EMPTY, q: params.get('q') || '' });
  // Header search navigates here with ?q=
  useEffect(() => { setF(x => ({ ...x, q: params.get('q') || '' })); }, [params]);

  const all = data || [];
  const makes = useMemo(() => [...new Set(all.map(v => v.make).filter(Boolean))].sort(), [data]);
  const count = (key, val) => all.filter(v => v[key] === val).length;

  const rows = useMemo(() => all.filter(v => {
    const q = f.q.toLowerCase();
    if (q && ![v.stock_no, v.chassis_no, vehicleTitle(v), v.lot_no, v.buyer_name, v.color].some(x => x?.toLowerCase().includes(q))) return false;
    if (f.status && v.status !== f.status) return false;
    if (f.make && v.make !== f.make) return false;
    if (f.sale_type && v.sale_type !== f.sale_type) return false;
    return true;
  }), [data, f]);

  const set = (k, val) => setF(x => ({ ...x, [k]: val }));
  const dirty = Object.entries(f).some(([k, v]) => v !== EMPTY[k]);
  const stockValue = rows.filter(v => v.status !== 'Sold').reduce((a, v) => a + (v.total_cost || 0), 0);

  return (
    <>
      <PageHeader title="Inventory" subtitle={`${all.length} vehicles · stock value ${money(all.filter(v => v.status !== 'Sold').reduce((a, v) => a + (v.total_cost || 0), 0))}`}
        actions={<>{can('sales:write') && <Button to="/sales/new">Sell Vehicle</Button>}{can('vehicles:write') && <Button variant="primary" to="/vehicles/new">+ Buying</Button>}</>} />

      {/* Status tabs with live counts */}
      <div className="status-tabs" role="tablist">
        {[['', 'All', all.length], ...STATUSES.map(s => [s, s, count('status', s)])].map(([val, label, n]) => (
          <button key={label} type="button" role="tab" aria-selected={f.status === val}
            className={`status-tab ${f.status === val ? 'on' : ''}`} onClick={() => set('status', val)}>
            {label}<span>{n}</span>
          </button>
        ))}
      </div>

      <div className="inv-filters">
        <label className="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input placeholder="Search stock #, chassis, make, model, buyer, lot…" value={f.q} onChange={e => set('q', e.target.value)} />
          {f.q && <button type="button" onClick={() => set('q', '')} aria-label="Clear search">×</button>}
        </label>
        <Dropdown value={f.make} onChange={v => set('make', v)} placeholder="All makes" sort="asc" sortable
          options={makes.map(m => ({ value: m, label: m, count: count('make', m) }))} />
        <Dropdown value={f.sale_type} onChange={v => set('sale_type', v)} placeholder="Local & Export" searchable={false}
          options={SALE_TYPES.map(s => ({ value: s, label: s, count: count('sale_type', s) }))} />
        {dirty && <Button onClick={() => setF(EMPTY)}>Reset filters</Button>}
        <span className="muted inv-summary">{rows.length} shown{stockValue ? ` · ${money(stockValue)} in stock` : ''}</span>
      </div>

      {loading ? <Loader /> : error ? <ErrorBox error={error} /> : (
        <div className="panel grid-panel">
          <DataTable rows={rows} exportName="inventory" onRowClick={v => nav(`/vehicles/${v.id}`)}
            filterable groupable pageSize={20}
            emptyText={dirty ? 'No vehicles match these filters.' : 'No vehicles yet. Click “+ Buying” to add one.'}
            columns={vehicleColumns('photo', 'stock_no', 'vehicle', 'make', 'year', 'chassis_no', 'color', 'mileage', 'grade', 'status',
              'purchase_date', 'purchase_source', 'total_cost', 'sale_type', 'sale_price', 'profit')} />
        </div>
      )}
    </>
  );
}
