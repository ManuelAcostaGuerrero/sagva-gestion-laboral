$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'control-local.ps1'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'El controlador no se puede analizar'}
foreach($name in @('Listeners','FreePorts','Owned','InstanceReady','AssertUpdateNotBlocked','StartOwn','StopOwn')) {
 $fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 if(!$fn){throw "Falta funcion $name"}
 Invoke-Expression $fn.Extent.Text
}
$portMatch=[regex]::Match((Get-Content $source -Raw),'foreach \(\$port in @\((\d+),(\d+)\)\)')
if(!$portMatch.Success){throw 'No se identificaron los puertos propios'}
$apiPort=[int]$portMatch.Groups[1].Value; $webPort=[int]$portMatch.Groups[2].Value
$tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$root=Join-Path $tempBase ('sagva-control-test-'+[guid]::NewGuid().ToString('N'))
$local=Join-Path $root '.local'
New-Item -ItemType Directory -Path $local -Force | Out-Null
$created=[datetime]'2026-11-03T12:00:00Z'
$records=@(@{Id=101;Created=$created.ToUniversalTime().ToString('o');Script=(Join-Path $root 'tools\start-backend.mjs')},@{Id=102;Created=$created.ToUniversalTime().ToString('o');Script=(Join-Path $root 'tools\start-web.mjs')})
$fake=@{}
foreach($r in $records){$fake[$r.Id]=[pscustomobject]@{ProcessId=$r.Id;Name='node.exe';CreationDate=$created;CommandLine=('node "'+$r.Script+'"')}}
$script:connections=@([pscustomobject]@{LocalPort=$apiPort;OwningProcess=101},[pscustomobject]@{LocalPort=$webPort;OwningProcess=102},[pscustomobject]@{LocalPort=65000;OwningProcess=999})
$script:stops=@();$script:assertions=0
function Get-CimInstance {param($ClassName,$Filter) $n=[int]([regex]::Match($Filter,'\d+').Value); return $fake[$n]}
function Get-NetTCPConnection {param($State) return $script:connections}
function Invoke-RestMethod {param($Uri,$TimeoutSec) return @{service='attendance-fingerprint-api'}}
function Invoke-WebRequest {param($Uri,[switch]$UseBasicParsing,$TimeoutSec) return @{StatusCode=200}}
function Stop-Process {param($Id) $script:stops+=@($Id)}
function Ports {}
function Run {throw 'No debe instalar ni migrar en una segunda apertura'}
function Backup {throw 'No debe respaldar en una segunda apertura'}
function Assert($value,$message){if(!$value){throw $message};$script:assertions++}
function Reject($operation,$message){$rejected=$false;try{& $operation}catch{$rejected=$true};Assert $rejected $message}
try {
 ConvertTo-Json -InputObject $records | Set-Content -LiteralPath (Join-Path $local 'processes.json')
 Assert (@(Owned).Count -eq 2) 'Identidad valida no reconocida'
 Assert (InstanceReady @(101,102)) 'Instancia propia sana no reconocida'
 StartOwn
 Assert ($script:stops.Count -eq 0) 'Segunda apertura detuvo procesos'
 $fake[101].CommandLine='node C:\otro-proyecto\tools\start-backend.mjs'
 Assert (@(Owned).Count -eq 1) 'Se adopto proceso de otra ruta'
 $fake[101].CommandLine=$null
 Reject {Owned | Out-Null} 'Comando inaccesible debe impedir control'
 Assert ($script:stops.Count -eq 0) 'Proceso inaccesible detenido'
 $fake[101].CommandLine='node "'+$records[0].Script+'"'
 $fake[101].CreationDate=$created.AddSeconds(1)
 Assert (@(Owned).Count -eq 1) 'Se adopto PID reutilizado'
 $fake[101].CreationDate=$created
 $script:connections=@([pscustomobject]@{LocalPort=$apiPort;OwningProcess=999},[pscustomobject]@{LocalPort=$webPort;OwningProcess=102})
 Assert (!(InstanceReady @(101,102))) 'Salud admitio servicio ajeno'
 Reject {StartOwn} 'Instancia parcial debe impedir duplicado'
 Reject {FreePorts} 'Puerto ajeno debe rechazar inicio'
 Assert ($script:stops.Count -eq 0) 'Conflicto cerro otro proyecto'
 StopOwn
 Assert (($script:stops -join ',') -eq '101,102') 'Detencion fuera de los PID acreditados'
 Assert (!(Test-Path -LiteralPath (Join-Path $local 'processes.json'))) 'Registro propio no retirado'
 Write-Host "$script:assertions controles aprobados: identidad, permisos, PID reutilizado, inicio repetido y aislamiento. Dobles sin bases reales."
} finally {
 $resolved=[IO.Path]::GetFullPath($root)
 if([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne $tempBase.TrimEnd('\') -or ![IO.Path]::GetFileName($resolved).StartsWith('sagva-control-test-')){throw 'Ruta temporal insegura'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
