import { db, json, fail, isUnique, NOW } from '@/lib/db';
import { guard, publicUser, hashPassword, validatePassword, ROLES } from '@/lib/auth';

export const runtime = 'nodejs';

const activeAdmins = async () => (await db.get("SELECT COUNT(*) n FROM users WHERE role = 'Admin' AND active = 1")).n;

// { name, email, phone, role, active, password? }
export const PUT = guard('users:manage', async (req, { params }, me) => {
  const { id } = await params;
  const u = await db.get('SELECT * FROM users WHERE id = ?', id);
  if (!u) return fail('User not found', 404);
  const b = await req.json();
  const role = b.role ?? u.role;
  const active = b.active === undefined ? !!u.active : !!b.active;
  if (!ROLES[role]) return fail('Choose a valid role');
  if (!b.name?.trim() || !b.email?.trim()) return fail('Name and email are required');

  // Never lock everyone out: the last active admin can't be demoted or deactivated
  const losingAdmin = u.role === 'Admin' && u.active && (role !== 'Admin' || !active);
  if (losingAdmin && await activeAdmins() <= 1) return fail('At least one active Admin is required');
  if (id === me.id && !active) return fail('You cannot deactivate your own account');

  if (b.password) {
    const err = validatePassword(b.password);
    if (err) return fail(err);
  }
  try {
    await db.run(`UPDATE users SET name=?, email=?, phone=?, role=?, active=?, updated_at=${NOW}${b.password ? ', password_hash=?' : ''} WHERE id=?`,
      b.name.trim(), b.email.trim().toLowerCase(), b.phone || null, role, active ? 1 : 0, ...(b.password ? [hashPassword(b.password)] : []), id);
  } catch (e) {
    return fail(isUnique(e) ? 'A user with this email already exists' : e);
  }
  // Deactivation or password reset signs the user out everywhere
  if (!active || b.password) await db.run('DELETE FROM sessions WHERE user_id = ?', id);
  return json(publicUser(await db.get('SELECT * FROM users WHERE id = ?', id)));
});

export const DELETE = guard('users:manage', async (_req, { params }, me) => {
  const { id } = await params;
  const u = await db.get('SELECT * FROM users WHERE id = ?', id);
  if (!u) return fail('User not found', 404);
  if (id === me.id) return fail('You cannot delete your own account');
  if (u.role === 'Admin' && u.active && await activeAdmins() <= 1) return fail('At least one active Admin is required');
  await db.run('DELETE FROM users WHERE id = ?', id);
  return json({ ok: true });
});
