import { db, COST_SQL } from './db';

export const KINDS = ['Cash In', 'Cash Out', 'Expense', 'Card Payment'];
export const ACCOUNTS = ['Cash', 'Credit Card'];

// Validate / normalise a transaction from the request body
export function cleanTxn(b) {
  const kind = b.kind;
  if (!KINDS.includes(kind)) return { error: 'Choose Cash In, Cash Out, Expense or Card Payment' };
  // Only expenses choose how they were paid; everything else moves cash
  const account = kind === 'Expense' ? b.account : 'Cash';
  if (!ACCOUNTS.includes(account)) return { error: 'Choose Cash or Credit Card' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.txn_date || '')) return { error: 'Date is required' };
  const amount = Number(b.amount);
  if (!(amount > 0)) return { error: 'Amount must be more than 0' };
  if (kind === 'Expense' && !b.category?.trim()) return { error: 'Choose an expense category' };
  const s = v => (typeof v === 'string' && v.trim()) || null;
  return {
    data: {
      txn_date: b.txn_date, kind, account, amount: Math.round(amount * 100) / 100,
      category: s(b.category), description: s(b.description), reference: s(b.reference), vehicle_id: s(b.vehicle_id),
    },
  };
}

/*
  Signed ledger lines for one book, oldest first.
    Cash         + cash in, cash received on sales;  − cash out, cash expenses, card payments, vehicle purchases
    Credit Card  + card expenses (amount owed);       − card payments
    Expenses     + every expense
  includeVehicles adds vehicle sales (cash received) and purchases (landed cost) to the Cash book.
*/
function lines(book, includeVehicles) {
  const parts = [];
  const txn = (where, sign) => parts.push(`SELECT t.id, t.txn_date date, t.kind, t.account, t.category, t.description, t.reference,
    t.vehicle_id, ${sign} * t.amount amount, 'txn' source, t.created_at FROM transactions t WHERE ${where}`);
  if (book === 'Cash') {
    txn("t.kind = 'Cash In'", 1);
    txn("t.kind IN ('Cash Out', 'Card Payment') OR (t.kind = 'Expense' AND t.account = 'Cash')", -1);
    if (includeVehicles) {
      parts.push(`SELECT 'sale-' + v.id, v.sale_date, 'Vehicle Sale', 'Cash', v.make, CONCAT(v.year, ' ', v.make, ' ', v.model, ' · ', v.buyer_name),
        v.invoice_no, v.id, ISNULL(v.amount_received, 0), 'vehicle', v.created_at
        FROM vehicles v WHERE v.status = 'Sold' AND v.payment_method = 'Cash' AND v.sale_date IS NOT NULL AND ISNULL(v.amount_received, 0) > 0`);
      parts.push(`SELECT 'buy-' + v.id, v.purchase_date, 'Vehicle Purchase', 'Cash', v.make, CONCAT(v.year, ' ', v.make, ' ', v.model, ' · ', v.supplier),
        v.stock_no, v.id, -${COST_SQL}, 'vehicle', v.created_at
        FROM vehicles v WHERE v.purchase_date IS NOT NULL AND ${COST_SQL} > 0`);
    }
  } else if (book === 'Credit Card') {
    txn("t.kind = 'Expense' AND t.account = 'Credit Card'", 1);
    txn("t.kind = 'Card Payment'", -1);
  } else {
    txn("t.kind = 'Expense'", 1);
  }
  return parts.join(' UNION ALL ');
}

// Ledger with opening balance, running balance and period totals
export async function ledger(book, { from, to, includeVehicles = true } = {}) {
  const src = lines(book, includeVehicles);
  const args = [];
  let where = '1=1';
  if (from) { where += ' AND date >= ?'; args.push(from); }
  if (to) { where += ' AND date <= ?'; args.push(to); }
  const opening = from ? (await db.get(`SELECT ISNULL(SUM(amount), 0) n FROM (${src}) x WHERE date < ?`, from)).n : 0;
  const rows = await db.all(`SELECT * FROM (${src}) x WHERE ${where} ORDER BY date, created_at, id`, ...args);
  let balance = opening, debit = 0, credit = 0;
  for (const r of rows) {
    balance += r.amount;
    r.balance = balance;
    if (r.amount >= 0) r.in = r.amount, debit += r.amount; else r.out = -r.amount, credit -= r.amount;
  }
  return { book, opening, closing: balance, totalIn: debit, totalOut: credit, rows };
}

export async function balance(book, includeVehicles = true) {
  return (await db.get(`SELECT ISNULL(SUM(amount), 0) n FROM (${lines(book, includeVehicles)}) x`)).n;
}

// Expense totals for a date range (used by Profit & Margin and the Accounts overview)
export async function expenseTotals(from, to) {
  const args = [];
  let where = "kind = 'Expense'";
  if (from) { where += ' AND txn_date >= ?'; args.push(from); }
  if (to) { where += ' AND txn_date <= ?'; args.push(to); }
  return {
    total: (await db.get(`SELECT ISNULL(SUM(amount), 0) n FROM transactions WHERE ${where}`, ...args)).n,
    byCategory: await db.all(`SELECT ISNULL(category, 'Other') label, COUNT(*) count, SUM(amount) amount FROM transactions
      WHERE ${where} GROUP BY ISNULL(category, 'Other') ORDER BY amount DESC`, ...args),
    byMonth: await db.all(`SELECT LEFT(txn_date, 7) label, SUM(amount) amount FROM transactions WHERE ${where}
      GROUP BY LEFT(txn_date, 7) ORDER BY label`, ...args),
    byAccount: await db.all(`SELECT account label, COUNT(*) count, SUM(amount) amount FROM transactions WHERE ${where} GROUP BY account`, ...args),
  };
}
