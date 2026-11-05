import { db, json } from '@/lib/db';
import { guard } from '@/lib/auth';
import { balance, expenseTotals } from '@/lib/accounts';

export const runtime = 'nodejs';

// Accounts overview: balances now, expenses in the chosen period (default: this month), recent entries
export const GET = guard('accounts:manage', async req => {
  const p = new URL(req.url).searchParams;
  const month = new Date().toISOString().slice(0, 7);
  const from = p.get('from') ?? `${month}-01`, to = p.get('to') ?? '';
  return json({
    cash: await balance('Cash', true),
    cashOnly: await balance('Cash', false),
    card: await balance('Credit Card'),
    expenses: await expenseTotals(from, to),
    categories: (await db.all("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL ORDER BY category")).map(r => r.category),
    recent: await db.all(`SELECT TOP 8 t.*, u.name created_by_name FROM transactions t LEFT JOIN users u ON u.id = t.created_by
      ORDER BY t.txn_date DESC, t.created_at DESC`),
  });
});
