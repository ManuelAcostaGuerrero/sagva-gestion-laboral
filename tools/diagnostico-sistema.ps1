param([switch]$Fix)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
Write-Host 'Diagnostico Asistencia Huella Digital - SQLite'
& (Join-Path $PSScriptRoot 'control-local.ps1') -Accion Estado
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node.exe tools/local-db.mjs diagnose
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Identificacion actual: QR personal o PIN en terminal autorizada. Gestion desde Usuarios.'
foreach ($url in @('http://127.0.0.1:4000/api/health','http://127.0.0.1:5173')) {
  try { $response=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3; Write-Host "Respuesta $($response.StatusCode): $url" }
  catch { Write-Host "No responde: $url" }
}
if ($Fix) { Write-Host 'Diagnostico de solo lectura. Usa Preparar.bat o Reiniciar.bat segun corresponda.' }
