param([Parameter(Mandatory=$true)][string]$Workbook,[Parameter(Mandatory=$true)][string]$OutputJson,[ValidateSet(6,49)][int]$Columns=6)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Workbook))
function Read-Xml([string]$entryName) {
  $entry=$archive.GetEntry($entryName)
  if (!$entry) { return $null }
  $reader=[IO.StreamReader]::new($entry.Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  $strings=Read-Xml 'xl/sharedStrings.xml'
  $shared=@()
  if($strings){$shared=@($strings.sst.si | ForEach-Object { (@($_.SelectNodes('.//*[local-name()="t"]')) | ForEach-Object InnerText) -join '' })}
  $book=Read-Xml 'xl/workbook.xml'
  $rels=Read-Xml 'xl/_rels/workbook.xml.rels'
  $rows=[Collections.Generic.List[object]]::new()
  foreach($sheet in $book.workbook.sheets.sheet) {
    $relationId=$sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $relation=$rels.Relationships.Relationship | Where-Object Id -eq $relationId
    $target=[string]$relation.Target
    if($target.StartsWith('/')){$target=$target.TrimStart('/')}else{$target='xl/'+$target}
    $xml=Read-Xml $target
    foreach($row in $xml.worksheet.sheetData.row) {
      $values=[object[]]::new($Columns)
      foreach($cell in $row.c) {
        $reference=[string]$cell.r
        if($reference -notmatch '^([A-Z]+)[0-9]+$'){continue}
        $column=0
        foreach($letter in $Matches[1].ToCharArray()){$column=$column*26+([int]$letter-[int][char]'A'+1)}
        $column--
        if($column -ge $Columns){continue}
        $value=$null
        if($cell.t -eq 's'){$value=$shared[[int]$cell.v]}
        elseif($cell.t -eq 'inlineStr'){$value=(@($cell.is.SelectNodes('.//*[local-name()="t"]')) | ForEach-Object InnerText) -join ''}
        elseif($null -ne $cell.v){$value=[string]$cell.v}
        $dateColumn=($Columns -eq 6 -and $column -lt 2) -or ($Columns -eq 49 -and $column -in 7,8,9,18,48)
        if($dateColumn -and $value -match '^\d+(\.\d+)?$'){$value=[datetime]::FromOADate([double]$value).ToString('yyyy-MM-dd')}
        $values[$column]=$value
      }
      if(@($values | Where-Object {$null -ne $_ -and $_ -ne ''}).Count -gt 0){$rows.Add(@{sheet=[string]$sheet.name;row=[int]$row.r;values=$values})}
    }
  }
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputJson),(ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 8),[Text.UTF8Encoding]::new($false))
} finally {$archive.Dispose()}
