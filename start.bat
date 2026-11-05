@echo off
REM Starts the Next.js API (port 3001) and the React app (port 3000)
start "Auto Inventory API" cmd /k "cd /d %~dp0backend && npm run dev"
start "Auto Inventory App" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 >nul
start http://localhost:3000
