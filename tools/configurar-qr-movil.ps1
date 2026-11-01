param(
 [Parameter(Mandatory=$true)][string]$LanIp,
 [Parameter(Mandatory=$true)][string]$CertificatePath,
 [Parameter(Mandatory=$true)][string]$PrivateKeyPath,
 [switch]$ConfigurarFirewall
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $root
$local=Join-Path $root '.local'
$certificates=Join-Path $local 'certificados'
New-Item -ItemType Directory -Force -Path $certificates | Out-Null
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $certificates '/inheritance:r' '/grant:r' "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'No se pudieron proteger los certificados.'}
$suffix=[guid]::NewGuid().ToString('N')
$cert=Join-Path $certificates ('qr-mobile-'+$suffix+'.crt')
$key=Join-Path $certificates ('qr-mobile-'+$suffix+'.key')
if([IO.Path]::GetFullPath($CertificatePath) -ne $cert){Copy-Item -LiteralPath $CertificatePath -Destination $cert}
if([IO.Path]::GetFullPath($PrivateKeyPath) -ne $key){Copy-Item -LiteralPath $PrivateKeyPath -Destination $key}
$config=Join-Path $local 'mobile-https.json'
$pendingConfig=Join-Path $local ('mobile-https-'+$suffix+'.pending.json')
@{enabled=$true;port=5180;lanIp=$LanIp;certPath=$cert;keyPath=$key}|ConvertTo-Json|Set-Content -LiteralPath $pendingConfig -Encoding UTF8
& node.exe --input-type=module -e "import {mobileHttpsOptions} from './tools/start-web.mjs'; const c=mobileHttpsOptions(process.argv[1]); console.log('HTTPS preparado en https://'+c.lanIp+':'+c.port);" $pendingConfig
if($LASTEXITCODE -ne 0){throw 'Configuración anterior conservada. Revisa certificado, clave e IP.'}
if(Test-Path -LiteralPath $config){Copy-Item -LiteralPath $config -Destination ($config+'.'+(Get-Date -Format 'yyyyMMddHHmmss')+'.bak')}
Move-Item -LiteralPath $pendingConfig -Destination $config -Force
if($ConfigurarFirewall){
 if(!(Get-NetFirewallRule -Name 'AsistenciaHuellaMobile5180' -ErrorAction SilentlyContinue)){
  $nodePath=(Get-Command node.exe).Source
  New-NetFirewallRule -Name 'AsistenciaHuellaMobile5180' -DisplayName 'Asistencia Huella HTTPS movil 5180 (solo LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5180 -LocalAddress $LanIp -RemoteAddress LocalSubnet -Program $nodePath -Profile Any | Out-Null
 }
 Write-Host 'Regla HTTPS limitada al puerto 5180 y subred local.'
}
Write-Host 'Reinicia solo Asistencia Huella. El celular debe confiar en la CA del certificado y estar en la misma LAN.'
