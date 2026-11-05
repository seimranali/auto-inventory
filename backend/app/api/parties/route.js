import { db, cleanParty, insertParty, partyFormatError, json, fail, COST_SQL } from '@/lib/db';
import { guard, can } from '@/lib/auth';

export const runtime = 'nodejs';

// List with per-party totals. Filters: role (Buyer|Seller — "Both" always included), scope, q, active
export const GET = guard('vehicles:read', async req => {
  const p = new URL(req.url).searchParams;
  const where = [], args = [];
  if (p.get('role')) { where.push("(p.role = ? OR p.role = 'Both')"); args.push(p.get('role')); }
  if (p.get('scope')) { where.push('p.scope = ?'); args.push(p.get('scope')); }
  if (p.get('active')) { where.push('ISNULL(p.active, 1) = ?'); args.push(Number(p.get('active'))); }
  if (p.get('q')) {
    where.push('(p.name LIKE ? OR p.company_name LIKE ? OR p.code LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR p.country LIKE ? OR p.city LIKE ?)');
    args.push(...Array(7).fill(`%${p.get('q')}%`));
  }
  const rows = await db.all(`
    SELECT p.*,
      (SELECT COUNT(*) FROM vehicles v WHERE v.seller_party_id = p.id) bought_count,
      (SELECT ISNULL(SUM(${COST_SQL}),0) FROM vehicles v WHERE v.seller_party_id = p.id) bought_value,
      (SELECT COUNT(*) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') sold_count,
      (SELECT ISNULL(SUM(sale_price),0) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') sold_value,
      (SELECT ISNULL(SUM(sale_price - ISNULL(amount_received,0)),0) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') receivable,
      (SELECT MAX(d) FROM (SELECT MAX(purchase_date) d FROM vehicles WHERE seller_party_id = p.id
                           UNION ALL SELECT MAX(sale_date) FROM vehicles WHERE buyer_party_id = p.id) x) last_deal
    FROM parties p ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.name`, ...args);
  return json(rows);
});

// Sales staff may add buyers on the fly; managers/admins may add anyone
export const POST = guard(null, async (req, _ctx, user) => {
  if (!can(user, 'vehicles:write') && !can(user, 'sales:write')) return fail('You do not have permission to do this', 403);
  const data = cleanParty(await req.json());
  if (!data.name) return fail('Name is required');
  if (!['Buyer', 'Seller', 'Both'].includes(data.role)) return fail('Choose Buyer, Seller or Both');
  if (!['Local', 'International'].includes(data.scope)) return fail('Choose Local or International');
  if (data.scope === 'International' && !data.country) return fail('Country is required for international parties');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail('Enter a valid email address');
  const fmt = partyFormatError(data);
  if (fmt) return fail(fmt);
  const id = await insertParty(data);
  return json(await db.get('SELECT * FROM parties WHERE id = ?', id), 201);
});
