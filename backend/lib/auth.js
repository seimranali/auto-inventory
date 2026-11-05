import crypto from 'crypto';
import { cookies } from 'next/headers';
import { db, fail } from './db';

export { hashPassword, verifyPassword, validatePassword } from './password';

// ---- Roles & permissions (fixed; enforced on every API route) ----
export const PERMISSIONS = {
  'vehicles:read': 'View inventory and vehicle details',
  'vehicles:write': 'Add, edit and delete vehicles, images and auction sheets',
  'sales:write': 'Record sales and edit sale details',
  'reports:read': 'View dashboard, profit and stock reports',
  'accounts:manage': 'Record cash, expenses and card payments; view ledgers',
  'company:manage': 'Edit company profile',
  'users:manage': 'Add, edit and deactivate users',
};

export const ROLES = {
  Admin: { description: 'Full access, including users and company settings', permissions: Object.keys(PERMISSIONS) },
  Manager: { description: 'Runs day-to-day buying, selling and reporting', permissions: ['vehicles:read', 'vehicles:write', 'sales:write', 'reports:read', 'accounts:manage'] },
  Accountant: { description: 'Cash book, expenses and ledgers; reads stock and reports', permissions: ['vehicles:read', 'reports:read', 'accounts:manage'] },
  Sales: { description: 'Views stock and records sales; no profit reports', permissions: ['vehicles:read', 'sales:write'] },
  Viewer: { description: 'Read-only access to stock and reports', permissions: ['vehicles:read', 'reports:read'] },
};

export const can = (user, perm) => !!user && (ROLES[user.role]?.permissions || []).includes(perm);

// ---- Sessions (opaque token in an httpOnly cookie) ----
export const SESSION_COOKIE = 'ai_session';
const SESSION_DAYS = 7;

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires.toISOString());
  await db.run('DELETE FROM sessions WHERE expires_at < ?', new Date().toISOString());
  return { token, expires };
}

export const publicUser = u => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: !!u.active,
  last_login: u.last_login, created_at: u.created_at, permissions: ROLES[u.role]?.permissions || [],
});

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const u = await db.get(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`, token, new Date().toISOString());
  return u || null;
}

/**
 * Wraps a route handler: 401 when not logged in, 403 without the permission.
 * export const GET = guard('vehicles:read', async (req, ctx, user) => ...)
 */
export function guard(perm, handler) {
  return async (req, ctx) => {
    try {
      const user = await currentUser();
      if (!user) return fail('Please log in', 401);
      if (perm && !can(user, perm)) return fail('You do not have permission to do this', 403);
      return await handler(req, ctx, user);
    } catch (e) {
      console.error(e);
      return fail(e, 500);
    }
  };
}
