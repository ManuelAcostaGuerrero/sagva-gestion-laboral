$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'update-local.ps1')
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'control-local.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controlador invalido'}
$guard=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'AssertUpdateNotBlocked'},$true)
Invoke-Expression $guard.Extent.Text
$base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$root=Join-Path $base ('sagva-update-test-'+[guid]::NewGuid().ToString('N'))
$local=Join-Path $root '.local';New-Item -ItemType Directory -Force -Path $local | Out-Null
$script:checks=0
function Assert($v,$m){if(!$v){throw $m};$script:checks++}
function Reject($op,$m){$failed=$false;try{&$op|Out-Null}catch{$failed=$true};Assert $failed $m}
function ResetFixture {
 $script:fakeBefore='a'*40;$script:fakeTarget='b'*40;$script:fakeBranch='int001-huella-codigo'
 $script:fakeAncestor=$true;$script:fakeMain=$false;$script:fakeMainAncestor=$true
 $script:fakeDirty=$false;$script:fakeActive=$true;$script:fakeValidBuild=$false
 $script:failure='';$script:events=@();$script:lastState=$null
 $stateFile=Join-Path $local 'update-state.json'
 if(Test-Path -LiteralPath $stateFile){Remove-Item -LiteralPath $stateFile}
}
function GitReady {if($script:fakeDirty){throw 'Cambios locales'}}
function GitText([string[]]$Arguments){switch($Arguments -join ' '){'rev-parse HEAD'{return $script:fakeBefore};'branch --show-current'{return $script:fakeBranch};'rev-parse origin/main'{return $script:fakeTarget};default{throw 'Git inesperado en doble'}}}
function GitAncestor($Before,$After){if($Before -eq 'main'){return $script:fakeMainAncestor};return $script:fakeAncestor}
function GitRefExists($Ref){return $script:fakeMain}
function Run($Command,[string[]]$Arguments){
 $operation=$Arguments -join ' ';$script:events+=@($operation)
 if($script:failure -eq 'dependencias' -and $operation -eq 'ci --offline --no-audit'){throw 'Dependencias no preparadas'}
 if($script:failure -eq 'migracion' -and $operation -eq 'tools/local-db.mjs migrate'){throw 'Migracion fallida'}
}
function UpdatePorts {}
function Owned {if($script:fakeActive){return @([pscustomobject]@{ProcessId=101},[pscustomobject]@{ProcessId=102})}}
function InstanceReady($Ids){return $script:fakeActive}
function TestInstalledBuild($Sha){return $script:fakeValidBuild}
function SetUpdateState($State){
 $script:lastState=$State.Clone()
 $State|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $local 'update-state.json')
}
function PrepareUpdate($Sha){
 $script:events+=@('preparar')
 if($script:failure -eq 'preparacion'){throw 'Candidato no compila'}
 $stage=Join-Path (Join-Path $local 'update-staging') ([guid]::NewGuid().ToString('N'))
 $dist=Join-Path $stage 'client\dist';New-Item -ItemType Directory -Force -Path $dist|Out-Null
 @{commit=$Sha}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $dist 'local-version.json')
 return $stage
}
function Backup {if($script:failure -eq 'respaldo'){throw 'Respaldo no valido'};$script:events+=@('respaldar');$script:LastBackup=Join-Path $local 'respaldo-ficticio'}
function StopOwn {$script:events+=@('detener');$script:fakeActive=$false}
function FreePorts {}
function ActivateMain($Plan){$script:events+=@('activar');$script:fakeBefore=$Plan.Target;$script:fakeBranch='main'}
function SaveInstalledBuild($Sha){$script:events+=@('sello');$script:fakeValidBuild=$true}
function StartOwn([switch]$Prepared){Assert $Prepared 'Reinicio repite respaldo/migracion';if($script:failure -eq 'reinicio'){throw 'No inicio'};$script:events+=@('iniciar');$script:fakeActive=$true}
try {
 ResetFixture
 $plan=ResolveUpdatePlan
 Assert ($plan.Branch -eq 'int001-huella-codigo' -and $plan.Target -eq $script:fakeTarget) 'Rama integrada no admitida'
 $script:fakeAncestor=$false;Reject {ResolveUpdatePlan} 'Se admitio rama divergente'
 ResetFixture;$script:fakeBranch='feat/sin-revisar';Reject {ResolveUpdatePlan} 'Se admitio rama no autorizada'
 ResetFixture;$script:fakeMain=$true;$script:fakeMainAncestor=$false;Reject {ResolveUpdatePlan} 'Se sobrescribio main local divergente'
 ResetFixture;$script:fakeDirty=$true;Reject {ResolveUpdatePlan} 'Se admitieron cambios locales'
 ResetFixture;$script:fakeBranch='main';$script:fakeBefore=$script:fakeTarget;$script:fakeValidBuild=$true
 RunLocalUpdate
 Assert (($script:events -notcontains 'detener') -and ($script:events -notcontains 'preparar')) 'Ya actualizado realizo instalacion'
 foreach($caseName in @('preparacion','respaldo')){
  ResetFixture;$script:failure=$caseName;Reject {RunLocalUpdate} ('Fallo no rechazado: '+$caseName)
  Assert ($script:fakeActive -and !$script:lastState.RecoveryRequired -and $script:events -notcontains 'detener') 'Fallo previo detuvo la instalacion'
 }
 foreach($caseName in @('dependencias','migracion','reinicio')){
  ResetFixture;$script:failure=$caseName;Reject {RunLocalUpdate} ('Fallo no rechazado: '+$caseName)
  Assert (!$script:fakeActive -and $script:lastState.RecoveryRequired) 'Fallo tras parada no dejo bloqueo'
  Reject {AssertUpdateNotBlocked} 'El inicio permite recuperacion no acreditada'
 }
 ResetFixture;RunLocalUpdate
 Assert ($script:fakeActive -and !$script:lastState.RecoveryRequired -and $script:lastState.Result -eq 'correcto') 'Instalacion correcta no acreditada'
 Assert (($script:events.IndexOf('preparar') -lt $script:events.IndexOf('respaldar')) -and ($script:events.IndexOf('respaldar') -lt $script:events.IndexOf('detener'))) 'Orden inseguro'
 ResetFixture;$script:fakeActive=$false;RunLocalUpdate
 Assert (!$script:fakeActive -and $script:events -notcontains 'iniciar') 'Sistema detenido fue iniciado sin solicitud'
 Write-Host "$script:checks aserciones correctas: ramas, no-op, errores, bloqueo, orden y estado previo. Sin DB ni procesos operativos."
} finally {
 $resolved=[IO.Path]::GetFullPath($root)
 if([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne $base.TrimEnd('\') -or ![IO.Path]::GetFileName($resolved).StartsWith('sagva-update-test-')){throw 'Temporal fuera de alcance'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
