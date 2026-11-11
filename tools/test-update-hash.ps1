$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'update-local.ps1')
function Get-FileHash { throw 'Get-FileHash deliberadamente no disponible.' }
$root=Join-Path ([IO.Path]::GetTempPath()) ('sagva-hash-'+[guid]::NewGuid().ToString('N'))
$local=Join-Path $root '.local'; $dist=Join-Path $root 'client/dist'
try {
 New-Item -ItemType Directory -Force -Path $local,$dist | Out-Null
 $file=Join-Path $dist 'example.txt';[IO.File]::WriteAllText($file,'abc')
 if((GetLocalSha256 $file) -ne 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD'){throw 'SHA256 no coincide con vector conocido.'}
 $sha='a'*40;[IO.File]::WriteAllText((Join-Path $dist 'local-version.json'),('{"commit":"'+$sha+'"}'))
 SaveInstalledBuild $sha
 if(!(TestInstalledBuild $sha)){throw 'No se verificó manifiesto.'}
 [IO.File]::WriteAllText($file,'cambio')
 if(TestInstalledBuild $sha){throw 'No detectó alteración.'}
 Write-Output 'PASS: SHA256 conocido, manifiesto y alteración detectada sin Get-FileHash.'
}finally{
 if([IO.Path]::GetFullPath($root).StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath())+'sagva-hash-',[StringComparison]::OrdinalIgnoreCase)){Remove-Item -LiteralPath $root -Recurse -Force}
}
