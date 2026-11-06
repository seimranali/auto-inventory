import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { SALE_TYPES } from '../constants';
import { money, pct, margin, compact, vehicleTitle, daysInStock } from '../format';
import { MONTHS, formatDate } from '../dates';
import {
  PageHeader, Panel, StatCard, DataTable, DateRangeFilter, Tabs, BarList, Button, Loader, ErrorBox, EmptyState,
  SaleTypeBadge, vehicleColumns,
} from '../components';
import BarChart, { SplitBar } from '../components/BarChart';

const signed = n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span>;

// Columns for grouped profit summaries (by sale type / make / month)
const summaryColumns = label => [
  { key: 'label', label, value: r => r.label || 'Unspecified' },
  { key: 'count', label: 'Sold', align: 'right', total: 'sum' },
  { key: 'revenue', label: 'Revenue', align: 'right', format: money, total: 'sum' },
  { key: 'cost', label: 'Cost', align: 'right', format: money, total: 'sum' },
  { key: 'profit', label: 'Profit', align: 'right', format: signed, total: 'sum' },
  { key: 'avg', label: 'Avg / Vehicle', align: 'right', value: r => (r.count ? r.profit / r.count : 0), format: money },
  {
    key: 'margin', label: 'Margin', align: 'right', percent: true, value: r => margin(r.profit, r.revenue), format: pct,
    total: rows => pct(margin(rows.reduce((a, r) => a + r.profit, 0), rows.reduce((a, r) => a + r.revenue, 0))),
  },
];

const TABS = [
  { id: 'detailed', label: 'Vehicle-wise' }, { id: 'type', label: 'By Sale Type' },
  { id: 'make', label: 'By Make' }, { id: 'month', label: 'By Month' }, { id: 'expenses', label: 'Expenses' },
];

// A4 landscape while this report is open (the global @page is A4 portrait for invoices)
function useLandscapePrint() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 landscape; margin: 10mm; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

const monthName = m => (m ? `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}` : '-');

export default function ProfitReport() {
  const nav = useNavigate();
  const [filter, setFilter] = useState({ from: '', to: '', sale_type: '' });
  const [tab, setTab] = useState('detailed');
  useLandscapePrint();
  const print = () => window.print();
  const { data, error, loading } = useAsync(() => api.report('profit', filter), [filter.from, filter.to, filter.sale_type]);
  // Sale-type tab counts come from the unfiltered-by-type query so they stay stable
  const { data: allTypes } = useAsync(() => api.report('profit', { from: filter.from, to: filter.to }), [filter.from, filter.to]);

  const t = data?.totals;
  const rows = data?.rows || [];
  const ranked = [...rows].sort((a, b) => (b.profit || 0) - (a.profit || 0));
  const losses = ranked.filter(v => v.profit < 0);
  const sellDays = rows.map(daysInStock).filter(d => d != null);
  const avgDays = sellDays.length ? Math.round(sellDays.reduce((a, d) => a + d, 0) / sellDays.length) : null;
  const typeCount = s => allTypes?.bySaleType.find(x => x.label === s)?.count || 0;
  // Operating expenses (Accounts → Expenses) are deducted for net profit. They aren't tied to a sale type,
  // so they only apply to the All Sales view.
  const withExp = !filter.sale_type;
  const exp = withExp ? data?.expenses : null;
  const expTotal = exp?.total || 0;
  const net = t ? t.profit - expTotal : 0;
  const expByMonth = Object.fromEntries((exp?.byMonth || []).map(m => [m.label, m.amount]));
  const months = (data?.byMonth || []).map(m => ({ ...m, expenses: expByMonth[m.label] || 0, net: m.profit - (expByMonth[m.label] || 0) }));
  const best = months.reduce((b, m) => (!b || m.net > b.net ? m : b), null);
  // Under the Total of the vehicle / sale-type / make tables: expenses from the Expenses page, then net profit
  const expenseRows = withExp && t ? [
    { label: `Less: Operating expenses (${exp.byCategory.reduce((a, c) => a + c.count, 0)} entries, Expenses page)`, className: 'neg-row',
      values: { profit: <span className="neg">{money(-expTotal)}</span>, margin: pct(-margin(expTotal, t.revenue)) } },
    { label: 'Net profit after expenses', className: 'net-row',
      values: { profit: signed(net), margin: pct(margin(net, t.revenue)) } },
  ] : [];

  return (
    <>
      <PageHeader title="Profit & Margin Report"
        subtitle={`Sold vehicles · ${filter.from ? formatDate(filter.from) : 'from start'} → ${filter.to ? formatDate(filter.to) : 'today'}`}
        actions={<Button onClick={() => window.print()}>Print</Button>} />

      <div className="report-bar no-print">
        <div className="status-tabs" role="tablist">
          {[['', 'All Sales', allTypes?.totals.count ?? 0], ...SALE_TYPES.map(s => [s, s, typeCount(s)])].map(([val, label, n]) => (
            <button key={label} type="button" role="tab" aria-selected={filter.sale_type === val}
              className={`status-tab ${filter.sale_type === val ? 'on' : ''}`} onClick={() => setFilter({ ...filter, sale_type: val })}>
              {label}<span>{n}</span>
            </button>
          ))}
        </div>
        <DateRangeFilter value={filter} onChange={setFilter} />
      </div>

      {loading ? <Loader /> : error ? <ErrorBox error={error} /> : !t.count ? (
        <Panel><EmptyState>No sales in this period.</EmptyState></Panel>
      ) : <>
        <div className="kpi-grid">
          <StatCard icon="profit" accent="green" label="Net Profit" value={money(net)} tone="auto" raw={net}
            hint={withExp
              ? `Vehicle profit ${money(t.profit)} − expenses ${money(expTotal)}`
              : `${t.count} vehicles sold · avg ${money(t.profit / t.count)} each · expenses not split by sale type`} />
          <StatCard icon="available" accent="violet" label="Net Margin" value={pct(margin(net, t.revenue))}
            hint={withExp ? `Gross ${pct(margin(t.profit, t.revenue))} before expenses · revenue ${compact(t.revenue)}` : `On revenue of ${money(t.revenue)}`} />
          <StatCard icon="cash" accent="blue" label="Total Cost" value={money(t.cost + t.sale_expense)}
            hint={`${t.count} vehicles sold · avg ${compact((t.cost + t.sale_expense) / t.count)} each`} />
          <StatCard icon="clock" accent="amber" label="Avg Days to Sell" value={avgDays ?? '-'}
            hint={`${losses.length} sold at a loss${losses.length ? ` (${money(losses.reduce((a, v) => a + v.profit, 0))})` : ''}`} />
        </div>

        {/* Where the money went: revenue = cost + expenses + profit */}
        <Panel title="Revenue Breakdown" className="no-print">
          <SplitBar items={[
            { label: 'Vehicle cost', value: t.cost, display: money(t.cost) },
            ...(withExp ? [{ label: 'Operating expenses', value: expTotal, display: money(expTotal) }] : []),
            { label: 'Net profit', value: Math.max(0, net), display: money(net) },
          ]} />
          {withExp && <div className="muted" style={{ fontSize: 12 }}>
            Operating expenses: {money(expTotal)} ({pct(margin(expTotal, t.revenue))} of revenue)
          </div>}
        </Panel>

        <div className="dash-grid no-print">
          <Panel title="Profit by Month" actions={best && <span className="muted">Best: {monthName(best.label)} · {compact(best.net)}</span>}>
            <BarChart data={months.map(m => ({ ...m, label: monthName(m.label) }))}
              series={withExp && expTotal ? [{ key: 'profit', label: 'Vehicle profit' }, { key: 'net', label: 'Net after expenses' }] : [{ key: 'profit', label: 'Profit' }]}
              format={money} tickFormat={compact} />
          </Panel>
          <Panel title="Margin by Month">
            <BarChart data={months.map(m => ({ label: monthName(m.label), margin: Math.round(margin(m.net, m.revenue) * 1000) / 10 }))}
              series={[{ key: 'margin', label: 'Margin %' }]} format={v => `${v}%`} tickFormat={v => `${v}%`} />
          </Panel>
        </div>

        <div className="dash-grid dash-grid-3 no-print">
          <Panel title="Local vs Export">
            {data.bySaleType.length > 1 ? (
              <SplitBar items={['Local', 'Export'].map(s => data.bySaleType.find(x => x.label === s) || { label: s, profit: 0, count: 0 })
                .map(s => ({ label: s.label, value: Math.max(0, s.profit), display: `${money(s.profit)} · ${pct(margin(s.profit, s.revenue))}` }))} />
            ) : <div className="muted">Only {filter.sale_type || data.bySaleType[0]?.label} sales in this view.</div>}
            <table className="mini-table">
              <thead><tr><th>Type</th><th className="num">Sold</th><th className="num">Avg Profit</th></tr></thead>
              <tbody>{data.bySaleType.map(s => (
                <tr key={s.label}><td><SaleTypeBadge type={s.label} /></td><td className="num">{s.count}</td><td className="num">{money(s.profit / s.count)}</td></tr>
              ))}</tbody>
            </table>
          </Panel>
          <Panel title="Most Profitable">
            <ul className="mini-list">
              {ranked.slice(0, 5).map(v => (
                <li key={v.id} onClick={() => nav(`/vehicles/${v.id}`)}>
                  <div><b>{vehicleTitle(v)}</b><small>{v.stock_no} · {pct(margin(v.profit, v.sale_price))} margin</small></div>
                  <b className="pos">{money(v.profit)}</b>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={losses.length ? 'Loss-Making Sales' : 'Lowest Profit'}>
            <ul className="mini-list">
              {(losses.length ? [...losses].reverse() : ranked.slice(-5).reverse()).slice(0, 5).map(v => (
                <li key={v.id} onClick={() => nav(`/vehicles/${v.id}`)}>
                  <div><b>{vehicleTitle(v)}</b><small>{v.stock_no} · cost {compact(v.total_cost)} · sold {compact(v.sale_price)}</small></div>
                  <b className={v.profit < 0 ? 'neg' : ''}>{money(v.profit)}</b>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Profit by Make" className="no-print">
          <BarList items={data.byMake.map(m => ({ label: m.label || 'Unspecified', value: m.profit, display: `${money(m.profit)} · ${pct(margin(m.profit, m.revenue))}` }))} />
        </Panel>

        <div className="panel grid-panel report-tab">
          <div className="no-print"><Tabs value={tab} onChange={setTab} tabs={TABS} /></div>
          <h2 className="print-only report-print-title">
            Profit &amp; Margin — {TABS.find(x => x.id === tab).label}
            <small>{filter.sale_type || 'All Sales'} · {filter.from ? formatDate(filter.from) : 'from start'} → {filter.to ? formatDate(filter.to) : 'today'}</small>
          </h2>
          {tab === 'detailed' && (
            <DataTable rows={rows} exportName="profit-detailed" onPrint={print} footerRows={expenseRows} onRowClick={v => nav(`/vehicles/${v.id}`)} filterable groupable pageSize={20}
              columns={vehicleColumns('stock_no', 'vehicle', 'make', 'sale_type', 'sale_date', 'buyer_name', 'destination', 'days',
                'total_cost', 'sale_price', 'profit', 'margin')} />
          )}
          {tab === 'type' && <DataTable rows={data.bySaleType} rowKey="label" exportName="profit-by-sale-type" onPrint={print} footerRows={expenseRows} columns={summaryColumns('Sale Type')} />}
          {tab === 'make' && <DataTable rows={data.byMake} rowKey="label" exportName="profit-by-make" onPrint={print} footerRows={expenseRows} columns={summaryColumns('Make')} />}
          {tab === 'month' && <DataTable rows={months.map(m => ({ ...m, label: monthName(m.label) }))} rowKey="label" exportName="profit-by-month" onPrint={print}
            columns={withExp ? [...summaryColumns('Month').slice(0, 6),
              { key: 'expenses', label: 'Expenses', align: 'right', format: money, total: 'sum' },
              { key: 'net', label: 'Net Profit', align: 'right', format: signed, total: 'sum' },
              { key: 'margin', label: 'Net Margin', align: 'right', percent: true, value: r => margin(r.net, r.revenue), format: pct,
                total: rs => pct(margin(rs.reduce((a, r) => a + r.net, 0), rs.reduce((a, r) => a + r.revenue, 0))) },
            ] : summaryColumns('Month')} />}
          {tab === 'expenses' && (withExp ? (
            <DataTable rows={exp.byCategory} rowKey="label" exportName="profit-expenses" onPrint={print} columns={[
              { key: 'label', label: 'Expense Category' },
              { key: 'count', label: 'Entries', align: 'right', total: 'sum' },
              { key: 'amount', label: 'Amount', align: 'right', format: money, total: 'sum' },
              { key: 'share', label: 'Share of Revenue', align: 'right', percent: true, value: r => margin(r.amount, t.revenue), format: pct },
            ]} emptyText="No expenses recorded in this period." />
          ) : <EmptyState>Expenses are not split by sale type — choose All Sales to see them.</EmptyState>)}
        </div>
      </>}
    </>
  );
}
