@echo off
title A-Mart Supermarket Inventory and POS
cd /d "%~dp0"

echo ======================================================
echo    Starting A-Mart Supermarket Inventory and POS...
echo ======================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 goto :launch

if not exist ".git" goto :launch

echo [1/2] Checking for updates...
git -c network.http.timeout=3 fetch origin main --quiet 2>nul
if %errorlevel% neq 0 (
    echo [1/2] Offline mode: Starting POS directly from local cache.
    goto :launch
)

for /f %%i in ('git rev-list HEAD..origin/main --count 2^>nul') do set BEHIND=%%i
if not defined BEHIND goto :launch
if "%BEHIND%"=="0" (
    echo [1/2] System is up to date!
    goto :launch
)

echo [Update] New update detected. Downloading latest files...
git pull origin main --quiet 2>nul
echo [Update] App updated successfully!

:launch
echo.
echo [2/2] Launching A-Mart POS Desktop Application...
echo.

start msedge --app=http://localhost:4173 2>nul || start http://localhost:4173
node desktop-server.js
pause
