import { db, cleanParty, partyFormatError, json, fail, SELECT_VEHICLE, COST_SQL, PROFIT_SQL, col, NOW } from '@/lib/db';
import { guard, can } from '@/lib/auth';

export const runtime = 'nodejs';

// Full party record + every vehicle bought from / sold to them + totals
export const GET = guard('vehicles:read', async (_req, { params }) => {
  const { id } = await params;
  const party = await db.get('SELECT * FROM parties WHERE id = ?', id);
  if (!party) return fail('Party not found', 404);
  const purchases = await db.all(`${SELECT_VEHICLE} WHERE v.seller_party_id = ? ORDER BY v.purchase_date DESC`, id);
  const sales = await db.all(`${SELECT_VEHICLE} WHERE v.buyer_party_id = ? AND v.status = 'Sold' ORDER BY v.sale_date DESC`, id);
  const totals = {
    purchases: await db.get(`SELECT COUNT(*) count, ISNULL(SUM(${COST_SQL}),0) value FROM vehicles WHERE seller_party_id = ?`, id),
    sales: await db.get(`SELECT COUNT(*) count, ISNULL(SUM(sale_price),0) value, ISNULL(SUM(${PROFIT_SQL}),0) profit,
      ISNULL(SUM(ISNULL(amount_received,0)),0) received FROM vehicles WHERE buyer_party_id = ? AND status = 'Sold'`, id),
  };
  totals.sales.receivable = totals.sales.value - totals.sales.received;
  return json({ party, purchases, sales, totals });
});

export const PUT = guard(null, async (req, { params }, user) => {
  if (!can(user, 'vehicles:write') && !can(user, 'sales:write')) return fail('You do not have permission to do this', 403);
  const { id } = await params;
  const current = await db.get('SELECT * FROM parties WHERE id = ?', id);
  if (!current) return fail('Party not found', 404);
  const data = cleanParty(await req.json());
  if ('name' in data && !data.name) return fail('Name is required');
  if (data.role && !['Buyer', 'Seller', 'Both'].includes(data.role)) return fail('Choose Buyer, Seller or Both');
  if (data.scope && !['Local', 'International'].includes(data.scope)) return fail('Choose Local or International');
  if (data.scope === 'International' && 'country' in data && !data.country) return fail('Country is required for international parties');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail('Enter a valid email address');
  // Validate Japanese formats against the record as it will be after the update
  const fmt = partyFormatError({ ...current, ...data });
  if (fmt) return fail(fmt);
  const cols = Object.keys(data);
  if (cols.length) {
    await db.run(`UPDATE parties SET ${cols.map(c => `${col(c)}=?`).join(',')}, updated_at=${NOW} WHERE id=?`, ...cols.map(c => data[c]), id);
  }
  return json(await db.get('SELECT * FROM parties WHERE id = ?', id));
});

// Only parties with no linked vehicles can be deleted; otherwise deactivate them
export const DELETE = guard('vehicles:write', async (_req, { params }) => {
  const { id } = await params;
  const { n: used } = await db.get('SELECT COUNT(*) n FROM vehicles WHERE buyer_party_id = ? OR seller_party_id = ?', id, id);
  if (used) return fail(`This party is linked to ${used} vehicle${used > 1 ? 's' : ''}. Mark it inactive instead.`, 409);
  await db.run('DELETE FROM parties WHERE id = ?', id);
  return json({ ok: true });
});
