# Operacion manual local. Nunca importar fuentes ni abrir un navegador aqui.
function GitText([string[]]$Arguments) {
  $value = @(& git.exe @Arguments)
  if ($LASTEXITCODE -ne 0) { throw "Git no pudo completar: $($Arguments[0])" }
  return ($value -join "`n").Trim()
}
function GitAncestor([string]$Before, [string]$After) {
  & git.exe merge-base --is-ancestor $Before $After
  if ($LASTEXITCODE -notin @(0,1)) { throw 'No se pudo verificar la ascendencia Git.' }
  return ($LASTEXITCODE -eq 0)
}
function GitRefExists([string]$Ref) {
  & git.exe show-ref --verify --quiet $Ref
  if ($LASTEXITCODE -notin @(0,1)) { throw 'No se pudo verificar la rama local.' }
  return ($LASTEXITCODE -eq 0)
}
function ResolveUpdatePlan {
  GitReady
  $before = GitText @('rev-parse','HEAD')
  $branch = GitText @('branch','--show-current')
  if ($branch -notin @('main','int001-huella-codigo')) { throw 'Rama de desarrollo no autorizada para instalar. Se conservan sus cambios.' }
  Run 'git.exe' @('fetch','origin','main:refs/remotes/origin/main') | Out-Host
  $target = GitText @('rev-parse','origin/main')
  if ($target -notmatch '^[a-f0-9]{40}$') { throw 'SHA de main invalido.' }
  if (!(GitAncestor $before $target)) { throw 'La rama instalada tiene cambios no integrados en main. No se descartaron commits.' }
  if ((GitRefExists 'refs/heads/main') -and !(GitAncestor 'main' $target)) { throw 'main local diverge de GitHub. No se sobrescribio.' }
  return @{Before=$before;Branch=$branch;Target=$target}
}
function SetUpdateState($State) {
  $State.Date = [datetime]::UtcNow.ToString('o')
  $file = Join-Path $local 'update-state.json'
  $pending = $file + '.pending'
  ConvertTo-Json -InputObject $State -Depth 5 | Set-Content -LiteralPath $pending -Encoding UTF8
  Move-Item -LiteralPath $pending -Destination $file -Force
}
function TestInstalledBuild([string]$Sha) {
  try {
    $file = Join-Path $local 'installed-build.json'
    if (!(Test-Path -LiteralPath $file)) { return $false }
    $stamp = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if ($stamp.Commit -ne $Sha -or !$stamp.Files.Count) { return $false }
    $dist = [IO.Path]::GetFullPath((Join-Path $root 'client\dist'))
    foreach ($entry in $stamp.Files) {
      $path = [IO.Path]::GetFullPath((Join-Path $dist $entry.Path))
      if (!$path.StartsWith($dist+'\',[StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
      if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $entry.Hash) { return $false }
    }
    return $true
  } catch { return $false }
}
function SaveInstalledBuild([string]$Sha) {
  $dist = Join-Path $root 'client\dist'
  $version = Get-Content -LiteralPath (Join-Path $dist 'local-version.json') -Raw | ConvertFrom-Json
  if ($version.commit -ne $Sha) { throw 'La compilacion no corresponde al SHA preparado.' }
  $files = @(Get-ChildItem -LiteralPath $dist -File -Recurse | ForEach-Object {
    @{Path=$_.FullName.Substring($dist.Length+1);Hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
  })
  @{Commit=$Sha;Files=$files} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $local 'installed-build.json') -Encoding UTF8
}
function PrepareUpdate([string]$Sha) {
  $parent = Join-Path $local 'update-staging'
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $stage = Join-Path $parent ([guid]::NewGuid().ToString('N'))
  Run 'git.exe' @('worktree','add','--detach',$stage,$Sha) | Out-Host
  $script:PreparedPath = $stage
  Push-Location -LiteralPath $stage
  try {
    Run 'npm.cmd' @('ci','--no-audit') | Out-Host
    Run 'node.exe' @('tools/validate-update.mjs') | Out-Host
    Run 'npm.cmd' @('run','test:server') | Out-Host
    Run 'npm.cmd' @('run','build','--workspace','client') | Out-Host
    Run 'npm.cmd' @('audit','--audit-level=high') | Out-Host
    Run 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File','tools/test-control-local.ps1') | Out-Host
    Run 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File','tools/test-update-local.ps1') | Out-Host
    if ((GitText @('status','--porcelain'))) { throw 'La preparacion modifico archivos versionados.' }
    $version = Get-Content -LiteralPath 'client\dist\local-version.json' -Raw | ConvertFrom-Json
    if ($version.commit -ne $Sha) { throw 'Candidato compilado con otro SHA.' }
  } finally { Pop-Location }
  return $stage
}
function ActivateMain($Plan) {
  if (GitRefExists 'refs/heads/main') { Run 'git.exe' @('switch','main'); Run 'git.exe' @('merge','--ff-only',$Plan.Target) }
  else { Run 'git.exe' @('switch','-c','main',$Plan.Target) }
  Run 'git.exe' @('branch','--set-upstream-to=origin/main','main')
  if ((GitText @('rev-parse','HEAD')) -ne $Plan.Target) { throw 'No se activo el SHA fijado.' }
}
function RunLocalUpdate {
  AssertUpdateNotBlocked
  $plan = ResolveUpdatePlan
  UpdatePorts
  $owned = @(Owned)
  $resume = $owned.Count -gt 0
  if ($resume -and !(InstanceReady @($owned.ProcessId))) { throw 'La instancia actual esta incompleta. Revisar antes de actualizar.' }
  if ($plan.Branch -eq 'main' -and $plan.Before -eq $plan.Target -and (TestInstalledBuild $plan.Target)) {
    Write-Host "Ya esta actualizado: $($plan.Target). Sin reinicio ni pestanas nuevas."
    return
  }
  $state = @{Before=$plan.Before;BeforeBranch=$plan.Branch;Target=$plan.Target;WasRunning=$resume;Stage='preparando';Result='en_curso';RecoveryRequired=$false}
  SetUpdateState $state
  $stopped = $false
  try {
    Write-Host '1/4 Preparando y probando sin detener el sistema...'
    $stage = PrepareUpdate $plan.Target
    $state.Stage='respaldo'; $state.Prepared=$stage; SetUpdateState $state
    GitReady
    if ((GitText @('rev-parse','HEAD')) -ne $plan.Before -or (GitText @('branch','--show-current')) -ne $plan.Branch) { throw 'La instalacion cambio durante la preparacion.' }
    UpdatePorts
    Backup
    $state.Backup=$script:LastBackup; SetUpdateState $state
    Write-Host '2/4 Activando solo este proyecto...'
    # Desde aqui cualquier fallo exige revisar el estado; nunca restaurar una base a ciegas.
    $stopped=$true; $state.Stage='activando'; $state.RecoveryRequired=$true; SetUpdateState $state
    StopOwn
    FreePorts
    ActivateMain $plan
    Run 'npm.cmd' @('ci','--offline','--no-audit')
    $dist=Join-Path $root 'client\dist'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    # Conservar assets antiguos permite terminar formularios abiertos sin perder sus recursos.
    Copy-Item -Path (Join-Path $stage 'client\dist\*') -Destination $dist -Recurse -Force
    Write-Host '3/4 Migrando con respaldo previo verificado...'
    $state.Stage='migraciones'; SetUpdateState $state
    Run 'node.exe' @('tools/local-db.mjs','check')
    Run 'node.exe' @('tools/local-db.mjs','migrate')
    Run 'node.exe' @('tools/local-db.mjs','diagnose')
    SaveInstalledBuild $plan.Target
    Write-Host '4/4 Verificando instalacion y estado previo...'
    $state.Stage='verificando'; $state.RecoveryRequired=$false; SetUpdateState $state
    if ($resume) { StartOwn -Prepared }
    if (!(TestInstalledBuild $plan.Target)) { throw 'No coincide el manifiesto de la compilacion instalada.' }
    if ($resume -and !(InstanceReady @((@(Owned)).ProcessId))) { throw 'El servicio actualizado no esta listo.' }
    $state.Stage='completado'; $state.Result='correcto'; SetUpdateState $state
    Write-Host "Actualizacion completada: main $($plan.Target)."
    if ($resume) { Write-Host 'Sistema funcionando en http://localhost:5183. Conserva tu pestana; guarda tus cambios y recargala cuando corresponda.' }
    else { Write-Host 'El sistema estaba detenido y permanece detenido. Usa Iniciar.bat cuando lo necesites.' }
    try {
      $expected=[IO.Path]::GetFullPath((Join-Path $local 'update-staging'))+'\'
      if (![IO.Path]::GetFullPath($stage).StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta de preparacion fuera del proyecto.' }
      Run 'git.exe' @('worktree','remove','--force',$stage)
    } catch { Write-Warning 'Instalacion correcta; preparacion conservada para diagnostico.' }
  } catch {
    $state.Result='fallido'; $state.Error=$_.Exception.Message; $state.RecoveryRequired=$stopped; SetUpdateState $state
    if ($stopped) { try { StopOwn } catch { Write-Warning 'Revisar procesos propios en Estado antes de recuperar.' }; Write-Host 'Inicio bloqueado hasta revisar el registro y el respaldo. No se restauro ni borro la base.' }
    else { Write-Host 'Fallo antes de detener: la instalacion anterior permanece intacta.' }
    throw
  }
}
