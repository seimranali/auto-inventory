// D1 data layer — async port of backend/lib/db.js (same fields, SQL and rules)

export const VEHICLE_FIELDS = [
  ['stock_no', 'TEXT'], ['chassis_no', 'TEXT'], ['engine_no', 'TEXT'], ['make', 'TEXT'], ['model', 'TEXT'],
  ['variant', 'TEXT'], ['year', 'INTEGER'], ['reg_year', 'INTEGER'], ['reg_no', 'TEXT'], ['color', 'TEXT'],
  ['mileage', 'INTEGER'], ['engine_cc', 'INTEGER'], ['fuel', 'TEXT'], ['transmission', 'TEXT'],
  ['body_type', 'TEXT'], ['drive', 'TEXT'], ['seats', 'INTEGER'], ['doors', 'INTEGER'], ['steering', 'TEXT'],
  ['condition', 'TEXT'], ['features', 'TEXT'],
  ['purchase_date', 'TEXT'], ['purchase_source', 'TEXT'], ['supplier', 'TEXT'], ['auction_house', 'TEXT'],
  ['lot_no', 'TEXT'], ['auction_date', 'TEXT'], ['purchase_price', 'REAL'], ['freight_cost', 'REAL'],
  ['duty_tax', 'REAL'], ['repair_cost', 'REAL'], ['other_cost', 'REAL'],
  ['auction_grade', 'TEXT'], ['interior_grade', 'TEXT'], ['exterior_grade', 'TEXT'], ['auction_remarks', 'TEXT'],
  ['status', 'TEXT'], ['location', 'TEXT'], ['asking_price', 'REAL'],
  ['sale_type', 'TEXT'], ['sale_date', 'TEXT'], ['buyer_name', 'TEXT'], ['buyer_contact', 'TEXT'],
  ['destination_country', 'TEXT'], ['port', 'TEXT'], ['sale_price', 'REAL'], ['sale_expense', 'REAL'],
  ['buyer_address', 'TEXT'], ['buyer_id_no', 'TEXT'], ['payment_method', 'TEXT'], ['amount_received', 'REAL'],
  ['invoice_no', 'TEXT'], ['shipping_ref', 'TEXT'], ['sale_notes', 'TEXT'],
  ['seller_party_id', 'TEXT'], ['buyer_party_id', 'TEXT'],
  ['notes', 'TEXT'],
];
const FIELD_NAMES = VEHICLE_FIELDS.map(f => f[0]);
const NUMERIC = new Set(VEHICLE_FIELDS.filter(f => f[1] !== 'TEXT').map(f => f[0]));

export const PARTY_FIELDS = [
  'role', 'category', 'scope', 'name', 'company_name', 'contact_person', 'designation',
  'phone', 'alt_phone', 'whatsapp', 'email', 'website', 'id_type', 'id_no', 'ntn', 'strn',
  'country', 'state', 'city', 'address', 'postal_code', 'port',
  'currency', 'bank_name', 'account_title', 'account_no', 'iban', 'swift', 'credit_limit', 'notes', 'active',
  'name_kana', 'prefecture', 'building', 'corporate_number', 'invoice_reg_no',
  'antique_license', 'antique_license_authority', 'auction_member_no', 'bank_branch', 'bank_branch_code', 'account_type',
];
const PARTY_NUMERIC = new Set(['credit_limit', 'active']);

export const COMPANY_FIELDS = [
  'name', 'name_kana', 'name_en', 'tagline', 'representative', 'country',
  'postal_code', 'prefecture', 'city', 'address', 'building', 'phone', 'fax', 'email', 'website',
  'ntn', 'corporate_number', 'invoice_reg_no', 'antique_license', 'antique_license_authority', 'auction_memberships',
  'bank_name', 'bank_branch', 'bank_branch_code', 'account_type', 'account_no', 'account_title', 'swift',
  'currency', 'invoice_prefix', 'terms',
];

export const COST_SQL = `(IFNULL(purchase_price,0)+IFNULL(freight_cost,0)+IFNULL(duty_tax,0)+IFNULL(repair_cost,0)+IFNULL(other_cost,0))`;
export const PROFIT_SQL = `(IFNULL(sale_price,0)-${COST_SQL}-IFNULL(sale_expense,0))`;
export const SELECT_VEHICLE = `SELECT v.*, ${COST_SQL} AS total_cost,
  CASE WHEN status='Sold' THEN ${PROFIT_SQL} END AS profit,
  (SELECT file_name FROM vehicle_images i WHERE i.vehicle_id=v.id ORDER BY sort, created_at LIMIT 1) AS cover
  FROM vehicles v`;

// Thin wrapper so call sites read like the better-sqlite3 version: await q.all(sql, ...args)
export const q = db => ({
  all: async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results,
  one: async (sql, ...a) => db.prepare(sql).bind(...a).first(),
  run: (sql, ...a) => db.prepare(sql).bind(...a).run(),
  stmt: (sql, ...a) => db.prepare(sql).bind(...a),
});

export function cleanVehicle(body) {
  const out = {};
  for (const k of FIELD_NAMES) {
    if (!(k in body)) continue;
    let val = body[k];
    if (val === '' || val === undefined) val = null;
    else if (NUMERIC.has(k)) val = Number(val);
    out[k] = val;
  }
  return out;
}

export function cleanParty(body) {
  const out = {};
  for (const k of PARTY_FIELDS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) v = null;
    else if (PARTY_NUMERIC.has(k)) v = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
    out[k] = v;
  }
  return out;
}

export function partyFormatError(d) {
  if (d.country !== 'Japan') return null;
  const checks = [
    ['postal_code', /^\d{3}-?\d{4}$/, 'Postal code must be 7 digits, e.g. 100-0001'],
    ['corporate_number', /^\d{13}$/, 'Corporate Number (法人番号) must be 13 digits'],
    ['invoice_reg_no', /^T\d{13}$/, 'Invoice Registration No. must be T followed by 13 digits'],
    ['bank_branch_code', /^\d{3}$/, 'Branch code (支店番号) must be 3 digits'],
    ['account_no', /^\d{7}$/, 'Japanese account numbers are 7 digits'],
    ['name_kana', /^[゠-ヿ･-ﾟ\s・ー（）()]+$/, 'Name reading (フリガナ) must be in katakana'],
  ];
  for (const [f, re, msg] of checks) if (d[f] && !re.test(String(d[f]))) return msg;
  return null;
}

export async function insertParty(db, data) {
  const Q = q(db);
  const id = crypto.randomUUID();
  const n = (await Q.one("SELECT MAX(CAST(substr(code, 3) AS INTEGER)) n FROM parties WHERE code LIKE 'P-%'"))?.n || 0;
  const row = { active: 1, ...data };
  const cols = Object.keys(row);
  await Q.run(`INSERT INTO parties (id, code, ${cols.join(',')}) VALUES (?, ?, ${cols.map(() => '?').join(',')})`,
    id, `P-${String(n + 1).padStart(4, '0')}`, ...cols.map(c => row[c]));
  return id;
}

// Sold vehicles get the next invoice number for the sale year: HK-2026-0001
export async function assignInvoiceNo(db, id) {
  const Q = q(db);
  const v = await Q.one('SELECT status, invoice_no, sale_date FROM vehicles WHERE id=?', id);
  if (!v || v.status !== 'Sold' || v.invoice_no) return;
  const year = (v.sale_date || new Date().toISOString()).slice(0, 4);
  const base = (await Q.one('SELECT invoice_prefix FROM company WHERE id = 1'))?.invoice_prefix || 'INV';
  const prefix = `${base}-${year}-`;
  const last = (await Q.one(`SELECT MAX(CAST(substr(invoice_no, ${prefix.length + 1}) AS INTEGER)) n FROM vehicles WHERE invoice_no LIKE ?`, `${prefix}%`))?.n || 0;
  await Q.run('UPDATE vehicles SET invoice_no=? WHERE id=?', prefix + String(last + 1).padStart(4, '0'), id);
}

export async function getVehicle(db, id) {
  const Q = q(db);
  const v = await Q.one(`${SELECT_VEHICLE} WHERE v.id = ?`, id);
  if (!v) return null;
  const party = pid => (pid ? Q.one(`SELECT id, code, name, company_name, category, scope, country, city, phone, email FROM parties WHERE id = ?`, pid) : null);
  [v.images, v.seller, v.buyer] = await Promise.all([
    Q.all('SELECT id, file_name FROM vehicle_images WHERE vehicle_id=? ORDER BY sort, created_at', id),
    party(v.seller_party_id),
    party(v.buyer_party_id),
  ]);
  return v;
}

// ---- Uploads (R2) ----
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
export const FILE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
const MAX_UPLOAD = 15 * 1024 * 1024;

// R2 is optional: without the UPLOADS binding the app runs, but photo / auction-sheet uploads are disabled
const NO_R2 = 'Photo storage is not set up yet. Enable R2 and add the "UPLOADS" bucket binding to this Worker.';

export async function saveUpload(env, file) {
  if (!env.UPLOADS) throw new Error(NO_R2);
  if (!file || typeof file === 'string') throw new Error('No file received');
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type}`);
  if (file.size > MAX_UPLOAD) throw new Error('File is larger than 15 MB');
  const name = `${crypto.randomUUID()}.${ext}`;
  await env.UPLOADS.put(name, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return name;
}

export async function removeUpload(env, name) {
  if (name && env.UPLOADS) await env.UPLOADS.delete(name.split('/').pop());
}

export const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
export const fail = (e, status = 400) => json({ error: e?.message || String(e) }, status);
// D1 surfaces constraint violations in the message text, not as a code
export const isUnique = e => /UNIQUE constraint failed/i.test(e?.message || '');
