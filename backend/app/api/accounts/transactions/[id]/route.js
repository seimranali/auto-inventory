import { db, json, fail, NOW } from '@/lib/db';
import { guard } from '@/lib/auth';
import { cleanTxn } from '@/lib/accounts';

export const runtime = 'nodejs';

export const PUT = guard('accounts:manage', async (req, { params }) => {
  const { id } = await params;
  const current = await db.get('SELECT company_id FROM transactions WHERE id = ?', id);
  if (!current) return fail('Entry not found', 404);
  const { data, error } = await cleanTxn(await req.json(), current.company_id);
  if (error) return fail(error);
  const cols = Object.keys(data);
  await db.run(`UPDATE transactions SET ${cols.map(c => `${c}=?`).join(',')}, updated_at=${NOW} WHERE id=?`, ...cols.map(c => data[c]), id);
  return json(await db.get('SELECT * FROM transactions WHERE id = ?', id));
});

export const DELETE = guard('accounts:manage', async (_req, { params }) => {
  const { id } = await params;
  const { changes } = await db.run('DELETE FROM transactions WHERE id = ?', id);
  return changes ? json({ ok: true }) : fail('Entry not found', 404);
});
