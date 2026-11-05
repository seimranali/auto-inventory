import { db, json, fail, NOW } from '@/lib/db';
import { verifyPassword, createSession, publicUser, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

// Basic brute-force protection: 5 failed attempts per email per 15 minutes
const attempts = globalThis.__loginAttempts || (globalThis.__loginAttempts = new Map());
const WINDOW = 15 * 60 * 1000, MAX = 5;

export async function POST(req) {
  const { email = '', password = '' } = await req.json().catch(() => ({}));
  const key = email.trim().toLowerCase();
  const a = attempts.get(key);
  if (a && a.count >= MAX && Date.now() - a.first < WINDOW) {
    return fail('Too many failed attempts. Try again in 15 minutes.', 429);
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', key);
    if (!user || !verifyPassword(password, user.password_hash)) {
      const cur = a && Date.now() - a.first < WINDOW ? a : { count: 0, first: Date.now() };
      attempts.set(key, { ...cur, count: cur.count + 1 });
      return fail('Incorrect email or password', 401);
    }
    if (!user.active) return fail('This account has been deactivated. Contact your administrator.', 403);

    attempts.delete(key);
    await db.run(`UPDATE users SET last_login = ${NOW} WHERE id = ?`, user.id);
    const { token, expires } = await createSession(user.id);
    const res = json(publicUser(user));
    res.headers.append('Set-Cookie',
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return res;
  } catch (e) {
    console.error(e);
    return fail(e, 500);
  }
}
