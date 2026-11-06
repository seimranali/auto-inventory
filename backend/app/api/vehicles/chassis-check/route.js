import { chassisMatches, json } from '@/lib/db';
import { guard } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/vehicles/chassis-check?chassis=FD3HJA-14597&id=<vehicle being edited>
// → { inStock: vehicle | null, sold: [vehicles] }  (for the live hint on the Buying form)
export const GET = guard('vehicles:read', async req => {
  const p = new URL(req.url).searchParams;
  return json(await chassisMatches(p.get('chassis'), p.get('id') || ''));
});
