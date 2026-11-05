# Builds an IIS release of Auto Inventory into release\iis (and release\AutoInventory-iis-<date>.zip)
#
#   powershell -ExecutionPolicy Bypass -File deploy\build-iis.ps1
#
# Layout (copy the whole folder to the server, e.g. C:\inetpub\AutoInventory):
#   web.config        site root: React app + SPA routing
#   index.html, assets\...
#   api\              IIS application "/api": Next.js server run by HttpPlatformHandler
#   README-IIS.md     setup steps
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'release\iis'

Write-Host '== Frontend build' -ForegroundColor Cyan
Push-Location "$root\frontend"
npm ci --no-audit --no-fund
if ($LASTEXITCODE) { throw 'frontend npm ci failed' }
npx vite build
if ($LASTEXITCODE) { throw 'frontend build failed' }
Pop-Location

Write-Host '== Backend build (standalone)' -ForegroundColor Cyan
Push-Location "$root\backend"
npm ci --no-audit --no-fund
if ($LASTEXITCODE) { throw 'backend npm ci failed' }
npx next build
if ($LASTEXITCODE) { throw 'backend build failed' }
Pop-Location

Write-Host "== Assembling $out" -ForegroundColor Cyan
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null

# Site root: built React app + routing config
Copy-Item "$root\frontend\dist\*" $out -Recurse
Copy-Item "$PSScriptRoot\iis\web.config" "$out\web.config"

# /api application: standalone Next.js server (never ship local data or dev secrets)
$api = Join-Path $out 'api'
Copy-Item "$root\backend\.next\standalone" $api -Recurse
Remove-Item "$api\data", "$api\.env", "$api\.env.local" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$api\.next\static", "$api\logs", "$api\scripts" | Out-Null
if (Test-Path "$root\backend\.next\static") { Copy-Item "$root\backend\.next\static\*" "$api\.next\static" -Recurse }
Copy-Item "$PSScriptRoot\iis\api.web.config" "$api\web.config"
Copy-Item "$root\backend\.env.example" "$api\.env.production.example"
Copy-Item "$root\backend\scripts\import-mubashirjp.sql", "$root\backend\scripts\import-mubashirjp-expenses.sql", "$root\backend\scripts\sync-mubashirjp-prices.sql", "$root\backend\scripts\update-price-from-mubashirjp-items.sql", "$root\backend\scripts\report-mubashirjp-price-mismatch.sql", "$root\backend\scripts\import-mubashirjp-logo.mjs" "$api\scripts"
Copy-Item "$PSScriptRoot\iis\README-IIS.md" "$out\README-IIS.md"

$stamp = Get-Date -Format yyyyMMdd-HHmm
$zip = Join-Path $root "release\AutoInventory-iis-$stamp.zip"
Compress-Archive -Path "$out\*" -DestinationPath $zip -Force

# Database script + uploaded files, kept OUTSIDE the site folder so IIS can never serve them
Write-Host '== Database export' -ForegroundColor Cyan
$dbOut = Join-Path $root "release\database"
if (Test-Path $dbOut) { Remove-Item $dbOut -Recurse -Force }
New-Item -ItemType Directory -Force $dbOut | Out-Null
$sqlFile = Join-Path $dbOut "AutoInventory-$stamp.sql"
if (Test-Path "$root\backend\.env.local") {
  Push-Location "$root\backend"
  node --env-file=.env.local scripts/export-database.mjs $sqlFile
  if ($LASTEXITCODE) { throw 'database export failed' }
  Pop-Location
  if (Test-Path "$root\backend\data\uploads") { Copy-Item "$root\backend\data\uploads" "$dbOut\uploads" -Recurse }
} else {
  Write-Warning 'backend\.env.local not found - database export skipped'
}

Write-Host "Done: $out" -ForegroundColor Green
Write-Host "Zip:  $zip" -ForegroundColor Green
Write-Host "DB:   $dbOut  (SQL script + uploads - copy to the server, do not put in the web folder)" -ForegroundColor Green
