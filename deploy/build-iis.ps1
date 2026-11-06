# Builds an IIS release of Auto Inventory with the website and the API in separate folders.
#
#   powershell -ExecutionPolicy Bypass -File deploy\build-iis.ps1 [-Version 1.2.0] [-NoDatabase]
#
# Output: release\AutoInventory-<version>\
#   web\            IIS site root: React app + web.config (SPA routing, caching)
#   api\            IIS application "/api": standalone Next.js server run by HttpPlatformHandler
#   database\       SQL script (schema + data) + uploads — business data: keep private, never in the web folder
#   README-IIS.md   setup steps
# plus AutoInventory-<version>.zip containing web\, api\, README-IIS.md and VERSION.txt (no data, no secrets)
param(
  [string]$Version = (Get-Date -Format 'yyyy.MM.dd'),
  [switch]$NoDatabase
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$name = "AutoInventory-$Version"
$out = Join-Path $root "release\$name"
$web = Join-Path $out 'web'
$api = Join-Path $out 'api'

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
New-Item -ItemType Directory -Force $web, $api | Out-Null

# web: built React app + routing config
Copy-Item "$root\frontend\dist\*" $web -Recurse
Remove-Item "$web\_headers" -Force -ErrorAction SilentlyContinue   # Cloudflare-only file
Copy-Item "$PSScriptRoot\iis\web.config" "$web\web.config"

# api: standalone Next.js server (never ship local data or dev secrets)
Copy-Item "$root\backend\.next\standalone\*" $api -Recurse
Remove-Item "$api\data", "$api\.env", "$api\.env.local", "$api\.env.production" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$api\.next\static", "$api\logs", "$api\scripts" | Out-Null
if (Test-Path "$root\backend\.next\static") { Copy-Item "$root\backend\.next\static\*" "$api\.next\static" -Recurse }
Copy-Item "$PSScriptRoot\iis\api.web.config" "$api\web.config"
Copy-Item "$root\backend\.env.example" "$api\.env.production.example"
Copy-Item "$root\backend\scripts\*.sql", "$root\backend\scripts\import-mubashirjp-logo.mjs" "$api\scripts"
Copy-Item "$PSScriptRoot\iis\README-IIS.md" "$out\README-IIS.md"
Set-Content -Path "$out\VERSION.txt" -Value "Auto Inventory $Version`r`nBuilt $(Get-Date -Format 'yyyy-MM-dd HH:mm')`r`nCommit $(git -C $root rev-parse --short HEAD 2>$null)" -Encoding ascii

# Safety check: nothing secret or private in the deployable folders
$leaks = Get-ChildItem $web, $api -Recurse -Force -File | Where-Object { $_.Name -match '^\.env(\.local|\.production)?$|\.db$|\.sqlite$|\.sql$' -and $_.DirectoryName -notlike "$api\scripts*" }
if ($leaks) { throw "Refusing to package private files: $($leaks.FullName -join ', ')" }

# One zip with both parts: <name>\web, <name>\api, README-IIS.md, VERSION.txt (no database, no secrets)
$zip = Join-Path $root "release\$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $web, $api, "$out\README-IIS.md", "$out\VERSION.txt" -DestinationPath $zip -Force

# database: SQL script + uploaded files — private business data, kept beside (never inside) web / api
if (-not $NoDatabase) {
  Write-Host '== Database export' -ForegroundColor Cyan
  $dbOut = Join-Path $out 'database'
  New-Item -ItemType Directory -Force $dbOut | Out-Null
  if (Test-Path "$root\backend\.env.local") {
    Push-Location "$root\backend"
    node --env-file=.env.local scripts/export-database.mjs (Join-Path $dbOut "AutoInventory-$Version.sql")
    if ($LASTEXITCODE) { throw 'database export failed' }
    Pop-Location
    if (Test-Path "$root\backend\data\uploads") { Copy-Item "$root\backend\data\uploads" "$dbOut\uploads" -Recurse }
  } else {
    Write-Warning 'backend\.env.local not found - database export skipped'
  }
}

Write-Host "Done: $out" -ForegroundColor Green
Write-Host "  web\  -> IIS site root" -ForegroundColor Green
Write-Host "  api\  -> IIS application /api" -ForegroundColor Green
Write-Host "  Zip (web + api): $zip" -ForegroundColor Green
if (-not $NoDatabase) { Write-Host "  database\ -> run on SQL Server; PRIVATE (not for upload)" -ForegroundColor Yellow }
