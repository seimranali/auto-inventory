// Single-file release entry for manual upload in the Cloudflare dashboard.
// The React build is embedded (generated ./embedded-assets.js), so no static-assets upload is needed:
// env.ASSETS is replaced by an in-memory server with SPA fallback.
import app from './index.js';
import FILES from './embedded-assets.js';

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml', json: 'application/json', txt: 'text/plain; charset=utf-8', ico: 'image/x-icon', png: 'image/png',
};

function serveAsset(req) {
  const { pathname } = new URL(req.url);
  let path = pathname === '/' ? '/index.html' : pathname;
  let file = FILES[path];
  // SPA routing: unknown non-file paths get index.html
  if (!file && !/\.[a-z0-9]+$/i.test(path)) { path = '/index.html'; file = FILES[path]; }
  if (!file) return new Response('Not found', { status: 404 });
  const ext = path.split('.').pop();
  const body = file.b64 ? Uint8Array.from(atob(file.data), c => c.charCodeAt(0)) : file.data;
  return new Response(body, {
    headers: {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      // Vite file names are content-hashed → cache forever; HTML always revalidates
      'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}

export default {
  fetch(req, env, ctx) {
    return app.fetch(req, { ...env, ASSETS: { fetch: serveAsset } }, ctx);
  },
};
