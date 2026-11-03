param(
  [string]$Origen = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'asistencia-huella-digital')
)
$ErrorActionPreference = 'Stop'
$destino = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$origenFull = [IO.Path]::GetFullPath($Origen)
if (!(Test-Path -LiteralPath $origenFull -PathType Container)) {
  throw "No existe la carpeta original: $origenFull. Indica -Origen con la ruta correcta."
}
if ($destino.TrimEnd('\') -ieq $origenFull.TrimEnd('\')) {
  throw 'La fuente y el destino son la misma carpeta. No se copiara nada.'
}
if (!(Get-Command git.exe -ErrorAction SilentlyContinue)) {
  throw 'Se necesita Git instalado para verificar que los archivos son los mismos que en Huella.'
}
$recursos = @(
  @{ Path='client/public/brand/red-taurus-sidebar.png'; Sha='ab69762c164b703e487b361886fec1013983e6af' },
  @{ Path='client/public/vendor/digitalpersona/fingerprint.sdk.min.js'; Sha='b09de38636ed36b3b24c86ebc74ce5f327143c87' },
  @{ Path='client/public/vendor/digitalpersona/websdk.client.bundle.min.js'; Sha='0863e0d22137394f8d78bed13a4f69dad98b14af' }
)
function GitHash([string]$archivo) {
  $hash = & git.exe hash-object -- $archivo
  if ($LASTEXITCODE -ne 0 -or !$hash) { throw "No se pudo comprobar: $archivo" }
  return ($hash | Select-Object -First 1).Trim().ToLowerInvariant()
}
# Revisión completa antes de copiar: abortar ante archivo ausente o diferente.
foreach ($item in $recursos) {
  $src = Join-Path $origenFull $item.Path
  if (!(Test-Path -LiteralPath $src -PathType Leaf)) { throw "Falta recurso en Huella: $src" }
  $actual = GitHash $src
  if ($actual -ne $item.Sha) {
    throw "El recurso original no coincide con la referencia Huella v1.19.2: $($item.Path). No se copiara automaticamente."
  }
  $target = Join-Path $destino $item.Path
  if (Test-Path -LiteralPath $target) {
    if ((GitHash $target) -ne $item.Sha) { throw "Destino ya existe con contenido distinto: $target" }
  }
}
foreach ($item in $recursos) {
  $src = Join-Path $origenFull $item.Path
  $target = Join-Path $destino $item.Path
  if (!(Test-Path -LiteralPath $target)) {
    $folder = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Copy-Item -LiteralPath $src -Destination $target -ErrorAction Stop
  }
  if ((GitHash $target) -ne $item.Sha) { throw "Verificacion de copia fallida: $target" }
  Write-Host "OK: $($item.Path)"
}
Write-Host "Recursos originales copiados SOLO al entorno local. No subir a GitHub."
