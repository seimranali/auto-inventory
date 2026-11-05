import { db, getVehicle, saveUpload, removeUpload, json, fail } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// multipart/form-data with a single "file" (image or PDF)
export const POST = guard('vehicles:write', async (req, { params }) => {
  const v = await getVehicle((await params).id);
  if (!v) return fail('Vehicle not found', 404);
  try {
    const file = (await req.formData()).get('file');
    const name = await saveUpload(file);
    removeUpload(v.auction_sheet);
    await db.run('UPDATE vehicles SET auction_sheet=? WHERE id=?', name, v.id);
    return json(await getVehicle(v.id));
  } catch (e) {
    return fail(e);
  }
});

export const DELETE = guard('vehicles:write', async (_req, { params }) => {
  const v = await getVehicle((await params).id);
  if (!v) return fail('Vehicle not found', 404);
  removeUpload(v.auction_sheet);
  await db.run('UPDATE vehicles SET auction_sheet=NULL WHERE id=?', v.id);
  return json(await getVehicle(v.id));
});
