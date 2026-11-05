import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, pct, margin, compact, daysInStock, vehicleTitle } from '../format';
import { STATUSES } from '../constants';
import {
  PageHeader, Panel, StatCard, DataTable, BarList, Button, Loader, ErrorBox, EmptyState,
  vehicleColumns, agingBucket, AGING_BUCKETS,
} from '../components';
import BarChart from '../components/BarChart';

const AVAILABLE = STATUSES.filter(s => s !== 'Sold');
const TOP = 10;
const sum = (rows, f) => rows.reduce((a, r) => a + (f(r) || 0), 0);

export default function AvailableReport() {
  const nav = useNavigate();
  const { data, error, loading } = useAsync(() => api.report('available'));
  const [status, setStatus] = useState('');
  const [allMakes, setAllMakes] = useState(false);

  const all = data?.rows || [];
  const rows = useMemo(() => all.filter(v => !status || v.status === status), [data, status]);

  // Every figure below follows the status tab
  const stats = useMemo(() => {
    const cost = sum(rows, v => v.total_cost);
    const priced = rows.filter(v => v.asking_price);
    const ask = sum(priced, v => v.asking_price);
    const expected = ask - sum(priced, v => v.total_cost);
    const days = rows.map(daysInStock).filter(d => d != null);
    const groupBy = key => {
      const m = new Map();
      rows.forEach(v => {
        const k = v[key] || 'Unspecified';
        const g = m.get(k) || { label: k, count: 0, cost: 0, ask: 0, expected: 0 };
        g.count++; g.cost += v.total_cost || 0;
        if (v.asking_price) { g.ask += v.asking_price; g.expected += v.asking_price - (v.total_cost || 0); }
        m.set(k, g);
      });
      return [...m.values()].sort((a, b) => b.cost - a.cost);
    };
    return {
      cost, ask, expected, unpriced: rows.length - priced.length,
      avgDays: days.length ? Math.round(days.reduce((a, d) => a + d, 0) / days.length) : null,
      oldest: days.length ? Math.max(...days) : null,
      aging: AGING_BUCKETS.map(b => {
        const rs = rows.filter(v => agingBucket(daysInStock(v)) === b);
        return { label: b.replace(' days', ''), fullLabel: b, count: rs.length, value: sum(rs, v => v.total_cost) };
      }),
      byMake: groupBy('make'),
      byLocation: groupBy('location'),
    };
  }, [rows]);

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  // Top makes by stock value; the rest roll up into one "Other makes" bar
  const rest = stats.byMake.slice(TOP);
  const topMakes = allMakes || !rest.length ? stats.byMake : [...stats.byMake.slice(0, TOP), {
    label: `Other makes (${rest.length})`, count: rest.reduce((a, m) => a + m.count, 0), cost: rest.reduce((a, m) => a + m.cost, 0),
  }];
  const hasLocations = stats.byLocation.some(l => l.label !== 'Unspecified');
  const oldest = [...rows].filter(v => daysInStock(v) != null).sort((a, b) => daysInStock(b) - daysInStock(a)).slice(0, 25);

  const countOf = s => all.filter(v => v.status === s).length;
  const atRisk = stats.aging.slice(2).reduce((a, b) => a + b.value, 0);

  return (
    <>
      <PageHeader title="Available Vehicles Report" subtitle="Unsold stock: In Transit, In Stock and Reserved"
        actions={<Button onClick={() => window.print()}>Print</Button>} />

      <div className="status-tabs no-print" role="tablist">
        {[['', 'All Available', all.length], ...AVAILABLE.map(s => [s, s, countOf(s)])].map(([val, label, n]) => (
          <button key={label} type="button" role="tab" aria-selected={status === val}
            className={`status-tab ${status === val ? 'on' : ''}`} onClick={() => setStatus(val)}>
            {label}<span>{n}</span>
          </button>
        ))}
      </div>

      <div className="kpi-grid">
        <StatCard icon="inventory" accent="blue" label="Vehicles" value={rows.length}
          hint={AVAILABLE.map(s => `${s} ${rows.filter(v => v.status === s).length}`).join(' · ')} />
        <StatCard icon="cash" accent="violet" label="Stock Value (Cost)" value={money(stats.cost)}
          hint={rows.length ? `Avg ${money(stats.cost / rows.length)} per vehicle` : '-'} />
        <StatCard icon="profit" accent="green" label="Expected Profit" value={money(stats.expected)} tone="auto" raw={stats.expected}
          hint={`${pct(margin(stats.expected, stats.ask))} margin on asking ${money(stats.ask)}${stats.unpriced ? ` · ${stats.unpriced} unpriced` : ''}`} />
        <StatCard icon="clock" accent="amber" label="Avg Days in Stock" value={stats.avgDays ?? '-'}
          hint={stats.oldest != null ? `Oldest ${stats.oldest} days · ${money(atRisk)} over 60 days` : '-'} />
      </div>

      {rows.length === 0 ? <Panel><EmptyState>No vehicles in this status.</EmptyState></Panel> : <>
        <div className="dash-grid dash-grid-3">
          <Panel title="Stock Aging" actions={<span className="muted">Vehicles by days in stock</span>}>
            <BarChart data={stats.aging} series={[{ key: 'count', label: 'Vehicles' }]} height={200}
              format={v => `${v} vehicle${v === 1 ? '' : 's'}`} tickFormat={v => v} />
            <div className="aging-legend">
              {stats.aging.map((b, i) => (
                <div key={b.label} className={i >= 2 && b.count ? 'warn' : ''}><span>{b.fullLabel}</span><b>{compact(b.value)}</b></div>
              ))}
            </div>
          </Panel>
          <Panel title="Stock Value by Make" actions={stats.byMake.length > TOP && (
            <button type="button" className="link-btn" onClick={() => setAllMakes(a => !a)}>
              {allMakes ? `Top ${TOP}` : `Show all ${stats.byMake.length}`}
            </button>)}>
            <BarList items={topMakes.map(m => ({ label: m.label, value: m.cost, display: `${m.count} · ${compact(m.cost)}` }))} />
          </Panel>
          {hasLocations ? (
            <Panel title="By Location">
              <BarList items={stats.byLocation.map(m => ({ label: m.label, value: m.count, display: `${m.count} · ${compact(m.cost)}` }))} />
            </Panel>
          ) : (
            <Panel title="Oldest Stock" actions={<span className="muted">Longest unsold</span>}>
              <ul className="mini-list scroll-list">
                {oldest.map(v => (
                  <li key={v.id} onClick={() => nav(`/vehicles/${v.id}`)}>
                    <div><b>{vehicleTitle(v)}</b><small>{v.stock_no} · {money(v.total_cost)}</small></div>
                    <b className={daysInStock(v) > 90 ? 'neg' : ''}>{daysInStock(v)}d</b>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <Panel title="Summary by Make">
          <DataTable rows={stats.byMake} rowKey="label" exportName="available-by-make" columns={[
            { key: 'label', label: 'Make' },
            { key: 'count', label: 'Vehicles', align: 'right', total: 'sum' },
            { key: 'cost', label: 'Stock Value', align: 'right', format: money, total: 'sum' },
            { key: 'ask', label: 'Asking', align: 'right', format: money, total: 'sum' },
            { key: 'expected', label: 'Expected Profit', align: 'right', total: 'sum',
              format: n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span> },
            { key: 'share', label: 'Share of Stock', align: 'right', percent: true, value: r => (stats.cost ? r.cost / stats.cost : 0), format: pct },
          ]} />
        </Panel>

        <div className="panel grid-panel">
          <div className="row spread panel-head"><h2>Detailed List</h2></div>
          <DataTable rows={rows} exportName="available-vehicles" onRowClick={v => nav(`/vehicles/${v.id}`)}
            filterable groupable pageSize={20}
            columns={vehicleColumns('photo', 'stock_no', 'vehicle', 'make', 'chassis_no', 'color', 'mileage', 'grade', 'status',
              'location', 'purchase_date', 'age', 'aging_bucket', 'total_cost', 'asking_price', 'expected_profit')} />
        </div>
      </>}
    </>
  );
}
