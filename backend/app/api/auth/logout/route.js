import { cookies } from 'next/headers';
import { db, json } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.run('DELETE FROM sessions WHERE token = ?', token).catch(console.error);
  const res = json({ ok: true });
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
