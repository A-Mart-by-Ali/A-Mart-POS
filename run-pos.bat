@echo off
cd /d "%~dp0"

:: 1. Check if server is already running on port 4173
netstat -ano | findstr :4173 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    start "" /b node desktop-server.js
    ping 127.0.0.1 -n 2 >nul
)

:: 2. Launch A-Mart POS in standalone frameless app window
start msedge --app=http://localhost:4173 2>nul
if %errorlevel% neq 0 (
    start http://localhost:4173
)
