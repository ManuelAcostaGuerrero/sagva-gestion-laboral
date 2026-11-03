@echo off
setlocal
cd /d "%~dp0"
title Asistencia Huella Digital - Detener
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\control-local.ps1" -Accion Detener
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
