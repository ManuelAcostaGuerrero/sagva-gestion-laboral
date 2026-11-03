@echo off
setlocal
cd /d "%~dp0"
title Asistencia Huella - Ensayo QR movil sin asistencia
call npm.cmd run test:server
if errorlevel 1 goto fallo
call npm.cmd run build --workspace client
if errorlevel 1 goto fallo
node.exe tools\probar-qr-movil.mjs
goto fin
:fallo
echo La prueba no se inicio. Revisa el error anterior.
:fin
pause
