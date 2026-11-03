@echo off
setlocal EnableExtensions DisableDelayedExpansion
title SAGVA Gestion Laboral - Instalar INT001
rem INSTALACION INICIAL: NO USAR Actualizar.bat, NO ABRIR NAVEGADOR.
rem Si cambia tu carpeta, modifica SOLO BASE.
set "BASE=C:\Users\Admin\Documents\Codex"
set "SOURCE=%BASE%\asistencia-huella-digital"
set "DEST=%BASE%\sagva-gestion-laboral"
set "URL=https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral.git"
set "BRANCH=int001-huella-codigo"
set "RC=1"
echo.
echo SAGVA GESTION LABORAL - PREPARACION INT001
echo Destino: %DEST%
echo.
if not exist "%BASE%\" (
  echo ERROR: No existe %BASE%
  goto :fail
)
if not exist "%SOURCE%\package.json" (
  echo ERROR: No se encontro la carpeta Huella original.
  goto :fail
)
where git.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Necesitas Git instalado.
  goto :fail
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Necesitas Node.js 24 o superior.
  goto :fail
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: Necesitas npm.
  goto :fail
)
for /f "delims=" %%N in ('node.exe -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%N"
if not defined NODE_MAJOR goto :fail
if %NODE_MAJOR% LSS 24 (
  echo ERROR: Se requiere Node.js 24 o posterior.
  goto :fail
)
if exist "%DEST%\.git\" goto :verify
if exist "%DEST%\" (
  echo ERROR: El destino existe sin repositorio Git. No se sobrescribe.
  goto :fail
)
echo Clonando SAGVA solo en la carpeta nueva...
git clone --branch "%BRANCH%" --single-branch "%URL%" "%DEST%"
if errorlevel 1 goto :fail
goto :install
:verify
echo Ya existe la carpeta nueva. No se hara pull ni se cambiara de rama.
for /f "delims=" %%R in ('git -C "%DEST%" remote get-url origin') do set "REMOTE=%%R"
if /i not "%REMOTE%"=="%URL%" (
  echo ERROR: La carpeta apunta a otro repositorio.
  goto :fail
)
for /f "delims=" %%R in ('git -C "%DEST%" branch --show-current') do set "CURRENT_BRANCH=%%R"
if /i not "%CURRENT_BRANCH%"=="%BRANCH%" (
  echo ERROR: La carpeta no esta en la rama esperada.
  goto :fail
)
:install
if exist "%DEST%\data\asistencia.db" (
  echo ERROR: Ya existe base de datos local. No se cambia instalacion existente.
  goto :fail
)
if exist "%DEST%\server\.env" (
  echo ERROR: Ya hay configuracion privada. No se altera.
  goto :fail
)
if exist "%DEST%\.local\processes.json" (
  echo ERROR: Hay procesos registrados. No se altera instalacion activa.
  goto :fail
)
if not exist "%DEST%\client\src\services\api.js" (
  echo ERROR: Falta el cliente API. Verifica la rama.
  goto :fail
)
cd /d "%DEST%"
if errorlevel 1 goto :fail
echo Copiando recursos de Huella original con control de integridad...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DEST%\tools\preparar-recursos-local.ps1" -Origen "%SOURCE%"
if errorlevel 1 goto :fail
echo.
echo Instalando dependencias...
call npm.cmd ci
if errorlevel 1 goto :fail
echo.
echo Ejecutando pruebas...
call npm.cmd run test:server
if errorlevel 1 goto :fail
echo.
echo Compilando interfaz...
call npm.cmd run build --workspace client
if errorlevel 1 goto :fail
echo.
echo [OK] Instalacion preparada y validaciones ejecutadas.
echo NO se inicio el sistema ni se abrio otra pestaña.
echo Para probar con SQLite vacia, detiene Huella original y luego usa:
echo "%DEST%\Preparar.bat"
echo "%DEST%\Iniciar.bat"
set "RC=0"
goto :done
:fail
echo.
echo Instalacion detenida. No borres carpetas ni ejecutes Actualizar.bat.
echo Copia el primer error mostrado para corregirlo en GitHub.
:done
echo.
pause
exit /b %RC%
