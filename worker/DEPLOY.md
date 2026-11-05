# Deploying Auto Inventory to Cloudflare Workers (D1 + R2)

One Worker serves everything:

| Path | Served by |
|---|---|
| `/api/*` | Worker code in `src/` — D1 for data, R2 for photos & auction sheets |
| everything else | The React build (`frontend/dist`) as static assets, with SPA fallback |

The local Next.js backend (`/backend`) is unchanged and still used for development.

## 1. One-time setup

```bash
cd worker
npm install
npx wrangler login

npx wrangler d1 create auto-inventory          # copy the database_id it prints
npx wrangler r2 bucket create autoinventory
```

Put the `database_id` and the bucket name into `wrangler.jsonc` (`d1_databases` and `r2_buckets`).
The current config points at the Noviq Technologies account (D1 `a4479f94-…`, bucket `autoinventory`).

## 2. Create the tables

```bash
npm run db:migrate          # applies migrations/0001_init.sql to the remote D1 database
```

## 3. Load data (choose one)

**Demo data** (Harukaze Motors, 30 vehicles, 19 parties, demo users):

```bash
npm run seed:demo
```

**Your local data** instead:

```bash
node scripts/export-seed.mjs --admin-password=YOUR-STRONG-PASSWORD --user-password=TEMP-PASSWORD
npx wrangler d1 execute auto-inventory --remote --file=seed/seed.sql
```

Both commands **replace all data** in the D1 database. Local passwords can't be carried over (Workers use PBKDF2,
the local backend uses scrypt), so users get the passwords you pass in. Photos are not exported — re-upload them,
or copy `backend/data/uploads/*` into the R2 bucket keeping the same file names.

**Empty start:** skip this step. On the first request the Worker creates an Admin from the
`ADMIN_EMAIL` / `ADMIN_PASSWORD` secrets (step 4), or `admin@autoinventory.local` / `admin123` if they're not set.

## 4. Secrets (recommended before the first request on an empty database)

```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

## 5. Deploy

```bash
npm run deploy              # builds the frontend, then wrangler deploy
```

The URL is printed at the end (`https://auto-inventory.<your-subdomain>.workers.dev`).
Add a custom domain under **Workers & Pages → auto-inventory → Settings → Domains & Routes**.

**Sign in and change the Admin password immediately** (user menu → My Profile).

## Test locally on the Workers runtime

```bash
npm run db:migrate:local
npm run seed:demo:local
npm run dev                 # http://localhost:8787 (local D1 + R2 emulation)
```

## Updating

- Code changes: `npm run deploy`
- Schema changes: add `migrations/0002_….sql`, then `npm run db:migrate` before deploying

## Notes

- **Security:** session cookie is `HttpOnly; Secure; SameSite=Lax`; non-GET API calls from another origin are rejected;
  failed sign-ins are rate-limited in D1 (5 per email per 15 min); every API route checks the user's role.
- **Limits:** uploads are capped at 15 MB per file. Free-plan D1 allows 5 GB storage / 5M rows read per day.
- **Time zone:** Workers run in UTC. Dates are stored as entered; only "this month" on the dashboard uses the server clock.
