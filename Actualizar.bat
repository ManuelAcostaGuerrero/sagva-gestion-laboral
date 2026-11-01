@echo off
setlocal
cd /d "%~dp0"
title Asistencia Huella Digital - Actualizar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\control-local.ps1" -Accion Actualizar
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
