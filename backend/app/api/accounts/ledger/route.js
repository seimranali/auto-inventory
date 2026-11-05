import { json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';
import { ledger } from '@/lib/accounts';

export const runtime = 'nodejs';

// GET ?book=Cash|Credit Card|Expenses&from=&to=&vehicles=0 (Cash book: leave out vehicle purchases / sales)
export const GET = guard('accounts:manage', async req => {
  const p = new URL(req.url).searchParams;
  const book = p.get('book') || 'Cash';
  if (!['Cash', 'Credit Card', 'Expenses'].includes(book)) return fail('Unknown ledger', 404);
  return json(await ledger(book, { from: p.get('from'), to: p.get('to'), includeVehicles: p.get('vehicles') !== '0' }));
});
