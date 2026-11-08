param([ValidateSet('Actualizar','Iniciar','Detener','Reiniciar','Estado','Respaldar','Preparar','Importar','CompletarFichas')][string]$Accion = 'Estado', [string]$Archivo, [string]$Vinculos)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
$local = Join-Path $root '.local'
New-Item -ItemType Directory -Force -Path $local | Out-Null
$mutex = New-Object Threading.Mutex($false, 'Local\SAGVAGestionLaboralControl')
$locked = $false
$transcript = $false
function Run([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command fallo (codigo $LASTEXITCODE)." }
}
function RequireNode {
  if (!(Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Instala Node.js 24 o posterior.' }
  $major = & node.exe -p 'parseInt(process.versions.node)'
  if ($LASTEXITCODE -ne 0 -or [int]$major -lt 24) { throw 'SQLite requiere Node.js 24 o posterior.' }
}
function Listeners {
  @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in 4010,5183,5184 })
}
function Ports {
  foreach ($connection in (Listeners)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"
    $services = @(Get-CimInstance Win32_Service -Filter "ProcessId=$($connection.OwningProcess)" | Select-Object -ExpandProperty Name)
    Write-Host "Puerto $($connection.LocalPort): PID $($connection.OwningProcess), $($process.Name), servicio: $($services -join ', ')"
    Write-Host "Comando: $($process.CommandLine)"
  }
}
function FreePorts {
  if (@(Listeners).Count) { Ports; throw 'Puertos ocupados por otra instancia. Consulta Estado para identificarla. No se cerrara ningun servicio por conflicto.' }
}
function Owned {
  $file = Join-Path $local 'processes.json'
  if (!(Test-Path -LiteralPath $file)) { return }
  $entries = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
  foreach ($entry in $entries) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.Id)"
    if (!$process -or $process.Name -ne 'node.exe') { continue }
    if ($process.CreationDate.ToUniversalTime().Ticks -ne ([datetime]$entry.Created).ToUniversalTime().Ticks) { continue }
    if (!$entry.Script.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { continue }
    if (!$process.CommandLine) { throw 'Windows no permite verificar este proceso. Usa el mismo nivel de administrador con que lo iniciaste; no se cerrara ningun proceso sin acreditar.' }
    if ($process.CommandLine.Contains($entry.Script)) { $process }
  }
}
function Stopped {
  if (@(Owned).Count) { throw 'El proyecto esta iniciado. Usa Detener.bat antes de actualizar.' }
  FreePorts
}
function GitReady {
  if ((git remote get-url origin) -ne 'https://github.com/ManuelAcostaGuerrero/sagva-gestion-laboral.git') { throw 'Origin no corresponde al repositorio esperado.' }
  $dirty = @(git status --porcelain)
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar Git.' }
  if ($dirty.Count) { $dirty | Write-Host; throw 'Hay cambios locales. Guardalos en Git antes de actualizar. No se sobrescribieron ni se hizo stash.' }
}
function UpdatePorts {
  $ownIds=@(Owned | ForEach-Object { $_.ProcessId })
  if (@(Listeners | Where-Object { $_.OwningProcess -notin $ownIds }).Count) { Ports; throw 'Un servicio ajeno ocupa 4010/5183. Actualizacion cancelada sin detenerlo.' }
}
function UpdatePrerequisites {
  if (!(Test-Path 'node_modules\dotenv') -or !(Test-Path 'node_modules\esbuild') -or !(Test-Path 'node_modules\vite\bin\vite.js')) {
    Write-Host 'Faltan herramientas locales: instalando dependencias de la version actual antes de revisar GitHub.'
    Run 'npm.cmd' @('ci')
  }
}
function Backup {
  $destination = Join-Path $local ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  Run 'icacls.exe' @($destination, '/inheritance:r', '/grant:r', "${identity}:(OI)(CI)F", 'SYSTEM:(OI)(CI)F')
  foreach ($relative in @('server\.env','client\.env','.env','.local\mobile-https.json','.local\certificados','dumps','backups','.local\acceso-inicial.txt')) {
    $source = Join-Path $root $relative
    if (Test-Path -LiteralPath $source) {
      $target = Join-Path $destination $relative
      New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
      Copy-Item -LiteralPath $source -Destination $target -Recurse
    }
  }
  git rev-parse HEAD | Set-Content (Join-Path $destination 'commit.txt')
  if (Test-Path 'server\.env') { Run 'node.exe' @('tools/local-db.mjs','backup',$destination) }
  else {
    if (Test-Path 'data\asistencia.db') { throw 'Existe una base pero falta server/.env. Revisa su configuracion antes de continuar.' }
    Write-Host 'Sin server/.env: configuracion inicial pendiente.'
  }
  Write-Host "Respaldo: $destination"
  $script:LastBackup=$destination
}
function StopOwn {
  foreach ($process in @(Owned)) {
    Write-Host "Deteniendo SAGVA Gestion Laboral PID $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -ErrorAction Stop
  }
  if (Test-Path (Join-Path $local 'processes.json')) { Remove-Item -LiteralPath (Join-Path $local 'processes.json') }
}
function InstanceReady([int[]]$Ids) {
  if ($Ids.Count -ne 2) { return $false }
  $connections = @(Listeners)
  if (@($connections | Where-Object { $_.OwningProcess -notin $Ids }).Count) { return $false }
  foreach ($port in @(4010,5183)) {
    if (@($connections | Where-Object { $_.LocalPort -eq $port -and $_.OwningProcess -in $Ids }).Count -ne 1) { return $false }
  }
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:5183/api/health' -TimeoutSec 3
    $client = Invoke-WebRequest 'http://127.0.0.1:5183' -UseBasicParsing -TimeoutSec 3
    return ($health.service -eq 'attendance-fingerprint-api' -and $client.StatusCode -eq 200)
  } catch { return $false }
}
function AssertUpdateNotBlocked {
  $stateFile=Join-Path $local 'update-state.json'
  if (Test-Path -LiteralPath $stateFile) {
    $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($state.RecoveryRequired) { throw 'Actualizacion pendiente de recuperacion. Revisar update-state.json y el respaldo antes de iniciar; no borrar la marca.' }
  }
}
function StartOwn([switch]$Prepared) {
  AssertUpdateNotBlocked
  $existing = @(Owned)
  if ($existing.Count) {
    if (InstanceReady @($existing.ProcessId)) { Write-Host 'El proyecto ya esta iniciado y responde correctamente. No se duplicaron procesos.'; return }
    throw 'Existe una instancia incompleta. Revisa Estado y los logs; usa Reiniciar para recuperar solo este proyecto.'
  }
  FreePorts
  if (!(Test-Path 'node_modules\vite\bin\vite.js')) { throw 'Faltan dependencias. Ejecuta Actualizar.bat.' }
  if (!(Test-Path 'client\dist\index.html')) { throw 'Falta compilar la pantalla. Ejecuta Actualizar.bat.' }
  if (!(Test-Path 'server\.env')) { throw 'Falta configuracion inicial. Ejecuta Preparar.bat para configurar SQLite.' }
  if (!(Test-Path 'client\.env')) { throw 'Falta client/.env. Copia client/.env.example y revisa la URL.' }
  Run 'node.exe' @('tools/local-db.mjs','check')
  if (!$Prepared) {
    Backup
    Run 'node.exe' @('tools/local-db.mjs','migrate')
  }
  FreePorts
  $entries = @()
  try {
    foreach ($name in @('server','client')) {
      $script = if ($name -eq 'server') { Join-Path $root 'tools\start-backend.mjs' } else { Join-Path $root 'tools\start-web.mjs' }
      $arguments = '"' + $script + '"'
      $process = Start-Process node.exe -ArgumentList $arguments -WorkingDirectory (Join-Path $root $name) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $local "$name.out.log") -RedirectStandardError (Join-Path $local "$name.err.log")
      $info = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
      if (!$info) { throw "No pudo iniciarse $name. Revisa .local/$name.err.log." }
      $entries += @{ Id=$process.Id; Created=$info.CreationDate.ToUniversalTime().ToString('o'); Script=$script }
      ConvertTo-Json -InputObject @($entries) | Set-Content (Join-Path $local 'processes.json')
    }
    $ready = $false
    for ($attempt=0; $attempt -lt 15; $attempt++) {
      Start-Sleep -Seconds 1
      if (@(Owned).Count -ne 2) { throw 'Un proceso termino. Revisa los logs en .local.' }
      $connections = Listeners
      if (@($connections | Where-Object { $_.OwningProcess -notin $entries.Id }).Count) { throw 'Conflicto durante el inicio. Se detendra solo este proyecto.' }
      try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5183/api/health' -TimeoutSec 2
        $client = Invoke-WebRequest 'http://127.0.0.1:5183' -UseBasicParsing -TimeoutSec 2
        if ($health.service -eq 'attendance-fingerprint-api' -and $client.StatusCode -eq 200) { $ready=$true; break }
      } catch { }
    }
    if (!$ready) { throw 'El sistema no respondio a tiempo. Revisa .local.' }
    Write-Host 'Sistema listo: http://localhost:5183 - API http://localhost:4010/api'
  } catch { StopOwn; throw }
}
. (Join-Path $PSScriptRoot 'update-local.ps1')
try {
  $locked = $mutex.WaitOne(0)
  if (!$locked) { throw 'Otro control de este proyecto esta en ejecucion.' }
  Start-Transcript -Path (Join-Path $local ((Get-Date -Format 'yyyyMMdd-HHmmss') + "-$Accion.log")) -Append | Out-Null
  $transcript=$true
  Write-Host "SAGVA GESTION LABORAL (HUELLA BASE) - $Accion - $root"
  Write-Host "Version: $((Get-Content 'package.json' -Raw | ConvertFrom-Json).version)"
  if ($Accion -in @('Actualizar','Iniciar','Reiniciar','Preparar','Respaldar','Importar','CompletarFichas')) { RequireNode }
  switch ($Accion) {
    'Estado' { Ports; $owned=@(Owned); Write-Host "Procesos identificados de este proyecto: $($owned.Count)"; git status --short --branch; Write-Host "Configuracion server/.env: $(Test-Path 'server\.env'); client/.env: $(Test-Path 'client\.env')" }
    'Detener' { StopOwn; Ports }
    'Reiniciar' { Ports; $ownIds=@(Owned | ForEach-Object { $_.ProcessId }); if (@(Listeners | Where-Object { $_.OwningProcess -notin $ownIds }).Count) { throw 'Hay servicios ajenos. Reinicio cancelado.' }; StopOwn; StartOwn }
    'Iniciar' { StartOwn }
    'Respaldar' { Stopped; Backup }
    'Importar' { Stopped; if (!$Archivo -or !(Test-Path -LiteralPath $Archivo -PathType Leaf)) { throw 'Indica un archivo Excel existente.' }; Backup; Run 'node.exe' @('tools/import-workers.mjs','--file',$Archivo,'--under-control') }
    'CompletarFichas' { Stopped; if (!$Archivo -or !(Test-Path -LiteralPath $Archivo -PathType Leaf)) { throw 'Indica el informe Excel existente.' }; Backup; $arguments=@('tools/import-worker-info.mjs','--file',$Archivo,'--under-control'); if ($Vinculos) { $arguments+=@('--links',$Vinculos) }; Run 'node.exe' $arguments }
    'Preparar' {
      Stopped
      if (!(Test-Path 'node_modules\dotenv')) { Run 'npm.cmd' @('ci') }
      Backup
      Run 'node.exe' @('tools/local-db.mjs','configure')
      Run 'node.exe' @('tools/local-db.mjs','check')
      $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
      Run 'icacls.exe' @((Join-Path $local '.'), '/inheritance:r', '/grant:r', "${identity}:(OI)(CI)F", 'SYSTEM:(OI)(CI)F')
      Run 'icacls.exe' @((Join-Path $root 'server\.env'), '/inheritance:r', '/grant:r', "${identity}:F", 'SYSTEM:F')
      Run 'node.exe' @('tools/local-db.mjs','prepare')
      Write-Host 'Preparacion lista. Credenciales iniciales: .local/acceso-inicial.txt. Usa Iniciar.bat.'
    }
    'Actualizar' { RunLocalUpdate }
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if ($Accion -eq 'Actualizar') {
    Write-Host 'No se forzaron cambios ni se restauraron datos. Revisa el detalle del log en .local.'
  }
  exit 1
}
finally { if ($transcript) { Stop-Transcript | Out-Null }; if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
