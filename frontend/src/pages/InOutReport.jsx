import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, compact, vehicleTitle } from '../format';
import { MONTHS, formatDate } from '../dates';
import {
  PageHeader, Panel, StatCard, DataTable, DateRangeFilter, Tabs, BarList, Button, Loader, ErrorBox, EmptyState,
  Badge, SaleTypeBadge, vehicleColumns,
} from '../components';
import BarChart, { SplitBar } from '../components/BarChart';

const monthName = m => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const signedCount = n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{n > 0 ? `+${n}` : n}</span>;

export default function InOutReport() {
  const nav = useNavigate();
  const [range, setRange] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('log');
  const { data, error, loading } = useAsync(() => api.report('inout', range), [range.from, range.to]);
  const open = v => nav(`/vehicles/${v.vehicle_id || v.id}`);

  // One chronological ledger of every IN (purchase) and OUT (sale) movement
  const log = useMemo(() => {
    if (!data) return [];
    const ins = data.inRows.map(v => ({
      id: `in-${v.id}`, vehicle_id: v.id, date: v.purchase_date, dir: 'IN', stock_no: v.stock_no, vehicle: vehicleTitle(v), make: v.make,
      channel: v.purchase_source || 'Unspecified', party: v.auction_house || v.supplier || '-', value: v.total_cost || 0,
    }));
    const outs = data.outRows.map(v => ({
      id: `out-${v.id}`, vehicle_id: v.id, date: v.sale_date, dir: 'OUT', stock_no: v.stock_no, vehicle: vehicleTitle(v), make: v.make,
      channel: v.sale_type || 'Unspecified', party: v.buyer_name || '-', value: v.sale_price || 0,
    }));
    return [...ins, ...outs].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.dir === 'IN' ? 1 : -1));
  }, [data]);

  const s = data?.summary;
  const net = s ? s.in.count - s.out.count : 0;
  const months = (data?.byMonth || []).map(m => ({ ...m, label: monthName(m.month), fullLabel: m.month }));
  const busiest = months.reduce((b, m) => (!b || m.in_count + m.out_count > b.in_count + b.out_count ? m : b), null);

  return (
    <>
      <PageHeader title="IN / OUT Vehicles Report"
        subtitle={`IN = bought · OUT = sold · ${range.from ? formatDate(range.from) : 'from start'} → ${range.to ? formatDate(range.to) : 'today'}`}
        actions={<Button onClick={() => window.print()}>Print</Button>} />
      <div className="report-bar no-print" style={{ justifyContent: 'flex-end' }}>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {loading ? <Loader /> : error ? <ErrorBox error={error} /> : !(s.in.count || s.out.count) ? (
        <Panel><EmptyState>No vehicle movements in this period.</EmptyState></Panel>
      ) : <>
        <div className="kpi-grid">
          <StatCard icon="buy" accent="blue" label="Vehicles IN" value={s.in.count}
            hint={`Bought for ${money(s.in.value)}${s.in.count ? ` · avg ${compact(s.in.value / s.in.count)}` : ''}`} />
          <StatCard icon="sell" accent="violet" label="Vehicles OUT" value={s.out.count}
            hint={`Sold for ${money(s.out.value)}${s.out.count ? ` · avg ${compact(s.out.value / s.out.count)}` : ''}`} />
          <StatCard icon="inout" accent={net >= 0 ? 'green' : 'amber'} label="Net Stock Change" value={signedCount(net)}
            hint={net > 0 ? 'Stock is growing' : net < 0 ? 'Stock is shrinking' : 'IN and OUT balanced'} />
          <StatCard icon="cash" accent="amber" label="Net Cash Flow" value={money(s.out.value - s.in.value)} tone="auto" raw={s.out.value - s.in.value}
            hint="Sales received minus purchases (incl. costs)" />
        </div>

        <div className="dash-grid">
          <Panel title="Vehicles IN vs OUT by Month" actions={busiest && <span className="muted">Busiest: {busiest.label}</span>}>
            <BarChart data={months} series={[{ key: 'in_count', label: 'IN (bought)' }, { key: 'out_count', label: 'OUT (sold)' }]}
              format={v => `${v} vehicle${v === 1 ? '' : 's'}`} tickFormat={v => v} />
          </Panel>
          <Panel title="Value IN vs OUT by Month">
            <BarChart data={months} series={[{ key: 'in_value', label: 'IN value (cost)' }, { key: 'out_value', label: 'OUT value (sales)' }]}
              format={money} tickFormat={compact} />
          </Panel>
        </div>

        <div className="dash-grid">
          <Panel title="IN by Purchase Source">
            <BarList items={s.inBySource.map(x => ({ label: x.label || 'Unspecified', value: x.count, display: `${x.count} · ${compact(x.value)}` }))} empty="No purchases" />
          </Panel>
          <Panel title="OUT by Sale Type">
            {s.outByType.length ? (
              <>
                <SplitBar items={['Local', 'Export'].map(t => s.outByType.find(x => x.label === t) || { label: t, count: 0, value: 0 })
                  .map(x => ({ label: x.label, value: x.count, display: `${x.count} sold · ${money(x.value)}` }))} />
              </>
            ) : <div className="muted">No sales</div>}
          </Panel>
        </div>

        <div className="panel grid-panel">
          <Tabs value={tab} onChange={setTab} tabs={[
            { id: 'log', label: `Movement Log (${log.length})` }, { id: 'monthly', label: 'Monthly Summary' },
            { id: 'in', label: `IN Detail (${s.in.count})` }, { id: 'out', label: `OUT Detail (${s.out.count})` },
          ]} />

          {tab === 'log' && (
            <DataTable rows={log} exportName="vehicle-movements" onRowClick={open} filterable groupable pageSize={20} columns={[
              { key: 'date', label: 'Date', render: r => formatDate(r.date), value: r => r.date },
              { key: 'dir', label: 'Movement', groupable: true,
                render: r => <Badge className={r.dir === 'IN' ? 'b-in' : 'b-out'}>{r.dir === 'IN' ? '↓ IN' : '↑ OUT'}</Badge> },
              { key: 'stock_no', label: 'Stock #' },
              { key: 'vehicle', label: 'Vehicle' },
              { key: 'make', label: 'Make', groupable: true },
              { key: 'channel', label: 'Source / Type', groupable: true,
                render: r => (r.dir === 'OUT' ? <SaleTypeBadge type={r.channel} /> : r.channel) },
              { key: 'party', label: 'Supplier / Buyer' },
              { key: 'month', label: 'Month', value: r => r.date?.slice(0, 7), groupable: true },
              { key: 'in_value', label: 'IN Value', align: 'right', value: r => (r.dir === 'IN' ? r.value : null), format: n => (n == null ? '' : money(n)), total: 'sum' },
              { key: 'out_value', label: 'OUT Value', align: 'right', value: r => (r.dir === 'OUT' ? r.value : null), format: n => (n == null ? '' : money(n)), total: 'sum' },
            ]} />
          )}

          {tab === 'monthly' && (
            <DataTable rows={months} rowKey="month" exportName="in-out-monthly" columns={[
              { key: 'label', label: 'Month', value: r => r.month, render: r => r.label },
              { key: 'in_count', label: 'IN', align: 'right', total: 'sum' },
              { key: 'in_value', label: 'IN Value (Cost)', align: 'right', format: money, total: 'sum' },
              { key: 'out_count', label: 'OUT', align: 'right', total: 'sum' },
              { key: 'out_value', label: 'OUT Value (Sales)', align: 'right', format: money, total: 'sum' },
              { key: 'net', label: 'Net Change', align: 'right', value: r => r.in_count - r.out_count, format: signedCount,
                total: rows => signedCount(rows.reduce((a, r) => a + r.in_count - r.out_count, 0)) },
              { key: 'cash', label: 'Net Cash Flow', align: 'right', value: r => r.out_value - r.in_value, total: 'sum',
                format: n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span> },
            ]} />
          )}

          {tab === 'in' && (
            <DataTable rows={data.inRows} exportName="vehicles-in" onRowClick={open} filterable groupable pageSize={20}
              columns={vehicleColumns('photo', 'stock_no', 'vehicle', 'make', 'chassis_no', 'grade', 'purchase_date', 'purchase_source',
                'supplier', 'status', 'purchase_price', 'total_cost')} />
          )}

          {tab === 'out' && (
            <DataTable rows={data.outRows} exportName="vehicles-out" onRowClick={open} filterable groupable pageSize={20}
              columns={vehicleColumns('photo', 'stock_no', 'vehicle', 'make', 'chassis_no', 'sale_date', 'sale_type', 'buyer_name',
                'destination', 'days', 'total_cost', 'sale_price', 'profit')} />
          )}
        </div>
      </>}
    </>
  );
}
