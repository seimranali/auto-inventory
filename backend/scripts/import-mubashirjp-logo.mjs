// Copies the company logo from MubashirJP (stored there as base64 in Company.LogoPath) into
// Auto Inventory's uploads and sets it as the company logo. Run after import-mubashirjp.sql:
//   node --env-file=.env.local scripts/import-mubashirjp-logo.mjs
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS = path.join(process.cwd(), 'data', 'uploads');
const pool = await sql.connect({
  server: process.env.MSSQL_SERVER || 'localhost', port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE || 'AutoInventory', user: process.env.MSSQL_USER, password: process.env.MSSQL_PASSWORD,
  options: { encrypt: process.env.MSSQL_ENCRYPT === 'true', trustServerCertificate: true },
});

const { recordset: [src] } = await pool.request().query('SELECT TOP 1 CAST(LogoPath AS nvarchar(max)) logo FROM MubashirJP.dbo.Company ORDER BY CompanyID');
const b64 = (src?.logo || '').trim().replace(/^data:[^,]+,/, '');
if (!b64) { console.log('MubashirJP has no company logo.'); process.exit(0); }

const bytes = Buffer.from(b64, 'base64');
const ext = bytes[0] === 0x89 ? 'png' : bytes[0] === 0xff ? 'jpg' : bytes.subarray(0, 4).toString() === 'RIFF' ? 'webp' : bytes.subarray(0, 3).toString() === 'GIF' ? 'gif' : null;
if (!ext) throw new Error('Logo is not a PNG, JPG, WebP or GIF image');

fs.mkdirSync(UPLOADS, { recursive: true });
const name = `${crypto.randomUUID()}.${ext}`;
fs.writeFileSync(path.join(UPLOADS, name), bytes);

const { recordset: [cur] } = await pool.request().query('SELECT logo FROM company WHERE id = 1');
await pool.request().input('logo', sql.NVarChar, name).query('UPDATE company SET logo = @logo WHERE id = 1');
if (cur?.logo) fs.rmSync(path.join(UPLOADS, path.basename(cur.logo)), { force: true });

console.log(`Company logo imported: ${name} (${bytes.length} bytes)`);
await pool.close();
