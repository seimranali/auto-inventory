# Auto Inventory on IIS

One IIS site serves the app. The site root holds the React app; `/api` is an IIS *application* in
which IIS runs the Node.js API through HttpPlatformHandler and restarts it if it stops.

## 1. Server prerequisites (once)

| Install | Why |
|---|---|
| IIS with **Static Content** | serves the React app |
| [URL Rewrite 2.1](https://www.iis.net/downloads/microsoft/url-rewrite) | app routes such as `/inventory` load `index.html` |
| [HttpPlatformHandler 1.2](https://www.iis.net/downloads/microsoft/httpplatformhandler) | runs the Node.js API |
| [Node.js 20 LTS or newer](https://nodejs.org) (x64), on the system PATH | the API runtime — restart IIS after installing (`iisreset`) |
| SQL Server with the `AutoInventory` database | data |

## 2. Database

**Option A — restore the prepared database** (the release's `database\` folder, next to this site folder):

```
sqlcmd -S localhost -U sa -P "<password>" -C -f 65001 -i AutoInventory-<date>.sql
```

It creates `AutoInventory` with all data (company, users, parties, vehicles, expenses) and refuses to run if that
database already has vehicles. Then copy `database\uploads\*` into `DATA_DIR\uploads` (logo and photos).
Keep the `database` folder **out of the web folder**.

**Option B — start empty:** create the database once; the tables are created automatically on first start.

```sql
CREATE DATABASE AutoInventory;
-- recommended: a dedicated login instead of sa
CREATE LOGIN autoinventory WITH PASSWORD = '<strong password>';
USE AutoInventory; CREATE USER autoinventory FOR LOGIN autoinventory; ALTER ROLE db_owner ADD MEMBER autoinventory;
```

SQL Server must accept **TCP/IP** connections (SQL Server Configuration Manager → Protocols → TCP/IP → Enabled, port 1433).

To bring data across from MubashirJP (same SQL Server), start the site once so the tables exist, then:

```
sqlcmd -S localhost -U sa -P <password> -C -i api\scripts\import-mubashirjp.sql
sqlcmd -S localhost -U sa -P <password> -C -i api\scripts\import-mubashirjp-expenses.sql
```

## 3. Copy the files

Copy this whole folder to the server, e.g. `C:\inetpub\AutoInventory`.

## 4. Settings

In `api\`, copy `.env.production.example` to **`.env.production`** and fill in:

```
MSSQL_SERVER=localhost
MSSQL_DATABASE=AutoInventory
MSSQL_USER=autoinventory
MSSQL_PASSWORD=<password>
DATA_DIR=D:\AutoInventoryData        # uploaded photos / auction sheets / logo — keep OUTSIDE the site folder
```

(Alternatively set the same names as `<environmentVariable>` entries in `api\web.config`.)

## 5. IIS

1. **Application pool** `AutoInventory`: .NET CLR version **No Managed Code**, pipeline **Integrated**, Start Mode **AlwaysRunning**, Idle Time-out **0**.
2. **Site**: physical path `C:\inetpub\AutoInventory`, app pool `AutoInventory`, binding for your host name (add HTTPS — the login cookie is marked *Secure* in production).
3. **Application**: right-click the site → *Add Application* → alias **`api`**, physical path `C:\inetpub\AutoInventory\api`, same app pool.
4. **Permissions**: give `IIS AppPool\AutoInventory` *Modify* on `C:\inetpub\AutoInventory\api\logs` and on `DATA_DIR`.
5. If HttpPlatformHandler sections are locked, unlock once (admin prompt):
   `%windir%\system32\inetsrv\appcmd unlock config -section:system.webServer/handlers`

Open the site and sign in with `admin@autoinventory.local` / `admin123` (created on first start) — **change this password straight away**.

## Updating

Run `deploy\build-iis.ps1` again, then replace everything **except** `api\.env.production` (and `DATA_DIR`, which lives outside the folder).
Recycle the `AutoInventory` app pool afterwards.

## Troubleshooting

- **502.3 / 500 on /api** — read `api\logs\node_*.log`. Usually a wrong DB setting or Node not on PATH for the app pool (`where node` in an admin prompt; `iisreset` after installing Node).
- **404 on refresh of /inventory** — URL Rewrite is not installed.
- **Uploads fail** — the app pool identity needs *Modify* on `DATA_DIR`.
- **405 when saving or deleting** — IIS WebDAV is intercepting PUT/DELETE. `api\web.config` removes it; if the error stays,
  uninstall the feature: *Windows Features → IIS → World Wide Web Services → Common HTTP Features → WebDAV Publishing* (untick), then `iisreset`.
