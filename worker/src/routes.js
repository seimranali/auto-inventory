// API handlers — one-for-one port of backend/app/api/**/route.js to D1 + R2
import {
  q, json, fail, isUnique, cleanVehicle, cleanParty, partyFormatError, insertParty, assignInvoiceNo, getVehicle,
  saveUpload, removeUpload, FILE_TYPES, SELECT_VEHICLE, COST_SQL, PROFIT_SQL, COMPANY_FIELDS,
} from './db.js';
import {
  guard, can, ROLES, PERMISSIONS, hashPassword, verifyPassword, validatePassword, createSession,
  publicUser, sessionCookie, clearCookie, readCookie, SESSION_COOKIE,
} from './auth.js';
import { reports } from './reports.js';

const body = req => req.json().catch(() => ({}));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------ auth
const LOCK_MAX = 5, LOCK_WINDOW = 15 * 60 * 1000;

export async function login({ req, env }) {
  const Q = q(env.DB);
  const { email = '', password = '' } = await body(req);
  const key = email.trim().toLowerCase();
  const a = await Q.one('SELECT count, first_at FROM login_attempts WHERE email = ?', key);
  const fresh = a && Date.now() - a.first_at < LOCK_WINDOW;
  if (fresh && a.count >= LOCK_MAX) return fail('Too many failed attempts. Try again in 15 minutes.', 429);

  const user = await Q.one('SELECT * FROM users WHERE email = ?', key);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await Q.run(`INSERT INTO login_attempts (email, count, first_at) VALUES (?, 1, ?)
      ON CONFLICT(email) DO UPDATE SET count = CASE WHEN ? - first_at < ? THEN count + 1 ELSE 1 END,
      first_at = CASE WHEN ? - first_at < ? THEN first_at ELSE ? END`,
    key, Date.now(), Date.now(), LOCK_WINDOW, Date.now(), LOCK_WINDOW, Date.now());
    return fail('Incorrect email or password', 401);
  }
  if (!user.active) return fail('This account has been deactivated. Contact your administrator.', 403);

  await Q.run('DELETE FROM login_attempts WHERE email = ?', key);
  await Q.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", user.id);
  const { token, expires } = await createSession(env.DB, user.id);
  return json(publicUser(user), 200, { 'Set-Cookie': sessionCookie(token, expires) });
}

export async function logout({ req, env }) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await q(env.DB).run('DELETE FROM sessions WHERE token = ?', token);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}

export const me = guard(null, async ({ user }) => json(publicUser(user)));

export const updateMe = guard(null, async ({ req, env, user }) => {
  const Q = q(env.DB);
  const b = await body(req);
  if (b.new_password) {
    if (!(await verifyPassword(b.current_password || '', user.password_hash))) return fail('Current password is incorrect');
    const err = validatePassword(b.new_password);
    if (err) return fail(err);
    await Q.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", await hashPassword(b.new_password), user.id);
  }
  if (b.name !== undefined) {
    if (!b.name.trim()) return fail('Name is required');
    await Q.run("UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?", b.name.trim(), b.phone || null, user.id);
  }
  return json(publicUser(await Q.one('SELECT * FROM users WHERE id = ?', user.id)));
});

// ------------------------------------------------------------------ users
const activeAdmins = async Q => (await Q.one("SELECT COUNT(*) n FROM users WHERE role = 'Admin' AND active = 1")).n;

export const listUsers = guard('users:manage', async ({ env }) => json({
  users: (await q(env.DB).all('SELECT * FROM users ORDER BY active DESC, name')).map(publicUser), roles: ROLES, permissions: PERMISSIONS,
}));

export const createUser = guard('users:manage', async ({ req, env }) => {
  const Q = q(env.DB);
  const b = await body(req);
  if (!b.name?.trim() || !b.email?.trim()) return fail('Name and email are required');
  if (!EMAIL.test(b.email.trim())) return fail('Enter a valid email address');
  if (!ROLES[b.role]) return fail('Choose a valid role');
  const err = validatePassword(b.password);
  if (err) return fail(err);
  const id = crypto.randomUUID();
  try {
    await Q.run('INSERT INTO users (id, name, email, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, b.name.trim(), b.email.trim().toLowerCase(), b.phone || null, await hashPassword(b.password), b.role, b.active === false ? 0 : 1);
  } catch (e) {
    return fail(isUnique(e) ? 'A user with this email already exists' : e);
  }
  return json(publicUser(await Q.one('SELECT * FROM users WHERE id = ?', id)), 201);
});

export const updateUser = guard('users:manage', async ({ req, env, params, user: me2 }) => {
  const Q = q(env.DB);
  const u = await Q.one('SELECT * FROM users WHERE id = ?', params.id);
  if (!u) return fail('User not found', 404);
  const b = await body(req);
  const role = b.role ?? u.role;
  const active = b.active === undefined ? !!u.active : !!b.active;
  if (!ROLES[role]) return fail('Choose a valid role');
  if (!b.name?.trim() || !b.email?.trim()) return fail('Name and email are required');
  const losingAdmin = u.role === 'Admin' && u.active && (role !== 'Admin' || !active);
  if (losingAdmin && (await activeAdmins(Q)) <= 1) return fail('At least one active Admin is required');
  if (params.id === me2.id && !active) return fail('You cannot deactivate your own account');
  if (b.password) { const err = validatePassword(b.password); if (err) return fail(err); }
  try {
    await Q.run(`UPDATE users SET name=?, email=?, phone=?, role=?, active=?, updated_at=datetime('now')${b.password ? ', password_hash=?' : ''} WHERE id=?`,
      b.name.trim(), b.email.trim().toLowerCase(), b.phone || null, role, active ? 1 : 0, ...(b.password ? [await hashPassword(b.password)] : []), params.id);
  } catch (e) {
    return fail(isUnique(e) ? 'A user with this email already exists' : e);
  }
  if (!active || b.password) await Q.run('DELETE FROM sessions WHERE user_id = ?', params.id);
  return json(publicUser(await Q.one('SELECT * FROM users WHERE id = ?', params.id)));
});

export const deleteUser = guard('users:manage', async ({ env, params, user: me2 }) => {
  const Q = q(env.DB);
  const u = await Q.one('SELECT * FROM users WHERE id = ?', params.id);
  if (!u) return fail('User not found', 404);
  if (params.id === me2.id) return fail('You cannot delete your own account');
  if (u.role === 'Admin' && u.active && (await activeAdmins(Q)) <= 1) return fail('At least one active Admin is required');
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params.id), env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.id)]);
  return json({ ok: true });
});

// ------------------------------------------------------------------ company
export const getCompany = guard(null, async ({ env }) => json(await q(env.DB).one('SELECT * FROM company WHERE id = 1')));

export const updateCompany = guard('company:manage', async ({ req, env }) => {
  const b = await body(req);
  if (!b.name?.trim()) return fail('Company name is required');
  if (!b.country?.trim()) return fail('Country is required');
  if (b.invoice_prefix && !/^[A-Z0-9-]{1,10}$/i.test(b.invoice_prefix)) return fail('Invoice prefix: up to 10 letters, numbers or dashes');
  if (b.email && !EMAIL.test(b.email)) return fail('Enter a valid email address');
  const fmt = partyFormatError(b);
  if (fmt) return fail(fmt);
  const before = (await q(env.DB).one('SELECT country FROM company WHERE id = 1'))?.country || 'Japan';
  const vals = COMPANY_FIELDS.map(f => (typeof b[f] === 'string' ? b[f].trim() : b[f]) || null);
  const home = b.country.trim();
  const stmts = [env.DB.prepare(`UPDATE company SET ${COMPANY_FIELDS.map(f => `${f}=?`).join(',')}, updated_at=datetime('now') WHERE id=1`).bind(...vals)];
  // "Local" follows the home country: re-scope every party when it changes
  if (home !== before) {
    stmts.push(env.DB.prepare("UPDATE parties SET country = ? WHERE scope = 'Local' AND (country IS NULL OR country = '')").bind(before));
    stmts.push(env.DB.prepare("UPDATE parties SET scope = CASE WHEN country = ? THEN 'Local' ELSE 'International' END").bind(home));
  }
  await env.DB.batch(stmts); // batch = one transaction
  return json(await q(env.DB).one('SELECT * FROM company WHERE id = 1'));
});

// ------------------------------------------------------------------ vehicles
const SALE_FIELDS = new Set(['status', 'sale_type', 'sale_date', 'sale_price', 'sale_expense', 'buyer_name', 'buyer_contact',
  'buyer_address', 'buyer_id_no', 'payment_method', 'amount_received', 'destination_country', 'port', 'shipping_ref', 'sale_notes', 'buyer_party_id']);

export const listVehicles = guard('vehicles:read', async ({ env, url }) => {
  const p = url.searchParams;
  const where = [], args = [];
  if (p.get('status')) { where.push('status = ?'); args.push(p.get('status')); }
  if (p.get('q')) {
    where.push('(stock_no LIKE ? OR chassis_no LIKE ? OR make LIKE ? OR model LIKE ? OR buyer_name LIKE ? OR lot_no LIKE ?)');
    args.push(...Array(6).fill(`%${p.get('q')}%`));
  }
  return json(await q(env.DB).all(`${SELECT_VEHICLE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.created_at DESC`, ...args));
});

export const createVehicle = guard('vehicles:write', async ({ req, env }) => {
  const data = cleanVehicle(await body(req));
  data.status ||= 'In Stock';
  const id = crypto.randomUUID();
  const cols = Object.keys(data);
  try {
    await q(env.DB).run(`INSERT INTO vehicles (id, ${cols.join(',')}) VALUES (?, ${cols.map(() => '?').join(',')})`, id, ...cols.map(c => data[c]));
  } catch (e) {
    return fail(isUnique(e) ? 'Stock No already exists' : e);
  }
  await assignInvoiceNo(env.DB, id);
  return json(await getVehicle(env.DB, id), 201);
});

export const readVehicle = guard('vehicles:read', async ({ env, params }) => {
  const v = await getVehicle(env.DB, params.id);
  return v ? json(v) : fail('Vehicle not found', 404);
});

export const updateVehicle = guard(null, async ({ req, env, params, user }) => {
  if (!(await q(env.DB).one('SELECT 1 x FROM vehicles WHERE id = ?', params.id))) return fail('Vehicle not found', 404);
  const data = cleanVehicle(await body(req));
  if (!can(user, 'vehicles:write')) {
    // Sales role: only the sale fields, and only to mark the vehicle Sold
    if (!can(user, 'sales:write')) return fail('You do not have permission to do this', 403);
    Object.keys(data).forEach(k => SALE_FIELDS.has(k) || delete data[k]);
    if (data.status && data.status !== 'Sold') return fail('You can only record sales', 403);
  }
  const cols = Object.keys(data);
  if (cols.length) {
    try {
      await q(env.DB).run(`UPDATE vehicles SET ${cols.map(c => `${c}=?`).join(',')}, updated_at=datetime('now') WHERE id=?`, ...cols.map(c => data[c]), params.id);
    } catch (e) {
      return fail(isUnique(e) ? 'Stock No already exists' : e);
    }
  }
  await assignInvoiceNo(env.DB, params.id);
  return json(await getVehicle(env.DB, params.id));
});

export const deleteVehicle = guard('vehicles:write', async ({ env, params }) => {
  const v = await getVehicle(env.DB, params.id);
  if (!v) return fail('Vehicle not found', 404);
  await Promise.all([...v.images.map(i => removeUpload(env, i.file_name)), removeUpload(env, v.auction_sheet)]);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM vehicle_images WHERE vehicle_id = ?').bind(v.id),
    env.DB.prepare('DELETE FROM vehicles WHERE id = ?').bind(v.id),
  ]);
  return json({ ok: true });
});

export const uploadImages = guard('vehicles:write', async ({ req, env, params }) => {
  const Q = q(env.DB);
  if (!(await Q.one('SELECT 1 x FROM vehicles WHERE id = ?', params.id))) return fail('Vehicle not found', 404);
  try {
    const files = (await req.formData()).getAll('files');
    let sort = (await Q.one('SELECT COUNT(*) n FROM vehicle_images WHERE vehicle_id=?', params.id)).n;
    for (const f of files) {
      await Q.run('INSERT INTO vehicle_images (id, vehicle_id, file_name, sort) VALUES (?,?,?,?)', crypto.randomUUID(), params.id, await saveUpload(env, f), sort++);
    }
  } catch (e) {
    return fail(e);
  }
  return json(await getVehicle(env.DB, params.id));
});

export const setCover = guard('vehicles:write', async ({ env, params }) => {
  await env.DB.batch([
    env.DB.prepare('UPDATE vehicle_images SET sort = sort + 1 WHERE vehicle_id=?').bind(params.id),
    env.DB.prepare('UPDATE vehicle_images SET sort = 0 WHERE id=? AND vehicle_id=?').bind(params.imageId, params.id),
  ]);
  return json(await getVehicle(env.DB, params.id));
});

export const deleteImage = guard('vehicles:write', async ({ env, params }) => {
  const Q = q(env.DB);
  const img = await Q.one('SELECT * FROM vehicle_images WHERE id=? AND vehicle_id=?', params.imageId, params.id);
  if (!img) return fail('Image not found', 404);
  await removeUpload(env, img.file_name);
  await Q.run('DELETE FROM vehicle_images WHERE id=?', params.imageId);
  return json(await getVehicle(env.DB, params.id));
});

export const uploadSheet = guard('vehicles:write', async ({ req, env, params }) => {
  const v = await q(env.DB).one('SELECT id, auction_sheet FROM vehicles WHERE id = ?', params.id);
  if (!v) return fail('Vehicle not found', 404);
  try {
    const name = await saveUpload(env, (await req.formData()).get('file'));
    await removeUpload(env, v.auction_sheet);
    await q(env.DB).run('UPDATE vehicles SET auction_sheet=? WHERE id=?', name, v.id);
  } catch (e) {
    return fail(e);
  }
  return json(await getVehicle(env.DB, v.id));
});

export const deleteSheet = guard('vehicles:write', async ({ env, params }) => {
  const v = await q(env.DB).one('SELECT id, auction_sheet FROM vehicles WHERE id = ?', params.id);
  if (!v) return fail('Vehicle not found', 404);
  await removeUpload(env, v.auction_sheet);
  await q(env.DB).run('UPDATE vehicles SET auction_sheet=NULL WHERE id=?', v.id);
  return json(await getVehicle(env.DB, v.id));
});

export const getFile = guard('vehicles:read', async ({ env, params }) => {
  const name = params.name.split('/').pop();
  if (!env.UPLOADS) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(name);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || FILE_TYPES[name.split('.').pop()] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=86400', // behind login: browsers may cache, shared caches must not
      ETag: obj.httpEtag,
    },
  });
});

// ------------------------------------------------------------------ options (dropdown suggestions)
const OPTION_FIELDS = ['make', 'model', 'variant', 'color', 'supplier', 'auction_house', 'location', 'buyer_name', 'destination_country', 'port'];

export const options = guard('vehicles:read', async ({ env, params, url }) => {
  const field = params.field;
  if (!OPTION_FIELDS.includes(field)) return fail('Unknown field', 404);
  const p = url.searchParams;
  const where = [`${field} IS NOT NULL`, `${field} <> ''`], args = [];
  if (p.get('q')) { where.push(`${field} LIKE ?`); args.push(`%${p.get('q')}%`); }
  if (field === 'model' && p.get('make')) { where.push('make = ?'); args.push(p.get('make')); }
  const group = field === 'model' ? 'make' : field === 'port' ? 'destination_country' : null;
  const rows = await q(env.DB).all(`SELECT ${field} value, ${group ? `${group} grp,` : ''} COUNT(*) count FROM vehicles
    WHERE ${where.join(' AND ')} GROUP BY ${field}${group ? `, ${group}` : ''} ORDER BY count DESC LIMIT ?`, ...args, Number(p.get('limit')) || 100);
  return json(rows.map(r => ({ value: r.value, label: r.value, count: r.count, group: r.grp || undefined })));
});

// ------------------------------------------------------------------ reports & search
export const report = guard('reports:read', async ({ env, params, url }) => {
  const fn = reports[params.type];
  if (!fn) return fail('Unknown report', 404);
  return json(await fn(q(env.DB), url.searchParams));
});

export const search = guard('vehicles:read', async ({ env, url }) => {
  const Q = q(env.DB);
  const s = (url.searchParams.get('q') || '').trim();
  if (s.length < 2) return json({ vehicles: [], invoices: [], parties: [] });
  const like = `%${s}%`;
  const rank = col => `CASE WHEN ${col} = ? COLLATE NOCASE THEN 0 WHEN ${col} LIKE ? THEN 1 ELSE 2 END`;
  const [vehicles, invoices, parties] = await Promise.all([
    Q.all(`SELECT v.id, v.stock_no, v.chassis_no, v.make, v.model, v.variant, v.year, v.color, v.status, v.lot_no, v.buyer_name,
        (SELECT file_name FROM vehicle_images i WHERE i.vehicle_id = v.id ORDER BY sort, created_at LIMIT 1) cover
      FROM vehicles v
      WHERE v.stock_no LIKE ? OR v.chassis_no LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.variant LIKE ?
        OR (v.make || ' ' || v.model) LIKE ? OR v.lot_no LIKE ? OR v.engine_no LIKE ? OR v.reg_no LIKE ? OR v.color LIKE ? OR CAST(v.year AS TEXT) = ?
      ORDER BY ${rank('v.stock_no')}, ${rank('v.chassis_no')}, v.created_at DESC LIMIT 8`,
    ...Array(10).fill(like), s, s, `${s}%`, s, `${s}%`),
    Q.all(`SELECT v.id, v.invoice_no, v.sale_date, v.sale_price, v.amount_received, v.buyer_name, v.sale_type, v.make, v.model, v.year
      FROM vehicles v WHERE v.status = 'Sold' AND (v.invoice_no LIKE ? OR v.buyer_name LIKE ?)
      ORDER BY ${rank('v.invoice_no')}, v.sale_date DESC LIMIT 5`, like, like, s, `${s}%`),
    Q.all(`SELECT id, code, name, name_kana, company_name, role, scope, country, city, phone, category FROM parties
      WHERE name LIKE ? OR company_name LIKE ? OR name_kana LIKE ? OR code LIKE ? OR phone LIKE ? OR email LIKE ?
        OR corporate_number LIKE ? OR invoice_reg_no LIKE ? OR id_no LIKE ? OR country LIKE ? OR city LIKE ?
      ORDER BY ${rank('code')}, IFNULL(active, 1) DESC, name COLLATE NOCASE LIMIT 6`, ...Array(11).fill(like), s, `${s}%`),
  ]);
  return json({ vehicles, invoices, parties });
});

// ------------------------------------------------------------------ parties
const canEditParties = user => can(user, 'vehicles:write') || can(user, 'sales:write');

function partyError(data, partial) {
  if ((!partial || 'name' in data) && !data.name) return 'Name is required';
  if ((!partial || data.role) && !['Buyer', 'Seller', 'Both'].includes(data.role)) return 'Choose Buyer, Seller or Both';
  if ((!partial || data.scope) && !['Local', 'International'].includes(data.scope)) return 'Choose Local or International';
  if (data.scope === 'International' && (!partial || 'country' in data) && !data.country) return 'Country is required for international parties';
  if (data.email && !EMAIL.test(data.email)) return 'Enter a valid email address';
  return null;
}

export const listParties = guard('vehicles:read', async ({ env, url }) => {
  const p = url.searchParams;
  const where = [], args = [];
  if (p.get('role')) { where.push("(p.role = ? OR p.role = 'Both')"); args.push(p.get('role')); }
  if (p.get('scope')) { where.push('p.scope = ?'); args.push(p.get('scope')); }
  if (p.get('active')) { where.push('IFNULL(p.active, 1) = ?'); args.push(Number(p.get('active'))); }
  if (p.get('q')) {
    where.push('(p.name LIKE ? OR p.company_name LIKE ? OR p.code LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR p.country LIKE ? OR p.city LIKE ?)');
    args.push(...Array(7).fill(`%${p.get('q')}%`));
  }
  return json(await q(env.DB).all(`
    SELECT p.*,
      (SELECT COUNT(*) FROM vehicles v WHERE v.seller_party_id = p.id) bought_count,
      (SELECT IFNULL(SUM(${COST_SQL}),0) FROM vehicles v WHERE v.seller_party_id = p.id) bought_value,
      (SELECT COUNT(*) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') sold_count,
      (SELECT IFNULL(SUM(sale_price),0) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') sold_value,
      (SELECT IFNULL(SUM(sale_price - IFNULL(amount_received,0)),0) FROM vehicles v WHERE v.buyer_party_id = p.id AND v.status = 'Sold') receivable,
      (SELECT MAX(d) FROM (SELECT MAX(purchase_date) d FROM vehicles WHERE seller_party_id = p.id
                           UNION ALL SELECT MAX(sale_date) FROM vehicles WHERE buyer_party_id = p.id)) last_deal
    FROM parties p ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name COLLATE NOCASE`, ...args));
});

export const createParty = guard(null, async ({ req, env, user }) => {
  if (!canEditParties(user)) return fail('You do not have permission to do this', 403);
  const data = cleanParty(await body(req));
  const err = partyError(data, false) || partyFormatError(data);
  if (err) return fail(err);
  const id = await insertParty(env.DB, data);
  return json(await q(env.DB).one('SELECT * FROM parties WHERE id = ?', id), 201);
});

export const readParty = guard('vehicles:read', async ({ env, params }) => {
  const Q = q(env.DB);
  const party = await Q.one('SELECT * FROM parties WHERE id = ?', params.id);
  if (!party) return fail('Party not found', 404);
  const [purchases, sales, purchaseTotals, saleTotals] = await Promise.all([
    Q.all(`${SELECT_VEHICLE} WHERE v.seller_party_id = ? ORDER BY v.purchase_date DESC`, params.id),
    Q.all(`${SELECT_VEHICLE} WHERE v.buyer_party_id = ? AND v.status = 'Sold' ORDER BY v.sale_date DESC`, params.id),
    Q.one(`SELECT COUNT(*) count, IFNULL(SUM(${COST_SQL}),0) value FROM vehicles WHERE seller_party_id = ?`, params.id),
    Q.one(`SELECT COUNT(*) count, IFNULL(SUM(sale_price),0) value, IFNULL(SUM(${PROFIT_SQL}),0) profit,
      IFNULL(SUM(IFNULL(amount_received,0)),0) received FROM vehicles WHERE buyer_party_id = ? AND status = 'Sold'`, params.id),
  ]);
  saleTotals.receivable = saleTotals.value - saleTotals.received;
  return json({ party, purchases, sales, totals: { purchases: purchaseTotals, sales: saleTotals } });
});

export const updateParty = guard(null, async ({ req, env, params, user }) => {
  if (!canEditParties(user)) return fail('You do not have permission to do this', 403);
  const Q = q(env.DB);
  const current = await Q.one('SELECT * FROM parties WHERE id = ?', params.id);
  if (!current) return fail('Party not found', 404);
  const data = cleanParty(await body(req));
  const err = partyError(data, true) || partyFormatError({ ...current, ...data });
  if (err) return fail(err);
  const cols = Object.keys(data);
  if (cols.length) await Q.run(`UPDATE parties SET ${cols.map(c => `${c}=?`).join(',')}, updated_at=datetime('now') WHERE id=?`, ...cols.map(c => data[c]), params.id);
  return json(await Q.one('SELECT * FROM parties WHERE id = ?', params.id));
});

export const deleteParty = guard('vehicles:write', async ({ env, params }) => {
  const Q = q(env.DB);
  const used = (await Q.one('SELECT COUNT(*) n FROM vehicles WHERE buyer_party_id = ? OR seller_party_id = ?', params.id, params.id)).n;
  if (used) return fail(`This party is linked to ${used} vehicle${used > 1 ? 's' : ''}. Mark it inactive instead.`, 409);
  await Q.run('DELETE FROM parties WHERE id = ?', params.id);
  return json({ ok: true });
});
