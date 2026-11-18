import { db, COMPANY_FIELDS, partyFormatError } from './db';

// Companies this business trades as. Each has its own profile, logo, invoice prefix and bank details;
// vehicles and account entries belong to one company. Company 1 (the lowest id) is the main company:
// its country decides what "Local" means for parties.

// record_count: vehicles bought / sold plus account entries; a company with none can be deleted
export const listCompanies = () => db.all(`SELECT c.*,
    (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id) + (SELECT COUNT(*) FROM transactions t WHERE t.company_id = c.id) record_count
  FROM company c ORDER BY ISNULL(c.active, 1) DESC, c.id`);
export const getCompany = id => db.get(`SELECT c.*,
    (SELECT COUNT(*) FROM vehicles v WHERE v.company_id = c.id) + (SELECT COUNT(*) FROM transactions t WHERE t.company_id = c.id) record_count
  FROM company c WHERE c.id = ?`, Number(id));
export const mainCompanyId = async () => (await db.get('SELECT MIN(id) id FROM company')).id;

export function companyError(b) {
  if (!b.name?.trim()) return 'Company name is required';
  if (!b.country?.trim()) return 'Country is required';
  if (b.invoice_prefix && !/^[A-Z0-9-]{1,10}$/i.test(b.invoice_prefix)) return 'Invoice prefix: up to 10 letters, numbers or dashes';
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return 'Enter a valid email address';
  // Same Japanese format rules as parties (〒, 法人番号, T-number, branch code, account no, katakana)
  return partyFormatError(b);
}

export const companyValues = b => COMPANY_FIELDS.map(f => (typeof b[f] === 'string' ? b[f].trim() : b[f]) || null);

// Two companies must not share an invoice prefix, or their invoice numbers would run together
export async function prefixTaken(prefix, exceptId = 0) {
  const p = (prefix || 'INV').trim().toUpperCase();
  return !!await db.get("SELECT 1 x FROM company WHERE UPPER(ISNULL(NULLIF(invoice_prefix, ''), 'INV')) = ? AND id <> ?", p, Number(exceptId));
}

// Blank prefix on a new company: the first free INV2, INV3 …
export async function freePrefix() {
  for (let n = 2; ; n++) if (!await prefixTaken(`INV${n}`)) return `INV${n}`;
}
