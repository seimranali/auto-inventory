import { db, assignInvoiceNo, cleanVehicle, getVehicle, removeUpload, json, fail, isUnique, col, NOW } from '@/lib/db';
import { guard, can } from '@/lib/auth';

export const runtime = 'nodejs';

// Fields a user with only sales:write may change (the Sell Vehicle page)
const SALE_FIELDS = new Set(['status', 'sale_type', 'sale_date', 'sale_price', 'sale_expense', 'buyer_name', 'buyer_contact',
  'buyer_address', 'buyer_id_no', 'payment_method', 'amount_received', 'destination_country', 'port', 'shipping_ref', 'sale_notes']);

export const GET = guard('vehicles:read', async (_req, { params }) => {
  const v = await getVehicle((await params).id);
  return v ? json(v) : fail('Vehicle not found', 404);
});

export const PUT = guard(null, async (req, { params }, user) => {
  const { id } = await params;
  if (!await db.get('SELECT 1 x FROM vehicles WHERE id = ?', id)) return fail('Vehicle not found', 404);
  try {
    const data = cleanVehicle(await req.json());
    if (!can(user, 'vehicles:write')) {
      // Sales role: only the sale fields, and only to mark the vehicle Sold
      if (!can(user, 'sales:write')) return fail('You do not have permission to do this', 403);
      Object.keys(data).forEach(k => SALE_FIELDS.has(k) || delete data[k]);
      if (data.status && data.status !== 'Sold') return fail('You can only record sales', 403);
    }
    const cols = Object.keys(data);
    if (cols.length) {
      await db.run(`UPDATE vehicles SET ${cols.map(c => `${col(c)}=?`).join(',')}, updated_at=${NOW} WHERE id=?`,
        ...cols.map(c => data[c]), id);
    }
    await assignInvoiceNo(id);
    return json(await getVehicle(id));
  } catch (e) {
    return fail(isUnique(e) ? 'Stock No already exists' : e);
  }
});

export const DELETE = guard('vehicles:write', async (_req, { params }) => {
  const v = await getVehicle((await params).id);
  if (!v) return fail('Vehicle not found', 404);
  v.images.forEach(i => removeUpload(i.file_name));
  removeUpload(v.auction_sheet);
  await db.run('DELETE FROM vehicles WHERE id=?', v.id);
  return json({ ok: true });
});
