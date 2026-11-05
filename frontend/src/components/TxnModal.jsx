import { useState } from 'react';
import { api } from '../api';
import { useForm } from '../hooks';
import { today, vehicleTitle } from '../format';
import { EXPENSE_CATEGORIES, EXPENSE_ACCOUNTS } from '../constants';
import Modal from './Modal';
import Button from './Button';
import { Input, Select, DateField, TextArea, FormGrid } from './FormFields';
import { useToast } from './Toast';
import { t } from '../i18n';

// What each kind of entry does, shown under the form
const KIND_HELP = {
  'Cash In': 'Money added to cash in hand: opening balance, owner investment, deposits.',
  'Cash Out': 'Money taken out of cash in hand: bank deposit, owner withdrawal.',
  Expense: 'A business expense. Paid by cash lowers cash in hand; by credit card adds to the card balance.',
  'Card Payment': 'Paying the credit card bill from cash: lowers cash in hand and the card balance.',
};
const TITLES = { 'Cash In': 'Cash In', 'Cash Out': 'Cash Out', Expense: 'Expense', 'Card Payment': 'Credit Card Payment' };

const loadVehicles = q => api.vehicles({ q }).then(rows => rows.slice(0, 50).map(v => ({
  value: v.id, label: `${v.stock_no || '—'} · ${vehicleTitle(v)}`, description: v.status,
})));

/** Add or edit a cash / expense / card-payment entry. kind fixes the type for new entries; txn edits an existing one. */
export default function TxnModal({ kind, txn, categories = [], onClose, onSaved }) {
  const toast = useToast();
  const form = useForm(txn ? { ...txn } : { kind, txn_date: today(), account: 'Cash' });
  const [saving, setSaving] = useState(false);
  const v = form.values;
  const isExpense = v.kind === 'Expense';
  const cats = [...new Set([...EXPENSE_CATEGORIES, ...categories])];

  async function save(e) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    try {
      const saved = txn ? await api.updateTransaction(txn.id, v) : await api.createTransaction(v);
      toast(txn ? 'Entry updated' : `${t(TITLES[v.kind])} saved`);
      onSaved(saved);
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title={`${txn ? 'Edit' : 'New'} ${TITLES[v.kind]}`} width={640} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="txn-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <form id="txn-form" onSubmit={save}>
        <FormGrid>
          <DateField form={form} name="txn_date" label="Date *" max={today()} clearable={false} />
          <Input form={form} name="amount" label="Amount *" type="number" min="0" step="any" required autoFocus />
          {isExpense && <Select form={form} name="account" label="Paid by *" options={EXPENSE_ACCOUNTS} placeholder={false} searchable={false} />}
          {isExpense && <Select form={form} name="category" label="Category *" options={cats} creatable sortable />}
          <Input form={form} name="reference" label="Reference" placeholder={isExpense ? 'Receipt / bill no.' : 'Voucher no.'} />
          {isExpense && <Select form={form} name="vehicle_id" label="Vehicle (optional)" loadOptions={loadVehicles}
            options={txn?.vehicle_id ? [{ value: txn.vehicle_id, label: txn.stock_no || txn.vehicle_id }] : []} placeholder="Link to a vehicle…" />}
          <TextArea form={form} name="description" label="Description" rows={2} />
        </FormGrid>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>{t(KIND_HELP[v.kind])}</p>
      </form>
    </Modal>
  );
}
