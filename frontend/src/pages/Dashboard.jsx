import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useAsync } from '../hooks';
import { money, pct, margin, compact, vehicleTitle, daysInStock } from '../format';
import { MONTHS, formatDate, todayIso } from '../dates';
import {
  PageHeader, Panel, StatCard, BarList, Button, Loader, ErrorBox, EmptyState,
  StatusBadge, SaleTypeBadge, Thumb,
} from '../components';
import BarChart, { SplitBar } from '../components/BarChart';

const monthLabel = m => MONTHS[Number(m.slice(5, 7)) - 1];

export default function Dashboard() {
  const nav = useNavigate();
  const { can } = useAuth();
  const { data, error, loading } = useAsync(() => api.report('dashboard'));
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  const status = Object.fromEntries(data.byStatus.map(s => [s.status, s.count]));
  const months = data.months.map(m => ({ ...m, label: monthLabel(m.month), fullLabel: `${monthLabel(m.month)} ${m.month.slice(0, 4)}` }));
  const mix = ['Local', 'Export'].map(t => data.bySaleType.find(s => s.sale_type === t) || { sale_type: t, count: 0, revenue: 0, profit: 0 });
  const open = v => nav(`/vehicles/${v.id}`);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Business overview · ${formatDate(todayIso())}`}
        actions={<>{can('sales:write') && <Button to="/sales/new">Sell Vehicle</Button>}{can('vehicles:write') && <Button variant="primary" to="/vehicles/new">+ Buying</Button>}</>} />

      {/* Headline KPIs */}
      <div className="kpi-grid">
        <StatCard icon="inventory" accent="blue" label="Available Stock" value={data.stock.count}
          hint={`Stock value ${money(data.stock.cost)}`} />
        <StatCard icon="sell" accent="violet" label="Vehicles Sold" value={data.sold.count}
          hint={`Revenue ${money(data.sold.revenue)}`} />
        <StatCard icon="profit" accent="green" label="Net Profit" value={money(data.sold.profit)} tone="auto" raw={data.sold.profit}
          hint={`Margin ${pct(margin(data.sold.profit, data.sold.revenue))}`} />
        <StatCard icon="cash" accent="amber" label="Pending Payments" value={money(data.receivables.amount)}
          hint={`${data.receivables.count} invoice${data.receivables.count === 1 ? '' : 's'} with balance due`} />
      </div>

      {/* Secondary counts */}
      <div className="chip-row">
        {[['In Stock', status['In Stock'] || 0, 'In Stock'], ['In Transit', status['In Transit'] || 0, 'In Transit'], ['Reserved', status['Reserved'] || 0, 'Reserved']].map(([label, n, s]) => (
          <Link key={label} className="chip" to={`/inventory`} title={`View inventory`}>
            <StatusBadge status={s} /><b>{n}</b>
          </Link>
        ))}
        <span className="chip"><span className="muted">IN this month</span><b>{data.thisMonth.in}</b></span>
        <span className="chip"><span className="muted">OUT this month</span><b>{data.thisMonth.out}</b></span>
        <span className="chip"><span className="muted">Profit this month</span><b className={data.thisMonth.profit < 0 ? 'neg' : 'pos'}>{money(data.thisMonth.profit)}</b></span>
      </div>

      <div className="dash-grid">
        <Panel title="Vehicles IN vs OUT" actions={<span className="muted">Last 6 months</span>}>
          <BarChart data={months} series={[{ key: 'in', label: 'IN (bought)' }, { key: 'out', label: 'OUT (sold)' }]} format={v => `${v} vehicle${v === 1 ? '' : 's'}`} tickFormat={v => v} />
        </Panel>
        <Panel title="Monthly Profit" actions={<span className="muted">Last 6 months</span>}>
          <BarChart data={months} series={[{ key: 'profit', label: 'Profit' }]} format={money} tickFormat={compact} />
        </Panel>
      </div>

      <div className="dash-grid dash-grid-3">
        <Panel title="Sales Mix">
          <SplitBar items={mix.map(s => ({ label: s.sale_type, value: s.count, display: `${s.count} sold · ${money(s.profit)} profit` }))} />
          <table className="mini-table">
            <thead><tr><th>Type</th><th className="num">Revenue</th><th className="num">Margin</th></tr></thead>
            <tbody>{mix.map(s => (
              <tr key={s.sale_type}><td><SaleTypeBadge type={s.sale_type} /></td><td className="num">{money(s.revenue)}</td><td className="num">{pct(margin(s.profit, s.revenue))}</td></tr>
            ))}</tbody>
          </table>
        </Panel>
        <Panel title="Stock by Make" actions={<Link to="/reports/available">View all</Link>}>
          <BarList items={data.stockByMake.map(m => ({ label: m.label || 'Other', value: m.count, display: `${m.count} · ${compact(m.value)}` }))} empty="No vehicles in stock" />
        </Panel>
        <Panel title="Aging Stock" actions={<span className="muted">Oldest unsold</span>}>
          {data.aging.length ? (
            <ul className="mini-list">
              {data.aging.map(v => {
                const days = daysInStock(v);
                return (
                  <li key={v.id} onClick={() => open(v)}>
                    <div><b>{v.stock_no}</b> · {vehicleTitle(v)}<small>{money(v.total_cost)}</small></div>
                    <span className={`age ${days > 60 ? 'age-old' : days > 30 ? 'age-mid' : ''}`}>{days}d</span>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState>No stock</EmptyState>}
        </Panel>
      </div>

      <div className="dash-grid">
        <Panel title="Recent Sales" actions={<Link to="/reports/profit">Profit report</Link>}>
          {data.recentSales.length ? (
            <ul className="mini-list">
              {data.recentSales.map(v => (
                <li key={v.id} onClick={() => open(v)}>
                  <Thumb name={v.cover} />
                  <div><b>{vehicleTitle(v)}</b><small>{formatDate(v.sale_date)} · {v.buyer_name || '-'} · <SaleTypeBadge type={v.sale_type} /></small></div>
                  <div className="num"><b>{money(v.sale_price)}</b><small className={v.profit < 0 ? 'neg' : 'pos'}>{v.profit < 0 ? '' : '+'}{money(v.profit)}</small></div>
                </li>
              ))}
            </ul>
          ) : <EmptyState>No sales yet</EmptyState>}
        </Panel>
        <Panel title="Pending Payments" actions={<span className="muted">{money(data.receivables.amount)} due</span>}>
          {data.receivables.rows.length ? (
            <ul className="mini-list">
              {data.receivables.rows.map(v => {
                const due = v.sale_price - (v.amount_received || 0);
                return (
                  <li key={v.id} onClick={() => nav(`/vehicles/${v.id}/invoice`)}>
                    <div><b>{v.buyer_name}</b><small>{v.invoice_no} · {vehicleTitle(v)}</small></div>
                    <div className="num">
                      <b className="neg">{money(due)}</b>
                      <div className="progress" title={`${pct((v.amount_received || 0) / v.sale_price)} received`}>
                        <span style={{ width: `${((v.amount_received || 0) / v.sale_price) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState>All invoices are fully paid</EmptyState>}
        </Panel>
      </div>
    </>
  );
}
