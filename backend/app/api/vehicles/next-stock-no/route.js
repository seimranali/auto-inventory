import { nextStockNo, json } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/vehicles/next-stock-no?date=2026-11-04 → { stock_no: 'V26110017' } (a preview; the number is fixed on save)
export const GET = guard('vehicles:write', async req =>
  json({ stock_no: await nextStockNo(new URL(req.url).searchParams.get('date')) }));
