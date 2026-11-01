@echo off
setlocal
cd /d "%~dp0"
title Asistencia Huella Digital - Respaldar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\control-local.ps1" -Accion Respaldar
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
