import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { useAuth } from '../auth';
import { money } from '../format';
import { formatDate } from '../dates';
import { PageHeader, DataTable, Button, Badge, Loader, ErrorBox, StatCard } from '../components';

export const RoleTag = ({ role }) => <Badge className={`b-party-${role.toLowerCase()}`}>{role}</Badge>;
export const ScopeTag = ({ scope }) => <Badge className={scope === 'International' ? 'b-export' : 'b-local'}>{scope}</Badge>;

const TABS = [['', 'All'], ['Buyer', 'Buyers'], ['Seller', 'Sellers']];

export default function PartiesPage() {
  const nav = useNavigate();
  const { can } = useAuth();
  const { data, error, loading } = useAsync(() => api.parties());
  const [role, setRole] = useState('');
  const [scope, setScope] = useState('');

  const all = data || [];
  const inRole = (p, r) => !r || p.role === r || p.role === 'Both';
  const rows = useMemo(() => all.filter(p => inRole(p, role) && (!scope || p.scope === scope)), [data, role, scope]);

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  const receivable = all.reduce((a, p) => a + (p.receivable || 0), 0);
  const owing = all.filter(p => p.receivable > 0).length;

  return (
    <>
      <PageHeader title="Parties" subtitle="Buyers and sellers — local and international"
        actions={(can('vehicles:write') || can('sales:write')) && <Button variant="primary" to="/parties/new">+ Add Party</Button>} />

      <div className="kpi-grid">
        <StatCard icon="users" accent="blue" label="Buyers" value={all.filter(p => inRole(p, 'Buyer')).length}
          hint={`${all.filter(p => inRole(p, 'Buyer') && p.scope === 'International').length} international`} />
        <StatCard icon="company" accent="violet" label="Sellers" value={all.filter(p => inRole(p, 'Seller')).length}
          hint={`${all.filter(p => inRole(p, 'Seller') && p.scope === 'International').length} international`} />
        <StatCard icon="inout" accent="green" label="International" value={all.filter(p => p.scope === 'International').length}
          hint={`${new Set(all.filter(p => p.scope === 'International').map(p => p.country).filter(Boolean)).size} countries`} />
        <StatCard icon="cash" accent="amber" label="Owed by Buyers" value={money(receivable)} hint={`${owing} buyer${owing === 1 ? '' : 's'} with balance due`} />
      </div>

      <div className="report-bar">
        <div className="status-tabs" role="tablist">
          {TABS.map(([val, label]) => (
            <button key={label} type="button" role="tab" aria-selected={role === val} className={`status-tab ${role === val ? 'on' : ''}`} onClick={() => setRole(val)}>
              {label}<span>{all.filter(p => inRole(p, val)).length}</span>
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" style={{ marginBottom: 6 }}>
          {[['', 'All'], ['Local', 'Local'], ['International', 'International']].map(([val, label]) => (
            <button key={label} type="button" role="radio" aria-checked={scope === val} className={scope === val ? 'on' : ''} onClick={() => setScope(val)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="panel grid-panel">
        <DataTable rows={rows} exportName="parties" onRowClick={p => nav(`/parties/${p.id}`)} filterable groupable pageSize={20}
          emptyText="No parties match. Click “+ Add Party” to create one." columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name', render: p => (
              <div className="user-cell">
                <span className={`avatar ${p.scope === 'International' ? 'avatar-intl' : ''}`}>{p.name.slice(0, 1).toUpperCase()}</span>
                <div><b>{p.name}</b>{p.active === 0 && <span className="you-tag inactive">Inactive</span>}<small>{p.company_name || p.contact_person || p.email || ''}</small></div>
              </div>
            ) },
            { key: 'role', label: 'Type', groupable: true, render: p => <RoleTag role={p.role} /> },
            { key: 'scope', label: 'Location', groupable: true, render: p => <ScopeTag scope={p.scope} /> },
            { key: 'category', label: 'Category', groupable: true },
            { key: 'country', label: 'Country', groupable: true },
            { key: 'city', label: 'City' },
            { key: 'phone', label: 'Phone' },
            { key: 'bought_count', label: 'Bought From', align: 'right', total: 'sum' },
            { key: 'sold_count', label: 'Sold To', align: 'right', total: 'sum' },
            { key: 'trade', label: 'Total Business', align: 'right', value: p => (p.bought_value || 0) + (p.sold_value || 0), format: money, total: 'sum' },
            { key: 'receivable', label: 'Balance Due', align: 'right', total: 'sum',
              format: n => (n > 0 ? <b className="neg">{money(n)}</b> : <span className="muted">—</span>) },
            { key: 'last_deal', label: 'Last Deal', render: p => (p.last_deal ? formatDate(p.last_deal) : <span className="muted">—</span>), value: p => p.last_deal },
          ]} />
      </div>
    </>
  );
}
