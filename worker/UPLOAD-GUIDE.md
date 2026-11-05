# Manual upload to Cloudflare (dashboard only)

Files in this folder:

| File | What it is |
|---|---|
| `worker.js` | The whole app in one file: API + website |
| `1-schema.sql` | Creates the database tables — run first |
| `2-demo-data.sql` | Optional demo data (Harukaze Motors). **Replaces all data.** |

You need three things in Cloudflare: a **D1 database**, an **R2 bucket**, and a **Worker**.

---

## Step 1 — D1 database

1. Dashboard → **Storage & Databases → D1 SQL Database**.
2. Open **auto-inventory** (or **Create database** with that name).
3. Open the **Console** tab.
4. Open `1-schema.sql` in Notepad, copy everything, paste into the console, click **Execute**.
5. *(Optional demo data)* Do the same with `2-demo-data.sql`.
   - Demo Admin login: `admin@autoinventory.local` / `admin123` (or the password used when building)
   - Demo staff: `manager@ / sales@ / viewer@harukaze.example`, password `demo1234`

> If the console rejects a long paste, run it from a terminal instead:
> `npx wrangler d1 execute auto-inventory --remote --file=2-demo-data.sql`

## Step 2 — R2 bucket (photos & auction sheets)

1. Dashboard → **R2 Object Storage**. If asked, click **Enable R2** (free tier; Cloudflare asks for a payment method).
2. **Create bucket** → name `auto-inventory-uploads` → **Create**.

## Step 3 — Worker

1. Dashboard → **Workers & Pages → Create → Create Worker** (“Start with Hello World”).
2. Name it `auto-inventory` → **Deploy**.
3. Click **Edit code**. Delete everything in the editor, paste the full contents of `worker.js`, click **Deploy**.

## Step 4 — Connect the database and bucket

Worker → **Settings → Bindings → Add**:

| Type | Variable name (exactly) | Choose |
|---|---|---|
| **D1 database** | `DB` | auto-inventory |
| **R2 bucket** | `UPLOADS` | auto-inventory-uploads |

Each binding saves and redeploys automatically.

## Step 5 — Admin password (only if you did NOT load demo data)

Worker → **Settings → Variables and Secrets → Add**:

| Type | Name | Value |
|---|---|---|
| Secret | `ADMIN_PASSWORD` | the password you want (8+ characters) |
| Text *(optional)* | `ADMIN_EMAIL` | your login email (default `admin@autoinventory.local`) |

The Admin account is created from these on the first visit to an empty database.

## Step 6 — Open the app

Open the Worker URL (`https://auto-inventory.<your-subdomain>.workers.dev`), sign in, then
**change the Admin password** (user menu → My Profile).

Custom domain: Worker → **Settings → Domains & Routes → Add → Custom domain**.

---

### Troubleshooting

| Message | Fix |
|---|---|
| “Server not configured: add the D1 binding…” | Bindings missing or misnamed — must be exactly `DB` and `UPLOADS` (Step 4) |
| “Database not initialised: run 1-schema.sql…” | Run `1-schema.sql` in the D1 console (Step 1) |
| Photos fail to upload | R2 bucket missing or `UPLOADS` binding not added (Steps 2 & 4) |
| Can't sign in with admin123 | Demo data not loaded → use your `ADMIN_PASSWORD` secret, or load `2-demo-data.sql` |

Logs: Worker → **Logs** (live tail) shows each failing request.

### Updating to a new release
Worker → **Edit code** → paste the new `worker.js` → **Deploy**. Your data stays in D1/R2.
