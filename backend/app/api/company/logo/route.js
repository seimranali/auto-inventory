import { db, saveUpload, removeUpload, json, fail, NOW } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

const IMAGE = /^image\/(png|jpeg|webp|gif)$/;

// multipart/form-data with a single "file" (PNG, JPG, WebP or GIF, up to 2 MB)
export const POST = guard('company:manage', async req => {
  const file = (await req.formData()).get('file');
  if (!file || !IMAGE.test(file.type)) return fail('Upload a PNG, JPG, WebP or GIF image');
  if (file.size > 2 * 1024 * 1024) return fail('Logo must be 2 MB or smaller');
  const { logo: old } = await db.get('SELECT logo FROM company WHERE id = 1');
  const name = await saveUpload(file);
  await db.run(`UPDATE company SET logo = ?, updated_at = ${NOW} WHERE id = 1`, name);
  removeUpload(old);
  return json(await db.get('SELECT * FROM company WHERE id = 1'));
});

export const DELETE = guard('company:manage', async () => {
  const { logo } = await db.get('SELECT logo FROM company WHERE id = 1');
  removeUpload(logo);
  await db.run(`UPDATE company SET logo = NULL, updated_at = ${NOW} WHERE id = 1`);
  return json(await db.get('SELECT * FROM company WHERE id = 1'));
});
