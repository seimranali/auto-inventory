// Exports the AutoInventory database (schema + data) as one SQL script that recreates it on another SQL Server.
//   node --env-file=.env.local scripts/export-database.mjs <out.sql>
// Login sessions are not exported. Uploaded files (photos, logo) live in DATA_DIR\uploads — copy that folder separately.
import sql from 'mssql';
import fs from 'fs';

const OUT = process.argv[2] || 'AutoInventory.sql';
const DB = process.env.MSSQL_DATABASE || 'AutoInventory';
// Parents before children (foreign keys)
const TABLES = ['company', 'users', 'parties', 'vehicles', 'vehicle_images', 'transactions'];
const SKIP_DATA = new Set(['sessions']);

const pool = await sql.connect({
  server: process.env.MSSQL_SERVER || 'localhost', port: Number(process.env.MSSQL_PORT) || 1433, database: DB,
  user: process.env.MSSQL_USER, password: process.env.MSSQL_PASSWORD,
  options: { encrypt: process.env.MSSQL_ENCRYPT === 'true', trustServerCertificate: true },
});
const q = async text => (await pool.request().query(text)).recordset;

const all = (await q("SELECT name FROM sys.tables WHERE is_ms_shipped = 0")).map(r => r.name);
const tables = [...TABLES.filter(t => all.includes(t)), ...all.filter(t => !TABLES.includes(t) && !SKIP_DATA.has(t)).sort(), ...all.filter(t => SKIP_DATA.has(t))];

const lit = (v, type) => {
  if (v === null || v === undefined) return 'NULL';
  if (type === 'int' || type === 'bigint' || type === 'bit' || type === 'smallint' || type === 'tinyint') return String(Number(v));
  if (type === 'float' || type === 'real' || type === 'decimal' || type === 'numeric') return Number.isFinite(Number(v)) ? String(Number(v)) : 'NULL';
  if (v instanceof Date) return `'${v.toISOString().replace('T', ' ').replace('Z', '')}'`;
  return `N'${String(v).replace(/'/g, "''")}'`;
};
const typeSql = c => {
  const t = c.type;
  if (['nvarchar', 'varchar', 'nchar', 'char'].includes(t)) return `${t.toUpperCase()}(${c.max_length === -1 ? 'MAX' : t.startsWith('n') ? c.max_length / 2 : c.max_length})`;
  if (['decimal', 'numeric'].includes(t)) return `${t.toUpperCase()}(${c.precision},${c.scale})`;
  return t.toUpperCase();
};

const out = [];
const w = s => out.push(s);
w(`/*
  AutoInventory database — schema and data
  Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from [${DB}] on ${process.env.MSSQL_SERVER || 'localhost'}

  Run on the target SQL Server (creates the database if missing):
    sqlcmd -S localhost -U sa -P <password> -C -i AutoInventory.sql

  Safety: stops without changing anything if the target database already has vehicles.
  Empty tables (e.g. created by starting the app once) are replaced. To replace a database that has data,
  back it up, then:  sqlcmd -S localhost -U sa -P <password> -C -Q "DROP DATABASE [${DB}]"

  Not included: login sessions (everyone signs in again) and uploaded files —
  copy the uploads folder (photos, auction sheets, logo) into DATA_DIR\\uploads on the server.
*/
:on error exit
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
GO
IF DB_ID(N'${DB}') IS NULL CREATE DATABASE [${DB}];
GO
USE [${DB}];
GO
IF EXISTS (SELECT 1 FROM sys.partitions WHERE object_id = OBJECT_ID(N'dbo.vehicles') AND index_id IN (0, 1) AND rows > 0)
BEGIN
  RAISERROR(N'[${DB}] already contains vehicles. Nothing was changed. To replace it, back it up and DROP DATABASE [${DB}] first.', 16, 1);
END
GO
`);

// Drop in reverse dependency order, then create
w('-- ---------- Drop existing tables ----------');
for (const t of [...tables].reverse()) w(`IF OBJECT_ID(N'dbo.${t}', N'U') IS NOT NULL DROP TABLE dbo.[${t}];`);
w('GO\n');

const fks = [];
for (const t of tables) {
  const cols = await q(`SELECT c.name, ty.name type, c.max_length, c.precision, c.scale, c.is_nullable, dc.definition def
    FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`);
  const keys = await q(`SELECT i.name, i.is_primary_key pk, i.is_unique_constraint uq, i.is_unique, i.has_filter, i.filter_definition,
      STRING_AGG(QUOTENAME(c.name), ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) cols
    FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID(N'dbo.${t}') AND i.type > 0 GROUP BY i.name, i.is_primary_key, i.is_unique_constraint, i.is_unique, i.has_filter, i.filter_definition`);
  const checks = await q(`SELECT definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.${t}')`);
  for (const f of await q(`SELECT pc.name col, rt.name ref_table, rc.name ref_col, fk.delete_referential_action_desc on_delete
      FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
      JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
      JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID(N'dbo.${t}')`)) fks.push({ t, ...f });

  const defs = cols.map(c => `  [${c.name}] ${typeSql(c)}${c.is_nullable ? '' : ' NOT NULL'}${c.def ? ` DEFAULT ${c.def}` : ''}`);
  for (const k of keys.filter(k => k.pk)) defs.push(`  PRIMARY KEY (${k.cols})`);
  for (const k of keys.filter(k => k.uq)) defs.push(`  UNIQUE (${k.cols})`);
  for (const c of checks) defs.push(`  CHECK ${c.definition}`);
  w(`-- ---------- ${t} ----------`);
  w(`CREATE TABLE dbo.[${t}] (\n${defs.join(',\n')}\n);`);
  for (const k of keys.filter(k => !k.pk && !k.uq)) {
    w(`CREATE ${k.is_unique ? 'UNIQUE ' : ''}INDEX [${k.name}] ON dbo.[${t}] (${k.cols})${k.has_filter ? ` WHERE ${k.filter_definition}` : ''};`);
  }
  w('GO');

  if (SKIP_DATA.has(t)) { w(''); continue; }
  const rows = await q(`SELECT * FROM dbo.[${t}]`);
  const types = Object.fromEntries(cols.map(c => [c.name, c.type]));
  const names = cols.map(c => c.name);
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    w(`INSERT INTO dbo.[${t}] (${names.map(n => `[${n}]`).join(', ')}) VALUES\n${chunk.map(r => `(${names.map(n => lit(r[n], types[n])).join(', ')})`).join(',\n')};`);
    w('GO');
  }
  console.log(`${t}: ${rows.length} rows`);
  w('');
}

w('-- ---------- Foreign keys ----------');
for (const f of fks) {
  w(`ALTER TABLE dbo.[${f.t}] ADD FOREIGN KEY ([${f.col}]) REFERENCES dbo.[${f.ref_table}] ([${f.ref_col}])${f.on_delete === 'CASCADE' ? ' ON DELETE CASCADE' : ''};`);
}
w('GO\n');

w('-- ---------- Check ----------');
w(`SELECT ${tables.filter(t => !SKIP_DATA.has(t)).map(t => `(SELECT COUNT(*) FROM dbo.[${t}]) [${t}]`).join(', ')};`);
w('GO');

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
await pool.close();
console.log(`Written ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
