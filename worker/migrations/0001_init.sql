-- Auto Inventory: full schema for Cloudflare D1 (mirrors backend/lib/db.js)

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  stock_no TEXT, chassis_no TEXT, engine_no TEXT, make TEXT, model TEXT, variant TEXT,
  year INTEGER, reg_year INTEGER, reg_no TEXT, color TEXT, mileage INTEGER, engine_cc INTEGER,
  fuel TEXT, transmission TEXT, body_type TEXT, drive TEXT, seats INTEGER, doors INTEGER, steering TEXT,
  condition TEXT, features TEXT,
  purchase_date TEXT, purchase_source TEXT, supplier TEXT, auction_house TEXT, lot_no TEXT, auction_date TEXT,
  purchase_price REAL, freight_cost REAL, duty_tax REAL, repair_cost REAL, other_cost REAL,
  auction_grade TEXT, interior_grade TEXT, exterior_grade TEXT, auction_remarks TEXT,
  status TEXT, location TEXT, asking_price REAL,
  sale_type TEXT, sale_date TEXT, buyer_name TEXT, buyer_contact TEXT, destination_country TEXT, port TEXT,
  sale_price REAL, sale_expense REAL, buyer_address TEXT, buyer_id_no TEXT, payment_method TEXT, amount_received REAL,
  invoice_no TEXT, shipping_ref TEXT, sale_notes TEXT,
  seller_party_id TEXT, buyer_party_id TEXT,
  notes TEXT,
  auction_sheet TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicles_stock ON vehicles(stock_no) WHERE stock_no IS NOT NULL AND stock_no <> '';
CREATE INDEX IF NOT EXISTS ix_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS ix_vehicles_buyer ON vehicles(buyer_party_id);
CREATE INDEX IF NOT EXISTS ix_vehicles_seller ON vehicles(seller_party_id);
CREATE INDEX IF NOT EXISTS ix_vehicles_invoice ON vehicles(invoice_no);

CREATE TABLE IF NOT EXISTS vehicle_images (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_images_vehicle ON vehicle_images(vehicle_id);

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY, code TEXT UNIQUE,
  role TEXT, category TEXT, scope TEXT,
  name TEXT, company_name TEXT, contact_person TEXT, designation TEXT,
  phone TEXT, alt_phone TEXT, whatsapp TEXT, email TEXT, website TEXT,
  id_type TEXT, id_no TEXT, ntn TEXT, strn TEXT,
  country TEXT, state TEXT, city TEXT, address TEXT, postal_code TEXT, port TEXT,
  currency TEXT, bank_name TEXT, account_title TEXT, account_no TEXT, iban TEXT, swift TEXT,
  credit_limit REAL, notes TEXT, active REAL,
  name_kana TEXT, prefecture TEXT, building TEXT, corporate_number TEXT, invoice_reg_no TEXT,
  antique_license TEXT, antique_license_authority TEXT, auction_member_no TEXT,
  bank_branch TEXT, bank_branch_code TEXT, account_type TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);

CREATE TABLE IF NOT EXISTS company (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL, name_kana TEXT, name_en TEXT, tagline TEXT, representative TEXT, country TEXT DEFAULT 'Japan',
  postal_code TEXT, prefecture TEXT, city TEXT, address TEXT, building TEXT,
  phone TEXT, fax TEXT, email TEXT, website TEXT,
  ntn TEXT, corporate_number TEXT, invoice_reg_no TEXT, antique_license TEXT, antique_license_authority TEXT, auction_memberships TEXT,
  bank_name TEXT, bank_branch TEXT, bank_branch_code TEXT, account_type TEXT, account_no TEXT, account_title TEXT, swift TEXT,
  currency TEXT DEFAULT 'JPY', invoice_prefix TEXT DEFAULT 'INV', terms TEXT, updated_at TEXT
);
INSERT OR IGNORE INTO company (id, name, country, currency, invoice_prefix, terms)
VALUES (1, 'Auto Inventory', 'Japan', 'JPY', 'INV', 'Vehicles are sold on an "as is" basis.');

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, phone TEXT,
  password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER DEFAULT 1,
  last_login TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);

-- Failed sign-ins per email (brute-force protection; in-memory maps don't work across Worker isolates)
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY, count INTEGER NOT NULL, first_at INTEGER NOT NULL
);
