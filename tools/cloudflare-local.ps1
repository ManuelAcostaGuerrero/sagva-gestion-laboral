param([ValidateSet('Iniciar','Detener','Estado')][string]$Accion='Estado')
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$local=Join-Path $root '.local'
New-Item -ItemType Directory -Force -Path $local | Out-Null
$state=Join-Path $local 'cloudflare.json'
$mutex=New-Object Threading.Mutex($false,'Local\AsistenciaCloudflareControl')
$locked=$false
function OwnTunnel {
  if (!(Test-Path -LiteralPath $state)) { return }
  $entry=Get-Content -LiteralPath $state -Raw | ConvertFrom-Json
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.Id)"
  if ($process -and $process.Name -eq 'cloudflared.exe' -and $process.CreationDate.ToUniversalTime().ToString('o') -eq $entry.Created -and $process.CommandLine.Contains('http://127.0.0.1:5173') -and $process.CommandLine.Contains($entry.Log) -and $entry.Log.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) { $process }
}
try {
  Set-Location -LiteralPath $root
  $locked=$mutex.WaitOne(0)
  if (!$locked) { throw 'Otra operacion de Cloudflare esta en curso.' }
  if ($Accion -eq 'Detener') {
    foreach($process in @(OwnTunnel)) { Stop-Process -Id $process.ProcessId -ErrorAction Stop }
    if (Test-Path -LiteralPath $state) { Remove-Item -LiteralPath $state }
    Write-Host 'Tunel de Asistencia detenido. Otros tuneles no se modificaron.'
  } elseif ($Accion -eq 'Estado') {
    if (@(OwnTunnel).Count) { $entry=Get-Content $state -Raw | ConvertFrom-Json; Write-Host "Cloudflare activo: $($entry.Url)" }
    else { Write-Host 'Cloudflare de Asistencia detenido.' }
  } else {
    if (@(OwnTunnel).Count) { $entry=Get-Content $state -Raw | ConvertFrom-Json; Write-Host "Ya esta activo: $($entry.Url)"; exit 0 }
    $health=Invoke-RestMethod 'http://127.0.0.1:5173/api/health' -TimeoutSec 5
    if ($health.service -ne 'attendance-fingerprint-api') { throw 'Inicia Asistencia con Iniciar.bat antes de abrir Cloudflare.' }
    $registered=Get-Content (Join-Path $local 'processes.json') -Raw | ConvertFrom-Json
    $web=@($registered | Where-Object { $_.Script -eq (Join-Path $root 'tools\start-web.mjs') })
    if (!$web.Count) { throw 'Cloudflare requiere la pantalla compilada de Asistencia, no el servidor de desarrollo.' }
    $webInfo=Get-CimInstance Win32_Process -Filter "ProcessId=$($web[0].Id)"
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction Stop)
    if (!$webInfo -or $webInfo.CreationDate.ToUniversalTime().ToString('o') -ne $web[0].Created -or !$webInfo.CommandLine.Contains($web[0].Script) -or @($listeners | Where-Object { $_.OwningProcess -ne $web[0].Id }).Count) {
      throw 'El puerto 5173 no corresponde al proceso registrado de Asistencia. No se publicara otro servicio.'
    }
    $binary=(Get-Command cloudflared.exe -ErrorAction Stop).Source
    $log=Join-Path $local ('cloudflare-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
    $arguments='tunnel --no-autoupdate --url http://127.0.0.1:5173 --protocol http2 --logfile "'+$log+'"'
    $process=Start-Process -FilePath $binary -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput ($log+'.out') -RedirectStandardError ($log+'.err')
    $info=Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
    if (!$info) { throw "Cloudflare no inicio. Revisa $log.err" }
    $entry=@{Id=$process.Id;Created=$info.CreationDate.ToUniversalTime().ToString('o');Log=$log;Url=$null}
    $entry | ConvertTo-Json | Set-Content $state
    for($attempt=0;$attempt -lt 45;$attempt++) {
      Start-Sleep -Seconds 1
      if (!(Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) { throw "Cloudflare termino. Revisa $log.err" }
      $lines=@($log,$log+'.err',$log+'.out') | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Content -LiteralPath $_ -Raw }
      $match=[regex]::Match(($lines -join "`n"),'https://[a-z0-9-]+\.trycloudflare\.com')
      if ($match.Success) { $entry.Url=$match.Value; $entry | ConvertTo-Json | Set-Content $state; $entry.Url | Set-Content (Join-Path $local 'enlace-cloudflare.txt'); Write-Host "Enlace para el celular: $($entry.Url)"; break }
    }
    if (!$entry.Url) { throw "No se obtuvo el enlace. Revisa $log.err y usa EstadoCloudflare.bat." }
    Write-Host 'Enlace temporal: mantener este computador y el tunel encendidos. Iniciar de nuevo genera otro enlace.'
  }
} catch { Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
finally { if ($locked) {$mutex.ReleaseMutex()};$mutex.Dispose() }
