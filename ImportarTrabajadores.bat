@echo off
setlocal
cd /d "%~dp0"
title Asistencia Huella Digital - Importar trabajadores
set "WORKBOOK=%~1"
if not defined WORKBOOK set /p "WORKBOOK=Ruta del Excel (.xlsx): "
node.exe "%~dp0tools\import-workers.mjs" --file "%WORKBOOK%"
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
