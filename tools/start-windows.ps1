param([switch]$NoClean)
& (Join-Path $PSScriptRoot 'control-local.ps1') -Accion Iniciar
exit $LASTEXITCODE
