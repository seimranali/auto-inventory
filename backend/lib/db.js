import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Uploads live under DATA_DIR (set it in production so redeploys never touch uploaded files)
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Every editable vehicle column: [name, SQL Server type]
export const VEHICLE_FIELDS = [
  // Identity & specs
  ['stock_no', 'NVARCHAR(100)'], ['chassis_no', 'NVARCHAR(200)'], ['engine_no', 'NVARCHAR(200)'], ['make', 'NVARCHAR(200)'], ['model', 'NVARCHAR(200)'],
  ['variant', 'NVARCHAR(200)'], ['year', 'INT'], ['reg_year', 'INT'], ['reg_no', 'NVARCHAR(100)'], ['color', 'NVARCHAR(100)'],
  ['mileage', 'INT'], ['engine_cc', 'INT'], ['fuel', 'NVARCHAR(50)'], ['transmission', 'NVARCHAR(50)'],
  ['body_type', 'NVARCHAR(100)'], ['drive', 'NVARCHAR(50)'], ['seats', 'INT'], ['doors', 'INT'], ['steering', 'NVARCHAR(50)'],
  ['condition', 'NVARCHAR(50)'], ['features', 'NVARCHAR(MAX)'],
  // Purchase (IN)
  ['purchase_date', 'NVARCHAR(30)'], ['purchase_source', 'NVARCHAR(100)'], ['supplier', 'NVARCHAR(300)'], ['auction_house', 'NVARCHAR(200)'],
  ['lot_no', 'NVARCHAR(100)'], ['auction_date', 'NVARCHAR(30)'], ['purchase_price', 'FLOAT'], ['freight_cost', 'FLOAT'],
  ['duty_tax', 'FLOAT'], ['repair_cost', 'FLOAT'], ['other_cost', 'FLOAT'],
  // Auction sheet & grading
  ['auction_grade', 'NVARCHAR(20)'], ['interior_grade', 'NVARCHAR(20)'], ['exterior_grade', 'NVARCHAR(20)'], ['auction_remarks', 'NVARCHAR(MAX)'],
  // Status
  ['status', 'NVARCHAR(30)'], ['location', 'NVARCHAR(200)'], ['asking_price', 'FLOAT'],
  // Sale (OUT)
  ['sale_type', 'NVARCHAR(30)'], ['sale_date', 'NVARCHAR(30)'], ['buyer_name', 'NVARCHAR(300)'], ['buyer_contact', 'NVARCHAR(200)'],
  ['destination_country', 'NVARCHAR(100)'], ['port', 'NVARCHAR(100)'], ['sale_price', 'FLOAT'], ['sale_expense', 'FLOAT'],
  ['buyer_address', 'NVARCHAR(MAX)'], ['buyer_id_no', 'NVARCHAR(100)'], ['payment_method', 'NVARCHAR(100)'], ['amount_received', 'FLOAT'],
  ['invoice_no', 'NVARCHAR(100)'], ['shipping_ref', 'NVARCHAR(200)'], ['sale_notes', 'NVARCHAR(MAX)'],
  // Links to the parties table (the text fields above keep a snapshot for invoices)
  ['seller_party_id', 'NVARCHAR(64)'], ['buyer_party_id', 'NVARCHAR(64)'],
  ['notes', 'NVARCHAR(MAX)'],
];
const FIELD_NAMES = VEHICLE_FIELDS.map(f => f[0]);
const NUMERIC = new Set(VEHICLE_FIELDS.filter(f => f[1] === 'INT' || f[1] === 'FLOAT').map(f => f[0]));

// ---- Connection (settings come from .env / environment) ----
const CONFIG = {
  server: process.env.MSSQL_SERVER || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE || 'AutoInventory',
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: { encrypt: process.env.MSSQL_ENCRYPT === 'true', trustServerCertificate: true },
  pool: { max: 10 },
};

// Current UTC time in the same text format the app has always stored ('YYYY-MM-DD HH:MM:SS')
export const NOW = 'CONVERT(nvarchar(19), SYSUTCDATETIME(), 120)';

const g = globalThis;
// Connect lazily on first query (so `next build` never needs a database) and create the schema once
function pool() {
  return g.__autoPool || (g.__autoPool = (async () => {
    const p = await new sql.ConnectionPool(CONFIG).connect();
    await initSchema(p);
    return p;
  })().catch(e => { g.__autoPool = null; throw e; }));
}

// Positional "?" placeholders → @p0, @p1 …; ints map to INT, other numbers to FLOAT, the rest to NVARCHAR
function bind(req, text, args) {
  let i = 0;
  const out = text.replace(/\?/g, () => `@p${i++}`);
  if (i !== args.length) throw new Error(`SQL expects ${i} parameters, got ${args.length}`);
  args.forEach((v, n) => {
    if (typeof v === 'boolean') v = v ? 1 : 0;
    const type = typeof v === 'number'
      ? (Number.isInteger(v) && Math.abs(v) < 2 ** 31 ? sql.Int : sql.Float)
      : sql.NVarChar(sql.MAX);
    req.input(`p${n}`, type, v ?? null);
  });
  return out;
}

async function exec(runner, text, args) {
  const req = (runner || await pool()).request();
  return req.query(bind(req, text, args));
}

// Query helpers bound to a pool or a transaction
const helpers = runner => ({
  all: async (text, ...args) => (await exec(runner, text, args)).recordset || [],
  get: async (text, ...args) => (await exec(runner, text, args)).recordset?.[0],
  run: async (text, ...args) => ({ changes: (await exec(runner, text, args)).rowsAffected.reduce((a, b) => a + b, 0) }),
});

export const db = {
  ...helpers(null),
  // await db.tx(async t => { await t.run(...); await t.run(...); })
  async tx(fn) {
    const t = new sql.Transaction(await pool());
    await t.begin();
    try { const r = await fn(helpers(t)); await t.commit(); return r; } catch (e) { await t.rollback(); throw e; }
  },
};

// Unique-key violation (duplicate stock no, email …)
export const isUnique = e => e?.number === 2627 || e?.number === 2601;

// ---- Parties: buyers and sellers, local or international ----
export const PARTY_FIELDS = [
  'role',            // Buyer | Seller | Both
  'category',        // Individual | Company | Dealer | Auction House | Agent
  'scope',           // Local | International
  'name', 'company_name', 'contact_person', 'designation',
  'phone', 'alt_phone', 'whatsapp', 'email', 'website',
  'id_type', 'id_no', 'ntn', 'strn',        // CNIC / Passport / Company Reg / Emirates ID …; tax numbers
  'country', 'state', 'city', 'address', 'postal_code', 'port',
  'currency', 'bank_name', 'account_title', 'account_no', 'iban', 'swift',
  'credit_limit', 'notes', 'active',
  // Japan-specific (used when country = Japan)
  'name_kana',                      // フリガナ reading of the name
  'prefecture', 'building',         // 都道府県; building / room (city = 市区町村, address = 町名・番地)
  'corporate_number',               // 法人番号 (13 digits)
  'invoice_reg_no',                 // 適格請求書発行事業者登録番号 (T + 13 digits)
  'antique_license', 'antique_license_authority', // 古物商許可番号 + issuing Public Safety Commission
  'auction_member_no',              // e.g. USS / TAA membership number
  'bank_branch', 'bank_branch_code', 'account_type', // 支店名, 支店番号 (3 digits), 普通 / 当座 / 貯蓄
];
const PARTY_NUMERIC = new Set(['credit_limit', 'active']);
const PARTY_LONG = new Set(['address', 'notes']);

// Format checks for Japanese identifiers (only when a value is given)
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

export async function nextPartyCode(t = db) {
  const { n } = await t.get("SELECT MAX(TRY_CAST(SUBSTRING(code, 3, 20) AS INT)) n FROM parties WHERE code LIKE 'P-%'");
  return `P-${String((n || 0) + 1).padStart(4, '0')}`;
}

export async function insertParty(data) {
  const id = crypto.randomUUID();
  const row = { active: 1, ...data };
  const cols = Object.keys(row);
  await db.run(`INSERT INTO parties (id, code, ${cols.join(',')}) VALUES (?, ?, ${cols.map(() => '?').join(',')})`,
    id, await nextPartyCode(), ...cols.map(c => row[c]));
  return id;
}

// Company profile fields (Japan-ready: 法人番号, invoice registration, 古物商, Japanese bank details)
export const COMPANY_FIELDS = [
  'name', 'name_kana', 'name_en', 'tagline', 'representative', 'country',
  'postal_code', 'prefecture', 'city', 'address', 'building',
  'phone', 'fax', 'email', 'website',
  'ntn', 'corporate_number', 'invoice_reg_no', 'antique_license', 'antique_license_authority', 'auction_memberships',
  'bank_name', 'bank_branch', 'bank_branch_code', 'account_type', 'account_no', 'account_title', 'swift',
  'currency', 'invoice_prefix', 'terms',
];

// ---- Schema: created on first connection; columns added later are back-filled ----
async function initSchema(p) {
  const q = text => p.request().query(text);
  const table = (name, body) => q(`IF OBJECT_ID('${name}', 'U') IS NULL CREATE TABLE ${name} (${body})`);
  const addMissing = async (name, cols) => {
    const have = new Set((await q(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${name}')`)).recordset.map(r => r.name));
    for (const [c, t] of cols) if (!have.has(c)) await q(`ALTER TABLE ${name} ADD [${c}] ${t}`);
  };
  const index = (name, text) => q(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${name}') ${text}`);

  await table('vehicles', `id NVARCHAR(64) PRIMARY KEY,
    ${VEHICLE_FIELDS.map(([n, t]) => `[${n}] ${t}`).join(', ')},
    auction_sheet NVARCHAR(200), created_at NVARCHAR(30) DEFAULT ${NOW}, updated_at NVARCHAR(30)`);
  await addMissing('vehicles', VEHICLE_FIELDS);
  await index('ux_vehicles_stock', 'CREATE UNIQUE INDEX ux_vehicles_stock ON vehicles(stock_no) WHERE stock_no IS NOT NULL');
  await table('vehicle_images', `id NVARCHAR(64) PRIMARY KEY,
    vehicle_id NVARCHAR(64) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    file_name NVARCHAR(200) NOT NULL, sort INT DEFAULT 0, created_at NVARCHAR(30) DEFAULT ${NOW}`);

  await table('company', `id INT PRIMARY KEY CHECK (id = 1), updated_at NVARCHAR(30),
    ${COMPANY_FIELDS.map(f => `[${f}] ${f === 'terms' || f === 'address' ? 'NVARCHAR(MAX)' : 'NVARCHAR(400)'}`).join(', ')}`);
  await addMissing('company', [...COMPANY_FIELDS.map(f => [f, f === 'terms' || f === 'address' ? 'NVARCHAR(MAX)' : 'NVARCHAR(400)']),
    ['logo', 'NVARCHAR(200)']]); // uploaded file name; set only through /api/company/logo
  await table('users', `id NVARCHAR(64) PRIMARY KEY, name NVARCHAR(200) NOT NULL, email NVARCHAR(256) NOT NULL UNIQUE, phone NVARCHAR(100),
    password_hash NVARCHAR(400) NOT NULL, role NVARCHAR(30) NOT NULL, active INT DEFAULT 1,
    last_login NVARCHAR(30), created_at NVARCHAR(30) DEFAULT ${NOW}, updated_at NVARCHAR(30)`);
  await table('sessions', `token NVARCHAR(128) PRIMARY KEY, user_id NVARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at NVARCHAR(30) NOT NULL, created_at NVARCHAR(30) DEFAULT ${NOW}`);

  const partyType = f => (PARTY_NUMERIC.has(f) ? 'FLOAT' : PARTY_LONG.has(f) ? 'NVARCHAR(MAX)' : 'NVARCHAR(400)');
  await table('parties', `id NVARCHAR(64) PRIMARY KEY, code NVARCHAR(50) UNIQUE,
    ${PARTY_FIELDS.map(f => `[${f}] ${partyType(f)}`).join(', ')},
    created_at NVARCHAR(30) DEFAULT ${NOW}, updated_at NVARCHAR(30)`);
  await addMissing('parties', PARTY_FIELDS.map(f => [f, partyType(f)]));
  // Accounts: cash in / out, expenses (cash or credit card) and credit-card bill payments
  await table('transactions', `id NVARCHAR(64) PRIMARY KEY, txn_date NVARCHAR(10) NOT NULL, kind NVARCHAR(20) NOT NULL,
    account NVARCHAR(30) NOT NULL, category NVARCHAR(100), description NVARCHAR(400), amount FLOAT NOT NULL,
    reference NVARCHAR(100), vehicle_id NVARCHAR(64), created_by NVARCHAR(64), created_at NVARCHAR(30) DEFAULT ${NOW}, updated_at NVARCHAR(30)`);
  await index('ix_transactions_date', 'CREATE INDEX ix_transactions_date ON transactions(txn_date, kind)');

  await index('ix_vehicles_buyer', 'CREATE INDEX ix_vehicles_buyer ON vehicles(buyer_party_id)');
  await index('ix_vehicles_seller', 'CREATE INDEX ix_vehicles_seller ON vehicles(seller_party_id)');

  if (!(await q('SELECT TOP 1 1 x FROM company')).recordset.length) {
    const r = p.request();
    r.input('terms', sql.NVarChar(sql.MAX), ['Vehicle is sold on an "as is, where is" basis after inspection by the buyer.',
      'Ownership and documents will be transferred after full payment is received.',
      'Payments once received are non-refundable.'].join('\n'));
    await r.query(`INSERT INTO company (id, name, tagline, address, phone, email, country, currency, invoice_prefix, terms)
      VALUES (1, 'Auto Inventory Motors', 'Import · Local Sale · Export', 'Showroom address, City, Country', '+92 300 0000000',
      'sales@example.com', 'Pakistan', 'PKR', 'INV', @terms)`);
  }
  // First run: create a default admin so someone can log in
  if (!(await q('SELECT TOP 1 1 x FROM users')).recordset.length) {
    const { hashPassword } = await import('./password.js');
    const r = p.request();
    r.input('id', sql.NVarChar, crypto.randomUUID());
    r.input('hash', sql.NVarChar, hashPassword('admin123'));
    await r.query(`INSERT INTO users (id, name, email, password_hash, role) VALUES (@id, 'Administrator', 'admin@autoinventory.local', @hash, 'Admin')`);
    console.log('Created default admin: admin@autoinventory.local / admin123 (change this password after logging in)');
  }
}

// Cost / profit expressions shared by every query
export const COST_SQL = `(ISNULL(purchase_price,0)+ISNULL(freight_cost,0)+ISNULL(duty_tax,0)+ISNULL(repair_cost,0)+ISNULL(other_cost,0))`;
export const PROFIT_SQL = `(ISNULL(sale_price,0)-${COST_SQL}-ISNULL(sale_expense,0))`;
// selectVehicles(8) → "SELECT TOP 8 …"; append WHERE / ORDER BY
export const selectVehicles = top => `SELECT ${top ? `TOP ${Number(top)} ` : ''}v.*, ${COST_SQL} AS total_cost,
  CASE WHEN status='Sold' THEN ${PROFIT_SQL} END AS profit,
  (SELECT TOP 1 file_name FROM vehicle_images i WHERE i.vehicle_id=v.id ORDER BY sort, created_at) AS cover
  FROM vehicles v`;
export const SELECT_VEHICLE = selectVehicles();

// ---- Chassis numbers: one vehicle in stock per chassis; a chassis can be bought again only after it was sold ----
// Compared ignoring case and spaces
export const CHASSIS_KEY_SQL = "UPPER(REPLACE(LTRIM(RTRIM(chassis_no)), ' ', ''))";
export const chassisKey = c => String(c || '').replace(/\s+/g, '').toUpperCase();

// Other vehicles with the same chassis: { inStock: vehicle | null, sold: [vehicles] }
export async function chassisMatches(chassis, excludeId = '') {
  const key = chassisKey(chassis);
  if (!key) return { inStock: null, sold: [] };
  const rows = await db.all(`SELECT id, stock_no, make, model, year, status, purchase_date, sale_date, invoice_no, buyer_name
    FROM vehicles WHERE ${CHASSIS_KEY_SQL} = ? AND id <> ? ORDER BY purchase_date DESC, created_at DESC`, key, excludeId || '');
  return { inStock: rows.find(r => r.status !== 'Sold') || null, sold: rows.filter(r => r.status === 'Sold') };
}

const label = v => `${v.stock_no || 'a vehicle'} (${[v.year, v.make, v.model].filter(Boolean).join(' ')})`;

// Error message when a vehicle with this chassis may not be in stock now, else null
export async function chassisStockError(chassis, excludeId) {
  const { inStock } = await chassisMatches(chassis, excludeId);
  return inStock
    ? `Chassis ${chassis} is already in stock as ${label(inStock)} — ${inStock.status}. The same chassis can be added again only after that vehicle is sold.`
    : null;
}

// Error message when selling would sell the same chassis twice: it was already sold after this vehicle was bought
export async function chassisSaleError(v) {
  if (!chassisKey(v.chassis_no)) return null;
  const { sold } = await chassisMatches(v.chassis_no, v.id);
  const again = sold.find(s => !v.purchase_date || !s.sale_date || s.sale_date >= v.purchase_date);
  return again
    ? `Chassis ${v.chassis_no} was already sold as ${label(again)} on ${again.sale_date || 'an earlier date'}${again.invoice_no ? ` (invoice ${again.invoice_no})` : ''}, after this vehicle was bought. A vehicle can't be sold twice.`
    : null;
}

// Next stock number for the purchase month: V + YYMM + 4-digit sequence (V26110017), same scheme as MubashirJP
export async function nextStockNo(date) {
  const d = /^\d{4}-\d{2}/.test(date || '') ? date : new Date().toISOString();
  const prefix = `V${d.slice(2, 4)}${d.slice(5, 7)}`;
  const { n } = await db.get(`SELECT MAX(TRY_CAST(SUBSTRING(stock_no, ${prefix.length + 1}, 10) AS INT)) n FROM vehicles
    WHERE stock_no LIKE ? AND LEN(stock_no) = ${prefix.length + 4}`, `${prefix}%`);
  return prefix + String((n || 0) + 1).padStart(4, '0');
}

// Sold vehicles get the next invoice number for the sale year: INV-2026-0001
export async function assignInvoiceNo(id) {
  const v = await db.get('SELECT status, invoice_no, sale_date FROM vehicles WHERE id=?', id);
  if (!v || v.status !== 'Sold' || v.invoice_no) return;
  const year = (v.sale_date || new Date().toISOString()).slice(0, 4);
  const base = (await db.get('SELECT invoice_prefix FROM company WHERE id = 1'))?.invoice_prefix || 'INV';
  const prefix = `${base}-${year}-`;
  const { n } = await db.get(`SELECT MAX(TRY_CAST(SUBSTRING(invoice_no, ${prefix.length + 1}, 20) AS INT)) n FROM vehicles WHERE invoice_no LIKE ?`, `${prefix}%`);
  await db.run('UPDATE vehicles SET invoice_no=? WHERE id=?', prefix + String((n || 0) + 1).padStart(4, '0'), id);
}

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

// Column list for INSERT / UPDATE (some names, e.g. "condition", are T-SQL keywords)
export const col = c => `[${c}]`;

export async function getVehicle(id) {
  const v = await db.get(`${SELECT_VEHICLE} WHERE v.id = ?`, id);
  if (!v) return null;
  v.images = await db.all('SELECT id, file_name FROM vehicle_images WHERE vehicle_id=? ORDER BY sort, created_at', id);
  // Linked parties (summary only) for the vehicle page
  const party = async pid => (pid && await db.get(`SELECT id, code, name, company_name, category, scope, country, prefecture, city, address,
    postal_code, building, phone, email FROM parties WHERE id = ?`, pid)) || null;
  v.seller = await party(v.seller_party_id);
  v.buyer = await party(v.buyer_party_id);
  return v;
}

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

export async function saveUpload(file) {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type}`);
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export function removeUpload(name) {
  if (!name) return;
  const file = path.join(UPLOAD_DIR, path.basename(name));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export const json = (data, status = 200) => Response.json(data, { status });
export const fail = (e, status = 400) => json({ error: e?.message || String(e) }, status);
