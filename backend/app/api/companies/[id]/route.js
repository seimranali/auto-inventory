import { db, json, fail, COMPANY_FIELDS, col, NOW, removeUpload } from '@/lib/db';
import { guard } from '@/lib/auth';
import { getCompany, mainCompanyId, companyError, companyValues, prefixTaken } from '@/lib/companies';

export const runtime = 'nodejs';

export const GET = guard(null, async (_req, { params }) => {
  const c = await getCompany((await params).id);
  return c ? json(c) : fail('Company not found', 404);
});

// Body: profile fields, plus optional active (0/1) to archive a company
export const PUT = guard('company:manage', async (req, { params }) => {
  const id = Number((await params).id);
  const before = await getCompany(id);
  if (!before) return fail('Company not found', 404);
  const b = await req.json();
  const err = companyError(b);
  if (err) return fail(err);
  if (await prefixTaken(b.invoice_prefix, id)) return fail(`Invoice prefix ${(b.invoice_prefix || 'INV').toUpperCase()} is already used by another company. Choose a different one under Invoicing.`);
  const main = id === await mainCompanyId();
  const active = main ? 1 : b.active === undefined ? (before.active ?? 1) : (b.active ? 1 : 0);

  await db.tx(async t => {
    await t.run(`UPDATE company SET ${COMPANY_FIELDS.map(f => `${col(f)}=?`).join(',')}, active=?, updated_at=${NOW} WHERE id=?`,
      ...companyValues(b), active, id);
    // "Local" follows the main company's country: re-scope every party when it changes
    const home = b.country.trim(), old = before.country || 'Pakistan';
    if (main && home !== old) {
      await t.run("UPDATE parties SET country = ? WHERE scope = 'Local' AND (country IS NULL OR country = '')", old);
      await t.run("UPDATE parties SET scope = CASE WHEN country = ? THEN 'Local' ELSE 'International' END", home);
    }
  });
  return json(await getCompany(id));
});

// Only a company with no vehicles or account entries can be deleted; otherwise archive it (active = 0)
export const DELETE = guard('company:manage', async (_req, { params }) => {
  const id = Number((await params).id);
  const c = await getCompany(id);
  if (!c) return fail('Company not found', 404);
  if (id === await mainCompanyId()) return fail('The main company cannot be deleted');
  const { n } = await db.get(`SELECT (SELECT COUNT(*) FROM vehicles WHERE company_id = ?) + (SELECT COUNT(*) FROM transactions WHERE company_id = ?) n`, id, id);
  if (n) return fail(`This company has ${n} vehicle${n > 1 ? 's' : ''} or account entr${n > 1 ? 'ies' : 'y'}. Archive it instead.`, 409);
  await db.run('DELETE FROM company WHERE id = ?', id);
  removeUpload(c.logo);
  return json({ ok: true });
});
