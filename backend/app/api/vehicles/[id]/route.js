import { db, assignInvoiceNo, cleanVehicle, getVehicle, removeUpload, json, fail, isUnique, col, NOW,
  chassisKey, chassisStockError, chassisSaleError } from '@/lib/db';
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
  const current = await db.get('SELECT id, chassis_no, status, purchase_date FROM vehicles WHERE id = ?', id);
  if (!current) return fail('Vehicle not found', 404);
  try {
    const data = cleanVehicle(await req.json());
    if (!can(user, 'vehicles:write')) {
      // Sales role: only the sale fields, and only to mark the vehicle Sold
      if (!can(user, 'sales:write')) return fail('You do not have permission to do this', 403);
      Object.keys(data).forEach(k => SALE_FIELDS.has(k) || delete data[k]);
      if (data.status && data.status !== 'Sold') return fail('You can only record sales', 403);
    }
    if (data.chassis_no) data.chassis_no = String(data.chassis_no).trim();

    // Chassis rules, checked against the vehicle as it will be after this change
    const after = { ...current, ...data };
    const chassisChanged = 'chassis_no' in data && chassisKey(data.chassis_no) !== chassisKey(current.chassis_no);
    // Back in stock (new chassis, or a sale undone): no other vehicle with this chassis may be in stock
    if (after.status !== 'Sold' && (chassisChanged || current.status === 'Sold')) {
      const dup = await chassisStockError(after.chassis_no, id);
      if (dup) return fail(dup, 409);
    }
    // Being sold now (not editing an existing sale): the same chassis must not have been sold already
    if (after.status === 'Sold' && (current.status !== 'Sold' || chassisChanged)) {
      const twice = await chassisSaleError(after);
      if (twice) return fail(twice, 409);
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
