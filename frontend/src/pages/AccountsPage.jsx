import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAsync } from '../hooks';
import { money, compact } from '../format';
import { formatDate } from '../dates';
import { PageHeader, Panel, StatCard, DataTable, BarList, Button, Badge, Loader, ErrorBox, EmptyState, useToast } from '../components';
import TxnModal from '../components/TxnModal';
import NavIcon from '../components/NavIcon';
import { t } from '../i18n';

// Kind badge + signed amount, shared by the Accounts pages
export const KIND_CLASS = { 'Cash In': 'b-InStock', 'Cash Out': 'b-Sold', Expense: 'b-Reserved', 'Card Payment': 'b-InTransit', 'Vehicle Sale': 'b-InStock', 'Vehicle Purchase': 'b-Sold' };
export const KindBadge = ({ kind }) => <Badge className={KIND_CLASS[kind] || ''}>{t(kind)}</Badge>;

// Edit / delete buttons for an entry row (vehicle-generated ledger lines have no actions)
export function useTxnActions(reload) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const remove = async txn => {
    if (!confirm(`Delete this ${txn.kind.toLowerCase()} of ${money(txn.amount)}?`)) return;
    try { await api.deleteTransaction(txn.id); toast('Entry deleted'); reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const column = {
    key: 'actions', label: '', filter: false, value: () => '',
    render: r => (r.source && r.source !== 'txn') ? null : (
      <span className="row-actions no-print" onClick={e => e.stopPropagation()}>
        <button type="button" className="icon-btn" title={t('Edit')} aria-label={t('Edit')} onClick={() => setEditing(r)}>
          <NavIcon name="edit" size={15} />
        </button>
        <button type="button" className="icon-btn danger" title={t('Delete')} aria-label={t('Delete')} onClick={() => remove(r)}>
          <NavIcon name="trash" size={15} />
        </button>
      </span>
    ),
  };
  return { column, editing, setEditing };
}

const ACTIONS = [
  ['Expense', '+ Expense', 'primary'], ['Cash In', '+ Cash In'], ['Cash Out', '− Cash Out'], ['Card Payment', 'Pay Credit Card'],
];

export default function AccountsPage() {
  const nav = useNavigate();
  const { data, error, loading, reload } = useAsync(() => api.accountsSummary());
  const [adding, setAdding] = useState(null);
  const { column, editing, setEditing } = useTxnActions(reload);
  const done = () => { setAdding(null); setEditing(null); reload(); };

  const header = (
    <PageHeader title="Cash & Balances" subtitle="Cash in hand, credit card balance and this month's expenses"
      actions={ACTIONS.map(([kind, label, variant]) => <Button key={kind} variant={variant} onClick={() => setAdding(kind)}>{label}</Button>)} />
  );
  if (loading && !data) return <>{header}<Loader /></>;
  if (error) return <>{header}<ErrorBox error={error} /></>;

  const e = data.expenses;
  const byAcc = Object.fromEntries(e.byAccount.map(a => [a.label, a.amount]));
  const month = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <>
      {header}
      <div className="kpi-grid">
        <StatCard icon="wallet" accent="green" label="Cash in Hand" value={money(data.cash)} tone="auto" raw={data.cash}
          hint={`Without vehicle trading: ${money(data.cashOnly)}`} />
        <StatCard icon="card" accent="violet" label="Credit Card Balance" value={money(data.card)} tone={data.card > 0 ? 'neg' : undefined}
          hint={data.card > 0 ? 'Owed on the card' : 'Nothing owed'} />
        <StatCard icon="receipt" accent="amber" label={`Expenses · ${month}`} value={money(e.total)}
          hint={`Cash ${compact(byAcc.Cash || 0)} · Card ${compact(byAcc['Credit Card'] || 0)}`} />
        <StatCard icon="ledger" accent="blue" label="Top Category" value={e.byCategory[0]?.label || '-'}
          hint={e.byCategory[0] ? `${money(e.byCategory[0].amount)} this month` : 'No expenses this month'} />
      </div>

      <div className="dash-grid">
        <Panel title="Expenses by Category" actions={<span className="muted">{month}</span>}>
          {e.byCategory.length
            ? <BarList items={e.byCategory.map(c => ({ label: t(c.label), value: c.amount, display: `${c.count} · ${compact(c.amount)}` }))} />
            : <EmptyState>No expenses recorded this month.</EmptyState>}
        </Panel>
        <Panel title="Where the Cash Balance Comes From">
          <dl className="acct-sum">
            <div><dt>{t('Cash entries and expenses')}</dt><dd>{money(data.cashOnly)}</dd></div>
            <div><dt>{t('Vehicle sales (cash) less purchases')}</dt><dd>{money(data.cash - data.cashOnly)}</dd></div>
            <div className="total"><dt>{t('Cash in Hand')}</dt><dd>{money(data.cash)}</dd></div>
          </dl>
          <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>
            {t('Vehicle sales count only when paid in Cash; purchases count at landed cost. Record an opening balance with + Cash In.')}
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <Button onClick={() => nav('/accounts/ledger')}>{t('Open Cash Ledger')}</Button>
            <Button onClick={() => nav('/accounts/expenses')}>{t('All Expenses')}</Button>
          </div>
        </Panel>
      </div>

      <Panel title="Recent Entries">
        <DataTable rows={data.recent} emptyText="No entries yet — add an expense or cash entry above." columns={[
          { key: 'txn_date', label: 'Date', format: formatDate },
          { key: 'kind', label: 'Type', render: r => <KindBadge kind={r.kind} />, value: r => r.kind },
          { key: 'account', label: 'Account' },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount', align: 'right', format: money },
          column,
        ]} />
      </Panel>

      {(adding || editing) && <TxnModal kind={adding} txn={editing} categories={data.categories}
        onClose={() => { setAdding(null); setEditing(null); }} onSaved={done} />}
    </>
  );
}
