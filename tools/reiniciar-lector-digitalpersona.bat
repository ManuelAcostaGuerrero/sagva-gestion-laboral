@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Solicitando permisos de administrador para reiniciar DigitalPersona...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Reiniciando servicio DigitalPersona...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service -Name DpHost -Force; Start-Sleep -Seconds 3; $svc = Get-Service -Name DpHost; Write-Host ('Estado actual: ' + $svc.Status)"

echo.
echo Si el estado dice Running, vuelve a abrir la app y prueba nuevamente la huella.
pause
