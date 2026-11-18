import { db, saveUpload, removeUpload, json, fail, NOW } from '@/lib/db';
import { guard } from '@/lib/auth';
import { getCompany } from '@/lib/companies';

export const runtime = 'nodejs';

const IMAGE = /^image\/(png|jpeg|webp|gif)$/;

// multipart/form-data with a single "file" (PNG, JPG, WebP or GIF, up to 2 MB)
export const POST = guard('company:manage', async (req, { params }) => {
  const id = Number((await params).id);
  const c = await getCompany(id);
  if (!c) return fail('Company not found', 404);
  const file = (await req.formData()).get('file');
  if (!file || !IMAGE.test(file.type)) return fail('Upload a PNG, JPG, WebP or GIF image');
  if (file.size > 2 * 1024 * 1024) return fail('Logo must be 2 MB or smaller');
  const name = await saveUpload(file);
  await db.run(`UPDATE company SET logo = ?, updated_at = ${NOW} WHERE id = ?`, name, id);
  removeUpload(c.logo);
  return json(await getCompany(id));
});

export const DELETE = guard('company:manage', async (_req, { params }) => {
  const id = Number((await params).id);
  const c = await getCompany(id);
  if (!c) return fail('Company not found', 404);
  removeUpload(c.logo);
  await db.run(`UPDATE company SET logo = NULL, updated_at = ${NOW} WHERE id = ?`, id);
  return json(await getCompany(id));
});
