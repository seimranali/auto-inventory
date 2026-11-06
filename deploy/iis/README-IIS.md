# Auto Inventory on IIS

The release has two parts, each in its own folder:

| Folder | In IIS | What it is |
|---|---|---|
| `web\` | the **site** (physical path) | The React app (static files) and `web.config` for page routing |
| `api\` | an **application** `/api` under the site | The Node.js API; IIS starts it through HttpPlatformHandler and restarts it if it stops |
| `database\` | — | SQL script and uploads (business data; keep private, never in the web folder) |

The browser only ever talks to the one site: pages come from `web`, and every `/api/...` request goes to `api`.

## 1. Server prerequisites (once)

| Install | Why |
|---|---|
| IIS with **Static Content** | serves `web` |
| [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite) | app routes such as `/inventory` load `index.html` |
| [HttpPlatformHandler 1.2](https://www.iis.net/downloads/microsoft/httpplatformhandler) | runs the API |
| [Node.js 20 LTS or newer](https://nodejs.org) (x64), on the system PATH | the API runtime — run `iisreset` after installing |
| SQL Server with TCP/IP enabled (port 1433) | data |

Not needed, and best removed: **WebDAV Publishing** (it blocks Save / Delete with HTTP 405).

## 2. Copy the files

```
C:\inetpub\AutoInventory\web\   ← contents of web\  (or AutoInventory-<version>-web.zip)
C:\inetpub\AutoInventory\api\   ← contents of api\  (or AutoInventory-<version>-api.zip)
D:\AutoInventoryData\uploads\   ← contents of database\uploads\  (logo, photos)
```

## 3. Database

**Restore the prepared database** (from `database\`):

```
sqlcmd -S localhost -U sa -P "<password>" -C -f 65001 -i AutoInventory-<version>.sql
```

It creates `AutoInventory` with all data and refuses to run if that database already has vehicles.
**Or start empty:** `CREATE DATABASE AutoInventory;` — the tables are created when the API first starts.

Recommended: a dedicated login instead of `sa`:

```sql
CREATE LOGIN autoinventory WITH PASSWORD = '<strong password>';
USE AutoInventory; CREATE USER autoinventory FOR LOGIN autoinventory; ALTER ROLE db_owner ADD MEMBER autoinventory;
```

## 4. API settings

In `api\`, copy `.env.production.example` to **`.env.production`** and fill in:

```
MSSQL_SERVER=localhost
MSSQL_DATABASE=AutoInventory
MSSQL_USER=autoinventory
MSSQL_PASSWORD="<password>"          # quotes are required if it contains #, $ or spaces
DATA_DIR=D:\AutoInventoryData        # uploads (photos, auction sheets, logo) — outside the site folders
```

## 5. IIS

1. **Application pool** `AutoInventory`: .NET CLR version **No Managed Code**, pipeline **Integrated**, Start Mode **AlwaysRunning**, Idle Time-out **0**.
2. **Site** → physical path **`C:\inetpub\AutoInventory\web`**, app pool `AutoInventory`, bindings for your host name **including HTTPS** (sign-in needs HTTPS in production).
3. **Application** → right-click the site → *Add Application* → alias **`api`**, physical path **`C:\inetpub\AutoInventory\api`**, app pool `AutoInventory`.
4. **Permissions**: give `IIS AppPool\AutoInventory` *Modify* on `C:\inetpub\AutoInventory\api\logs` and on `DATA_DIR`.
5. If HttpPlatformHandler sections are locked, unlock once (admin prompt):
   `%windir%\system32\inetsrv\appcmd unlock config -section:system.webServer/handlers`

Open the site and sign in. On an empty database the first user is `admin@autoinventory.local` / `admin123` — **change it straight away**.

## Updating

- **Web only changed:** replace the contents of `web\` (the zip). No restart needed.
- **API changed:** stop the app pool, replace the contents of `api\` **except `.env.production` and `logs\`**, start the app pool.
- The database is upgraded automatically by the API on start (new tables / columns only; data is never removed).

## Troubleshooting

| Symptom | Fix |
|---|---|
| **500.19** on the site | URL Rewrite not installed |
| **500.19** on `/api` | HttpPlatformHandler not installed, or *handlers* section locked (step 5.5) |
| **502 / 500 on /api** | read `api\logs\node_*.log` — usually DB settings, or Node not on PATH (`iisreset` after installing Node) |
| **Login failed for user** | SQL login / password; SQL Server must allow *SQL Server and Windows Authentication* mode |
| **405 when saving or deleting** | WebDAV: remove *WebDAV Publishing* from Windows features, then `iisreset` |
| **404 on refresh of /inventory** | URL Rewrite not installed |
| **Signed in, then "Please log in"** | the site must be opened over **HTTPS** |
| **Uploads fail / logo missing** | app pool needs *Modify* on `DATA_DIR`; copy `database\uploads\*` into `DATA_DIR\uploads` |
