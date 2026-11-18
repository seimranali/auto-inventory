import { db, json, fail, COMPANY_FIELDS, col } from '@/lib/db';
import { guard } from '@/lib/auth';
import { listCompanies, getCompany, companyError, companyValues, prefixTaken, freePrefix } from '@/lib/companies';

export const runtime = 'nodejs';

// Any logged-in user can read (company switcher, invoices, header)
export const GET = guard(null, async () => json(await listCompanies()));

export const POST = guard('company:manage', async req => {
  const b = await req.json();
  const err = companyError(b);
  if (err) return fail(err);
  if (!b.invoice_prefix?.trim()) b.invoice_prefix = await freePrefix();
  if (await prefixTaken(b.invoice_prefix)) return fail(`Invoice prefix ${b.invoice_prefix.toUpperCase()} is already used by another company. Choose a different one under Invoicing.`);
  const id = await db.tx(async t => {
    const { n } = await t.get('SELECT ISNULL(MAX(id), 0) + 1 n FROM company WITH (UPDLOCK, HOLDLOCK)');
    await t.run(`INSERT INTO company (id, active, created_at, ${COMPANY_FIELDS.map(col).join(',')})
      VALUES (?, 1, CONVERT(nvarchar(19), SYSUTCDATETIME(), 120), ${COMPANY_FIELDS.map(() => '?').join(',')})`, n, ...companyValues(b));
    return n;
  });
  return json(await getCompany(id), 201);
});
