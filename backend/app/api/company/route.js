import { db, json, fail, COMPANY_FIELDS, partyFormatError, col, NOW } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// Any logged-in user can read (needed for invoices and the header)
export const GET = guard(null, async () => json(await db.get('SELECT * FROM company WHERE id = 1')));

export const PUT = guard('company:manage', async req => {
  const b = await req.json();
  if (!b.name?.trim()) return fail('Company name is required');
  if (!b.country?.trim()) return fail('Country is required');
  if (b.invoice_prefix && !/^[A-Z0-9-]{1,10}$/i.test(b.invoice_prefix)) return fail('Invoice prefix: up to 10 letters, numbers or dashes');
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return fail('Enter a valid email address');
  // Same Japanese format rules as parties (〒, 法人番号, T-number, branch code, account no, katakana)
  const fmt = partyFormatError(b);
  if (fmt) return fail(fmt);

  const before = (await db.get('SELECT country FROM company WHERE id = 1')).country || 'Pakistan';
  const vals = COMPANY_FIELDS.map(f => (typeof b[f] === 'string' ? b[f].trim() : b[f]) || null);
  await db.tx(async t => {
    await t.run(`UPDATE company SET ${COMPANY_FIELDS.map(f => `${col(f)}=?`).join(',')}, updated_at=${NOW} WHERE id=1`, ...vals);
    // "Local" follows the home country: re-scope every party when it changes
    const home = b.country.trim();
    if (home !== before) {
      await t.run("UPDATE parties SET country = ? WHERE scope = 'Local' AND (country IS NULL OR country = '')", before);
      await t.run("UPDATE parties SET scope = CASE WHEN country = ? THEN 'Local' ELSE 'International' END", home);
    }
  });
  return json(await db.get('SELECT * FROM company WHERE id = 1'));
});
