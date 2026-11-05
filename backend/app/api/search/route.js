import { db, json } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/search?q=... → { vehicles, invoices, parties } (each capped) for the header search
export const GET = guard('vehicles:read', async req => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ vehicles: [], invoices: [], parties: [] });
  const like = `%${q}%`;
  // Exact / prefix matches on identifiers rank above loose matches (the database collation is case-insensitive)
  const rank = col => `CASE WHEN ${col} = ? THEN 0 WHEN ${col} LIKE ? THEN 1 ELSE 2 END`;

  const vehicles = await db.all(`
    SELECT TOP 8 v.id, v.stock_no, v.chassis_no, v.make, v.model, v.variant, v.year, v.color, v.status, v.lot_no, v.buyer_name,
      (SELECT TOP 1 file_name FROM vehicle_images i WHERE i.vehicle_id = v.id ORDER BY sort, created_at) cover
    FROM vehicles v
    WHERE v.stock_no LIKE ? OR v.chassis_no LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.variant LIKE ?
      OR CONCAT(v.make, ' ', v.model) LIKE ? OR v.lot_no LIKE ? OR v.engine_no LIKE ? OR v.reg_no LIKE ? OR v.color LIKE ?
      OR CAST(v.year AS NVARCHAR(10)) = ?
    ORDER BY ${rank('v.stock_no')}, ${rank('v.chassis_no')}, v.created_at DESC`,
    ...Array(10).fill(like), q, q, `${q}%`, q, `${q}%`);

  const invoices = await db.all(`
    SELECT TOP 5 v.id, v.invoice_no, v.sale_date, v.sale_price, v.amount_received, v.buyer_name, v.sale_type, v.make, v.model, v.year
    FROM vehicles v WHERE v.status = 'Sold' AND (v.invoice_no LIKE ? OR v.buyer_name LIKE ?)
    ORDER BY ${rank('v.invoice_no')}, v.sale_date DESC`,
    like, like, q, `${q}%`);

  const parties = await db.all(`
    SELECT TOP 6 id, code, name, name_kana, company_name, role, scope, country, city, phone, category
    FROM parties
    WHERE name LIKE ? OR company_name LIKE ? OR name_kana LIKE ? OR code LIKE ? OR phone LIKE ? OR email LIKE ?
      OR corporate_number LIKE ? OR invoice_reg_no LIKE ? OR id_no LIKE ? OR country LIKE ? OR city LIKE ?
    ORDER BY ${rank('code')}, ISNULL(active, 1) DESC, name`,
    ...Array(11).fill(like), q, `${q}%`);

  return json({ vehicles, invoices, parties });
});
