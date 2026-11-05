import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money } from '../format';
import { formatDate } from '../dates';
import { PageHeader, StatCard, DataTable, DateRangeFilter, Button, Loader, ErrorBox } from '../components';
import TxnModal from '../components/TxnModal';
import { KindBadge, useTxnActions } from './AccountsPage';
import { t } from '../i18n';

const BOOKS = [
  { id: 'Cash', label: 'Cash Ledger', balance: 'Cash Balance', inLabel: 'Received', outLabel: 'Paid' },
  { id: 'Credit Card', label: 'Credit Card Ledger', balance: 'Card Balance (owed)', inLabel: 'Charged', outLabel: 'Paid off' },
  { id: 'Expenses', label: 'Expense Ledger', balance: 'Total Expenses', inLabel: 'Expense', outLabel: '' },
];
const signed = n => <span className={n < 0 ? 'neg' : ''}>{money(n)}</span>;

export default function LedgerPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const book = BOOKS.find(b => b.id === params.get('book')) || BOOKS[0];
  const [range, setRange] = useState({ from: '', to: '' });
  const [vehicles, setVehicles] = useState(true);
  const { data, error, loading, reload } = useAsync(
    () => api.ledger({ book: book.id, from: range.from, to: range.to, vehicles: book.id === 'Cash' && !vehicles ? '0' : '' }),
    [book.id, range.from, range.to, vehicles]);
  const [adding, setAdding] = useState(null);
  const { column, editing, setEditing } = useTxnActions(reload);
  const done = () => { setAdding(null); setEditing(null); reload(); };
  const exp = book.id === 'Expenses';
  const period = `${range.from ? formatDate(range.from) : 'From start'} → ${range.to ? formatDate(range.to) : 'today'}`;

  return (
    <>
      <PageHeader title={book.label} subtitle={period}
        actions={<>
          <Button onClick={() => window.print()}>Print</Button>
          <Button variant="primary" onClick={() => setAdding(book.id === 'Credit Card' ? 'Card Payment' : exp ? 'Expense' : 'Cash In')}>
            {book.id === 'Credit Card' ? 'Pay Credit Card' : exp ? '+ Expense' : '+ Cash In'}
          </Button>
        </>} />

      <div className="report-bar no-print">
        <div className="status-tabs" role="tablist">
          {BOOKS.map(b => (
            <button key={b.id} type="button" role="tab" aria-selected={b.id === book.id}
              className={`status-tab ${b.id === book.id ? 'on' : ''}`} onClick={() => setParams({ book: b.id })}>{t(b.label)}</button>
          ))}
        </div>
        <div className="row">
          {book.id === 'Cash' && (
            <label className="check-inline">
              <input type="checkbox" checked={vehicles} onChange={e => setVehicles(e.target.checked)} />
              {t('Include vehicle purchases & sales')}
            </label>
          )}
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {loading && !data ? <Loader /> : error ? <ErrorBox error={error} /> : <>
        <div className="kpi-grid">
          {!exp && <StatCard icon="ledger" accent="blue" label="Opening Balance" value={signed(data.opening)} hint={range.from ? `Before ${formatDate(range.from)}` : 'Start of records'} />}
          <StatCard icon={exp ? 'receipt' : 'wallet'} accent="green" label={t(book.inLabel)} value={money(data.totalIn)} hint={`${data.rows.filter(r => r.amount >= 0).length} entries`} />
          {!exp && <StatCard icon="cash" accent="amber" label={t(book.outLabel)} value={money(data.totalOut)} hint={`${data.rows.filter(r => r.amount < 0).length} entries`} />}
          <StatCard icon="profit" accent="violet" label={exp ? book.balance : `Closing ${book.balance}`} value={signed(exp ? data.totalIn : data.closing)}
            hint={range.to ? `On ${formatDate(range.to)}` : 'As of today'} />
        </div>

        <div className="panel grid-panel report-tab">
          <h2 className="print-only report-print-title">{t(book.label)}<small>{period} · {t('Opening')} {money(data.opening)} · {t('Closing')} {money(data.closing)}</small></h2>
          <DataTable rows={data.rows} exportName={`ledger-${book.id.toLowerCase().replace(/\s/g, '-')}`} filterable groupable pageSize={50}
            onPrint={() => window.print()} onRowClick={r => r.vehicle_id && nav(`/vehicles/${r.vehicle_id}`)}
            emptyText="No entries in this period." columns={[
              { key: 'date', label: 'Date', format: formatDate },
              { key: 'kind', label: 'Type', render: r => <KindBadge kind={r.kind} />, value: r => r.kind, groupable: true },
              ...(book.id === 'Cash' ? [] : [{ key: 'account', label: 'Paid by', groupable: exp }]),
              { key: 'category', label: 'Category', groupable: true },
              { key: 'description', label: 'Description' },
              { key: 'reference', label: 'Reference' },
              { key: 'in', label: t(book.inLabel), align: 'right', format: n => (n ? money(n) : ''), total: 'sum' },
              ...(exp ? [] : [{ key: 'out', label: t(book.outLabel), align: 'right', format: n => (n ? money(n) : ''), total: 'sum' }]),
              { key: 'balance', label: exp ? 'Running Total' : 'Balance', align: 'right', format: signed, filter: false },
              column,
            ]} />
        </div>
      </>}

      {(adding || editing) && <TxnModal kind={adding} txn={editing} onClose={() => { setAdding(null); setEditing(null); }} onSaved={done} />}
    </>
  );
}
