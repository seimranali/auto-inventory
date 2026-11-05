import fs from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };

export const GET = guard('vehicles:read', async (_req, { params }) => {
  const name = path.basename((await params).name);
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), {
    // private: files sit behind login, so shared caches must not store them
    headers: { 'Content-Type': TYPES[name.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' },
  });
});
