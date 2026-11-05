import crypto from 'crypto';
import { db, getVehicle, saveUpload, json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// multipart/form-data with one or more "files"
export const POST = guard('vehicles:write', async (req, { params }) => {
  const { id } = await params;
  if (!await db.get('SELECT 1 x FROM vehicles WHERE id = ?', id)) return fail('Vehicle not found', 404);
  try {
    const files = (await req.formData()).getAll('files');
    let { n: sort } = await db.get('SELECT COUNT(*) n FROM vehicle_images WHERE vehicle_id=?', id);
    for (const f of files) {
      await db.run('INSERT INTO vehicle_images (id, vehicle_id, file_name, sort) VALUES (?,?,?,?)', crypto.randomUUID(), id, await saveUpload(f), sort++);
    }
    return json(await getVehicle(id));
  } catch (e) {
    return fail(e);
  }
});
