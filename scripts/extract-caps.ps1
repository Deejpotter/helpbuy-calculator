# Generates src/lib/areaData.ts from the official postcode-tool snapshots (tmp-caps-*.txt).
# Only major-region (capital city and regional centre) localities are bundled; any locality
# not in this file is treated as "rest of state" by default. ACT/NT have flat caps.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..

$majorCaps = @{
  VIC = '$950,000'
  NSW = '$1,300,000'
  QLD = '$1,000,000'
  WA  = '$850,000'
  SA  = '$900,000'
  TAS = '$700,000'
  ACT = '$1,000,000'
  NT  = '$600,000'
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("// GENERATED 23 Oct 2026 from the official postcode tool on firsthomebuyers.gov.au`n")
[void]$sb.Append("// (17,539 localities across 8 states). Only major-region (capital city and regional`n")
[void]$sb.Append("// centre) localities are bundled; any locality NOT in this file is treated as`n")
[void]$sb.Append("// `rest of state` by default. Re-generate with scripts/extract-caps.ps1 when the`n")
[void]$sb.Append("// scheme updates its classification.`n`n")
[void]$sb.Append('export const GENERATED_ON = "2026-10-23";' + "`n`n")
[void]$sb.Append("export const MAJOR_LOCALITIES = {`n")

$totalMajor = 0
foreach ($s in @("VIC","NSW","QLD","WA","SA","TAS","ACT","NT")) {
  $cap = $majorCaps[$s]
  $entries = Get-Content "tmp-caps-$s.txt" |
    Where-Object { $_.Contains($cap) } |
    ForEach-Object {
      $p = $_ -split "\|"
      $suburb = $p[1].Trim() -replace "\s+$s$", ""
      "$suburb|$($p[0])"
    } |
    Sort-Object -Unique
  $totalMajor += $entries.Count
  $oneLine = $entries -join ";"
  [void]$sb.AppendLine("  ${s}: `"$oneLine`",")
}
[void]$sb.AppendLine("} as const;")

Set-Content -Path "src/lib/areaData.ts" -Value $sb.ToString() -Encoding utf8
Write-Output "major localities bundled: $totalMajor"
Write-Output ("file size: " + (Get-Item "src/lib/areaData.ts").Length + " bytes")
