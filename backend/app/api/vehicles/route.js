import crypto from 'crypto';
import { db, assignInvoiceNo, nextStockNo, SELECT_VEHICLE, cleanVehicle, getVehicle, json, fail, isUnique, col } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

export const GET = guard('vehicles:read', async req => {
  const p = new URL(req.url).searchParams;
  const where = [];
  const args = [];
  if (p.get('status')) { where.push('status = ?'); args.push(p.get('status')); }
  if (p.get('q')) {
    where.push(`(stock_no LIKE ? OR chassis_no LIKE ? OR make LIKE ? OR model LIKE ? OR buyer_name LIKE ? OR lot_no LIKE ?)`);
    args.push(...Array(6).fill(`%${p.get('q')}%`));
  }
  const sql = `${SELECT_VEHICLE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.created_at DESC`;
  return json(await db.all(sql, ...args));
});

export const POST = guard('vehicles:write', async req => {
  try {
    const data = cleanVehicle(await req.json());
    data.status ||= 'In Stock';
    const id = crypto.randomUUID();
    const auto = !data.stock_no;
    // Blank stock no → next number; retry if another user took the same number at the same moment
    for (let attempt = 0; ; attempt++) {
      if (auto) data.stock_no = await nextStockNo(data.purchase_date);
      const cols = Object.keys(data);
      try {
        await db.run(`INSERT INTO vehicles (id, ${cols.map(col).join(',')}) VALUES (?, ${cols.map(() => '?').join(',')})`,
          id, ...cols.map(c => data[c]));
        break;
      } catch (e) {
        if (!auto || !isUnique(e) || attempt >= 3) throw e;
      }
    }
    await assignInvoiceNo(id);
    return json(await getVehicle(id), 201);
  } catch (e) {
    return fail(isUnique(e) ? 'Stock No already exists' : e);
  }
});
