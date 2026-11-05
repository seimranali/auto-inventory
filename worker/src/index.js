// Auto Inventory — Cloudflare Worker entry.
// /api/* → handlers below (D1 + R2). Everything else → the React build (static assets, SPA fallback).
import * as R from './routes.js';
import { ensureAdmin } from './auth.js';
import { fail } from './db.js';

// [method, pattern, handler]; :params become ctx.params
const ROUTES = [
  ['POST', '/api/auth/login', R.login],
  ['POST', '/api/auth/logout', R.logout],
  ['GET', '/api/auth/me', R.me],
  ['PUT', '/api/auth/me', R.updateMe],

  ['GET', '/api/users', R.listUsers],
  ['POST', '/api/users', R.createUser],
  ['PUT', '/api/users/:id', R.updateUser],
  ['DELETE', '/api/users/:id', R.deleteUser],

  ['GET', '/api/company', R.getCompany],
  ['PUT', '/api/company', R.updateCompany],

  ['GET', '/api/vehicles', R.listVehicles],
  ['POST', '/api/vehicles', R.createVehicle],
  ['GET', '/api/vehicles/:id', R.readVehicle],
  ['PUT', '/api/vehicles/:id', R.updateVehicle],
  ['DELETE', '/api/vehicles/:id', R.deleteVehicle],
  ['POST', '/api/vehicles/:id/images', R.uploadImages],
  ['PATCH', '/api/vehicles/:id/images/:imageId', R.setCover],
  ['DELETE', '/api/vehicles/:id/images/:imageId', R.deleteImage],
  ['POST', '/api/vehicles/:id/auction-sheet', R.uploadSheet],
  ['DELETE', '/api/vehicles/:id/auction-sheet', R.deleteSheet],
  ['GET', '/api/files/:name', R.getFile],

  ['GET', '/api/options/:field', R.options],
  ['GET', '/api/reports/:type', R.report],
  ['GET', '/api/search', R.search],

  ['GET', '/api/parties', R.listParties],
  ['POST', '/api/parties', R.createParty],
  ['GET', '/api/parties/:id', R.readParty],
  ['PUT', '/api/parties/:id', R.updateParty],
  ['DELETE', '/api/parties/:id', R.deleteParty],
].map(([method, pattern, handler]) => ({
  method, handler,
  re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

let adminChecked = false;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    // Reject cross-site state changes (cookie auth): Origin must match this host when present
    const origin = req.headers.get('Origin');
    if (req.method !== 'GET' && origin && new URL(origin).host !== url.host) return fail('Cross-origin request blocked', 403);

    if (!env.DB) return fail('Server not configured: add the D1 binding "DB" (Worker → Settings → Bindings).', 500);
    if (!adminChecked) {
      try {
        await ensureAdmin(env);
        adminChecked = true;
      } catch (e) {
        console.error('ensureAdmin', e);
        return fail(/no such table/i.test(e.message)
          ? 'Database not initialised: run 1-schema.sql in the D1 console (or `npm run db:migrate`).'
          : 'Database unavailable. Please try again.', 500);
      }
    }

    let res;
    const path = url.pathname.replace(/\/+$/, '');
    const match = ROUTES.map(r => ({ r, m: r.re.exec(path) })).filter(x => x.m);
    if (!match.length) res = fail('Unknown endpoint', 404);
    else {
      const hit = match.find(x => x.r.method === req.method);
      if (!hit) res = fail('Method not allowed', 405);
      else {
        const params = Object.fromEntries(Object.entries(hit.m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
        try {
          res = await hit.r.handler({ req, env, url, params });
        } catch (e) {
          console.error(req.method, path, e);
          res = fail('Something went wrong. Please try again.', 500);
        }
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    if (!out.headers.has('Cache-Control')) out.headers.set('Cache-Control', 'no-store');
    return out;
  },
};
