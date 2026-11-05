import crypto from 'crypto';
import { db, json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';
import { cleanTxn } from '@/lib/accounts';

export const runtime = 'nodejs';

// GET ?kind=Expense&account=Cash&category=Fuel&from=&to=&q=
export const GET = guard('accounts:manage', async req => {
  const p = new URL(req.url).searchParams;
  const where = [], args = [];
  for (const k of ['kind', 'account', 'category']) if (p.get(k)) { where.push(`t.${k} = ?`); args.push(p.get(k)); }
  if (p.get('from')) { where.push('t.txn_date >= ?'); args.push(p.get('from')); }
  if (p.get('to')) { where.push('t.txn_date <= ?'); args.push(p.get('to')); }
  if (p.get('q')) {
    where.push('(t.description LIKE ? OR t.category LIKE ? OR t.reference LIKE ?)');
    args.push(...Array(3).fill(`%${p.get('q')}%`));
  }
  return json(await db.all(`SELECT t.*, u.name created_by_name, v.stock_no FROM transactions t
    LEFT JOIN users u ON u.id = t.created_by LEFT JOIN vehicles v ON v.id = t.vehicle_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.txn_date DESC, t.created_at DESC`, ...args));
});

export const POST = guard('accounts:manage', async (req, _ctx, user) => {
  const { data, error } = cleanTxn(await req.json());
  if (error) return fail(error);
  const id = crypto.randomUUID();
  const cols = Object.keys(data);
  await db.run(`INSERT INTO transactions (id, created_by, ${cols.join(',')}) VALUES (?, ?, ${cols.map(() => '?').join(',')})`,
    id, user.id, ...cols.map(c => data[c]));
  return json(await db.get('SELECT * FROM transactions WHERE id = ?', id), 201);
});
