import { useState } from 'react';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, compact } from '../format';
import { formatDate } from '../dates';
import { EXPENSE_ACCOUNTS } from '../constants';
import { PageHeader, Panel, StatCard, DataTable, DateRangeFilter, BarList, Button, Loader, ErrorBox } from '../components';
import TxnModal from '../components/TxnModal';
import { useTxnActions } from './AccountsPage';
import { t } from '../i18n';

const sum = rows => rows.reduce((a, r) => a + (r.amount || 0), 0);

export default function ExpensesPage() {
  const month = new Date().toISOString().slice(0, 7);
  const [filter, setFilter] = useState({ from: `${month}-01`, to: '', account: '' });
  const { data, error, loading, reload } = useAsync(() => api.transactions({ kind: 'Expense', from: filter.from, to: filter.to }), [filter.from, filter.to]);
  const [adding, setAdding] = useState(false);
  const { column, editing, setEditing } = useTxnActions(reload);
  const done = () => { setAdding(false); setEditing(null); reload(); };

  const all = data || [];
  const rows = filter.account ? all.filter(r => r.account === filter.account) : all;
  const byCat = Object.values(rows.reduce((m, r) => {
    const k = r.category || 'Other';
    (m[k] ||= { label: k, amount: 0, count: 0 }).amount += r.amount; m[k].count++;
    return m;
  }, {})).sort((a, b) => b.amount - a.amount);
  const days = filter.from ? Math.max(1, Math.round((new Date(filter.to || Date.now()) - new Date(filter.from)) / 864e5) + 1) : null;

  return (
    <>
      <PageHeader title="Expenses"
        subtitle={`${filter.from ? formatDate(filter.from) : 'From start'} → ${filter.to ? formatDate(filter.to) : 'today'} · deducted from Profit & Margin`}
        actions={<><Button onClick={() => window.print()}>Print</Button><Button variant="primary" onClick={() => setAdding(true)}>+ Expense</Button></>} />

      <div className="report-bar no-print">
        <div className="status-tabs" role="tablist">
          {[['', 'All', all.length], ...EXPENSE_ACCOUNTS.map(a => [a, a, all.filter(r => r.account === a).length])].map(([val, label, n]) => (
            <button key={label} type="button" role="tab" aria-selected={filter.account === val}
              className={`status-tab ${filter.account === val ? 'on' : ''}`} onClick={() => setFilter({ ...filter, account: val })}>
              {t(label)}<span>{n}</span>
            </button>
          ))}
        </div>
        <DateRangeFilter value={filter} onChange={setFilter} />
      </div>

      {loading && !data ? <Loader /> : error ? <ErrorBox error={error} /> : <>
        <div className="kpi-grid">
          <StatCard icon="receipt" accent="amber" label="Total Expenses" value={money(sum(rows))} hint={`${rows.length} entries`} />
          <StatCard icon="wallet" accent="green" label="Paid by Cash" value={money(sum(rows.filter(r => r.account === 'Cash')))} hint="Lowers cash in hand" />
          <StatCard icon="card" accent="violet" label="Paid by Credit Card" value={money(sum(rows.filter(r => r.account === 'Credit Card')))} hint="Added to the card balance" />
          <StatCard icon="clock" accent="blue" label="Average per Day" value={days ? money(sum(rows) / days) : '-'} hint={days ? `Over ${days} days` : 'Choose a date range'} />
        </div>

        {byCat.length > 0 && (
          <Panel title="By Category" className="no-print">
            <BarList items={byCat.map(c => ({ label: t(c.label), value: c.amount, display: `${c.count} · ${compact(c.amount)}` }))} />
          </Panel>
        )}

        <div className="panel grid-panel report-tab">
          <h2 className="print-only report-print-title">{t('Expenses')}
            <small>{filter.account || t('All')} · {filter.from ? formatDate(filter.from) : 'from start'} → {filter.to ? formatDate(filter.to) : 'today'}</small>
          </h2>
          <DataTable rows={rows} exportName="expenses" filterable groupable pageSize={20} onPrint={() => window.print()}
            emptyText="No expenses in this period." columns={[
              { key: 'txn_date', label: 'Date', format: formatDate },
              { key: 'category', label: 'Category', groupable: true },
              { key: 'description', label: 'Description' },
              { key: 'account', label: 'Paid by', groupable: true },
              { key: 'reference', label: 'Reference' },
              { key: 'stock_no', label: 'Vehicle' },
              { key: 'created_by_name', label: 'Entered by' },
              { key: 'amount', label: 'Amount', align: 'right', format: money, total: 'sum' },
              column,
            ]} />
        </div>
      </>}

      {(adding || editing) && <TxnModal kind="Expense" txn={editing} categories={[...new Set(all.map(r => r.category).filter(Boolean))]}
        onClose={() => { setAdding(false); setEditing(null); }} onSaved={done} />}
    </>
  );
}
