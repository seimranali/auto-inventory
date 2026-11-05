import { db, json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// Fields whose existing values can be offered as dropdown suggestions
const FIELDS = ['make', 'model', 'variant', 'color', 'supplier', 'auction_house', 'location', 'buyer_name', 'destination_country', 'port'];

// GET /api/options/model?q=cor&make=Toyota -> [{ value, label, count, group }]
export const GET = guard('vehicles:read', async (req, { params }) => {
  const field = (await params).field;
  if (!FIELDS.includes(field)) return fail('Unknown field', 404);
  const p = new URL(req.url).searchParams;
  const where = [`${field} IS NOT NULL`, `${field} <> ''`];
  const args = [];
  if (p.get('q')) { where.push(`${field} LIKE ?`); args.push(`%${p.get('q')}%`); }
  if (field === 'model' && p.get('make')) { where.push('make = ?'); args.push(p.get('make')); }
  // Models are grouped by make so the list stays readable when no make is chosen
  const group = field === 'model' ? 'make' : field === 'port' ? 'destination_country' : null;
  const limit = Math.min(Number(p.get('limit')) || 100, 1000);
  const rows = await db.all(`SELECT TOP ${limit} ${field} value, ${group ? `${group} grp,` : ''} COUNT(*) count FROM vehicles
    WHERE ${where.join(' AND ')} GROUP BY ${field}${group ? `, ${group}` : ''} ORDER BY count DESC`, ...args);
  return json(rows.map(r => ({ value: r.value, label: r.value, count: r.count, group: r.grp || undefined })));
});
