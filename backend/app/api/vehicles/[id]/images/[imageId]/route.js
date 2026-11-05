import { db, getVehicle, removeUpload, json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// Make this image the cover photo
export const PATCH = guard('vehicles:write', async (_req, { params }) => {
  const { id, imageId } = await params;
  await db.run('UPDATE vehicle_images SET sort = sort + 1 WHERE vehicle_id=?', id);
  await db.run('UPDATE vehicle_images SET sort = 0 WHERE id=? AND vehicle_id=?', imageId, id);
  return json(await getVehicle(id));
});

export const DELETE = guard('vehicles:write', async (_req, { params }) => {
  const { id, imageId } = await params;
  const img = await db.get('SELECT * FROM vehicle_images WHERE id=? AND vehicle_id=?', imageId, id);
  if (!img) return fail('Image not found', 404);
  removeUpload(img.file_name);
  await db.run('DELETE FROM vehicle_images WHERE id=?', imageId);
  return json(await getVehicle(id));
});
