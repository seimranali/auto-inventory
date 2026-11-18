import { db, json, scopeOf, inScope } from '@/lib/db';
import { guard } from '@/lib/auth';
import { balance, balanceByCompany, expenseTotals } from '@/lib/accounts';

export const runtime = 'nodejs';

// Accounts overview: balances now, expenses in the chosen period (default: this month), recent entries
export const GET = guard('accounts:manage', async req => {
  const p = new URL(req.url).searchParams;
  const month = new Date().toISOString().slice(0, 7);
  const from = p.get('from') ?? `${month}-01`, to = p.get('to') ?? '';
  const cid = scopeOf(req);
  return json({
    cash: await balance('Cash', true, cid),
    cashOnly: await balance('Cash', false, cid),
    card: await balance('Credit Card', true, cid),
    expenses: await expenseTotals(from, to, cid),
    // Every company side by side (shown when viewing all companies)
    byCompany: { cash: await balanceByCompany('Cash'), card: await balanceByCompany('Credit Card') },
    categories: (await db.all("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL ORDER BY category")).map(r => r.category),
    recent: await db.all(`SELECT TOP 8 t.*, u.name created_by_name FROM transactions t LEFT JOIN users u ON u.id = t.created_by
      WHERE ${inScope(cid, 't.company_id')} ORDER BY t.txn_date DESC, t.created_at DESC`),
  });
});
