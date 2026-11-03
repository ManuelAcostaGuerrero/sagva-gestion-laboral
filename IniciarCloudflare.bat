@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\cloudflare-local.ps1" -Accion Iniciar
set "RC=%ERRORLEVEL%"
pause
exit /b %RC%
