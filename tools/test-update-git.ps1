$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'update-local.ps1')
function Run($Command,[string[]]$Arguments){& $Command @Arguments | Out-Host;if($LASTEXITCODE -ne 0){throw 'Git de prueba fallo'}}
function GitReady {
 if((GitText @('status','--porcelain'))){throw 'Cambios locales'}
}
$base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture=Join-Path $base ('sagva-git-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $fixture|Out-Null
Push-Location -LiteralPath $fixture
try {
 Run 'git.exe' @('init','--bare','origin.git')
 Run 'git.exe' @('init','-b','main','seed')
 Push-Location -LiteralPath (Join-Path $fixture 'seed')
 try {
  Run 'git.exe' @('config','user.name','Prueba sintetica')
  Run 'git.exe' @('config','user.email','test@example.invalid')
  'base'|Set-Content -LiteralPath 'archivo.txt'
  Run 'git.exe' @('add','archivo.txt');Run 'git.exe' @('commit','-m','base')
  $first=GitText @('rev-parse','HEAD')
  Run 'git.exe' @('branch','int001-huella-codigo')
  'main siguiente'|Add-Content -LiteralPath 'archivo.txt'
  Run 'git.exe' @('commit','-am','candidato')
  $second=GitText @('rev-parse','HEAD')
  Run 'git.exe' @('remote','add','origin',(Join-Path $fixture 'origin.git'))
  Run 'git.exe' @('push','origin','main','int001-huella-codigo')
 }finally{Pop-Location}
 Run 'git.exe' @('clone','--single-branch','--branch','int001-huella-codigo',(Join-Path $fixture 'origin.git'),'instalacion')
 Push-Location -LiteralPath (Join-Path $fixture 'instalacion')
 try {
  $plan=ResolveUpdatePlan
  if($plan.Before -ne $first -or $plan.Target -ne $second){throw 'SHA no fijado'}
  ActivateMain $plan
  if((GitText @('branch','--show-current')) -ne 'main' -or (GitText @('rev-parse','HEAD')) -ne $second){throw 'main no activado'}
  if((GitText @('rev-parse','@{u}')) -ne $second){throw 'Seguimiento no configurado en clon single-branch'}
  if((GitText @('rev-parse','int001-huella-codigo')) -ne $first){throw 'Rama anterior modificada'}
  Run 'git.exe' @('switch','int001-huella-codigo')
  Run 'git.exe' @('config','user.name','Prueba sintetica');Run 'git.exe' @('config','user.email','test@example.invalid')
  'cambio unico'|Add-Content -LiteralPath 'archivo.txt'
  Run 'git.exe' @('commit','-am','no integrado')
  $rejected=$false;try{ResolveUpdatePlan|Out-Null}catch{$rejected=$true}
  if(!$rejected){throw 'Se admitio un commit no integrado'}
  Write-Host 'Git real: clon single-branch convertido a main, upstream correcto, rama anterior conservada y divergencia rechazada.'
 }finally{Pop-Location}
}finally{
 Pop-Location
 $resolved=[IO.Path]::GetFullPath($fixture)
 if([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne $base.TrimEnd('\') -or ![IO.Path]::GetFileName($resolved).StartsWith('sagva-git-test-')){throw 'Ruta temporal insegura'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
