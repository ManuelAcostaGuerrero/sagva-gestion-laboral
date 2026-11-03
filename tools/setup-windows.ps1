# Entrada compatible al instalador local SQLite. No sobrescribe configuracion.
& (Join-Path $PSScriptRoot 'control-local.ps1') -Accion Preparar
exit $LASTEXITCODE
