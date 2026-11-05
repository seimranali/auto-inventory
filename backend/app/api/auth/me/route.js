import { db, json, fail, NOW } from '@/lib/db';
import { guard, publicUser, hashPassword, verifyPassword, validatePassword } from '@/lib/auth';

export const runtime = 'nodejs';

// Current user (any logged-in role)
export const GET = guard(null, async (_req, _ctx, user) => json(publicUser(user)));

// Update own profile / change own password: { name, phone, current_password, new_password }
export const PUT = guard(null, async (req, _ctx, user) => {
  const b = await req.json();
  if (b.new_password) {
    if (!verifyPassword(b.current_password || '', user.password_hash)) return fail('Current password is incorrect');
    const err = validatePassword(b.new_password);
    if (err) return fail(err);
    await db.run(`UPDATE users SET password_hash = ?, updated_at = ${NOW} WHERE id = ?`, hashPassword(b.new_password), user.id);
  }
  if (b.name !== undefined) {
    if (!b.name.trim()) return fail('Name is required');
    await db.run(`UPDATE users SET name = ?, phone = ?, updated_at = ${NOW} WHERE id = ?`, b.name.trim(), b.phone || null, user.id);
  }
  return json(publicUser(await db.get('SELECT * FROM users WHERE id = ?', user.id)));
});
