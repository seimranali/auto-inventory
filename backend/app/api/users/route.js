import crypto from 'crypto';
import { db, json, fail, isUnique } from '@/lib/db';
import { guard, publicUser, hashPassword, validatePassword, ROLES, PERMISSIONS } from '@/lib/auth';

export const runtime = 'nodejs';

export const GET = guard('users:manage', async () => json({
  users: (await db.all('SELECT * FROM users ORDER BY active DESC, name')).map(publicUser),
  roles: ROLES,
  permissions: PERMISSIONS,
}));

export const POST = guard('users:manage', async req => {
  const b = await req.json();
  if (!b.name?.trim() || !b.email?.trim()) return fail('Name and email are required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) return fail('Enter a valid email address');
  if (!ROLES[b.role]) return fail('Choose a valid role');
  const err = validatePassword(b.password);
  if (err) return fail(err);
  try {
    const id = crypto.randomUUID();
    await db.run('INSERT INTO users (id, name, email, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, b.name.trim(), b.email.trim().toLowerCase(), b.phone || null, hashPassword(b.password), b.role, b.active === false ? 0 : 1);
    return json(publicUser(await db.get('SELECT * FROM users WHERE id = ?', id)), 201);
  } catch (e) {
    return fail(isUnique(e) ? 'A user with this email already exists' : e);
  }
});
