import { db, json, fail, NOW } from '@/lib/db';
import { guard } from '@/lib/auth';
import { cleanTxn } from '@/lib/accounts';

export const runtime = 'nodejs';

export const PUT = guard('accounts:manage', async (req, { params }) => {
  const { id } = await params;
  if (!await db.get('SELECT 1 x FROM transactions WHERE id = ?', id)) return fail('Entry not found', 404);
  const { data, error } = cleanTxn(await req.json());
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
