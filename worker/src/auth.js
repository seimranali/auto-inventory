// Auth for the Worker: PBKDF2 (WebCrypto) passwords, opaque session tokens in an httpOnly cookie, fixed roles.
import { q, fail } from './db.js';

export const PERMISSIONS = {
  'vehicles:read': 'View inventory and vehicle details',
  'vehicles:write': 'Add, edit and delete vehicles, images and auction sheets',
  'sales:write': 'Record sales and edit sale details',
  'reports:read': 'View dashboard, profit and stock reports',
  'company:manage': 'Edit company profile',
  'users:manage': 'Add, edit and deactivate users',
};
export const ROLES = {
  Admin: { description: 'Full access, including users and company settings', permissions: Object.keys(PERMISSIONS) },
  Manager: { description: 'Runs day-to-day buying, selling and reporting', permissions: ['vehicles:read', 'vehicles:write', 'sales:write', 'reports:read'] },
  Sales: { description: 'Views stock and records sales; no profit reports', permissions: ['vehicles:read', 'sales:write'] },
  Viewer: { description: 'Read-only access to stock and reports', permissions: ['vehicles:read', 'reports:read'] },
};
export const can = (user, perm) => !!user && (ROLES[user.role]?.permissions || []).includes(perm);

// ---- Passwords: pbkdf2$<iterations>$<salt hex>$<hash hex> (100k is the Workers PBKDF2 maximum) ----
const ITER = 100000;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${hex(salt)}$${hex(await derive(password, salt, ITER))}`;
}
export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = (stored || '').split('$');
  if (alg !== 'pbkdf2' || !salt || !hash) return false;
  const a = unhex(hash), b = new Uint8Array(await derive(password, unhex(salt), Number(iter)));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; // constant-time compare
  return diff === 0;
}
export const validatePassword = p => (!p || p.length < 8 ? 'Password must be at least 8 characters' : null);

// ---- Sessions ----
export const SESSION_COOKIE = 'ai_session';
const SESSION_DAYS = 7;

export function readCookie(req, name) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
export const sessionCookie = (token, expires) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`;
export const clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function createSession(db, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.batch([
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expires.toISOString()),
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()),
  ]);
  return { token, expires };
}

export async function currentUser(env, req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  return q(env.DB).one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`, token, new Date().toISOString());
}

export const publicUser = u => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: !!u.active,
  last_login: u.last_login, created_at: u.created_at, permissions: ROLES[u.role]?.permissions || [],
});

/** Route wrapper: 401 when signed out, 403 without the permission. handler(ctx) gets { req, env, params, user, url } */
export const guard = (perm, handler) => async ctx => {
  const user = await currentUser(ctx.env, ctx.req);
  if (!user) return fail('Please log in', 401);
  if (perm && !can(user, perm)) return fail('You do not have permission to do this', 403);
  return handler({ ...ctx, user });
};

// First request on an empty database: create the initial admin from secrets (or the documented default)
export async function ensureAdmin(env) {
  const Q = q(env.DB);
  if (await Q.one('SELECT 1 x FROM users LIMIT 1')) return;
  await Q.run('INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    crypto.randomUUID(), 'Administrator', (env.ADMIN_EMAIL || 'admin@autoinventory.local').toLowerCase(),
    await hashPassword(env.ADMIN_PASSWORD || 'admin123'), 'Admin');
}
