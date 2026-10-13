param([Parameter(Mandatory=$true)][string]$Workbook)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$book = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Workbook))
function Read-Entry($name) {
    $reader = [IO.StreamReader]::new($book.GetEntry($name).Open())
    try { [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
    $strings = Read-Entry 'xl/sharedStrings.xml'
    $shared = @($strings.sst.si | ForEach-Object { $_.InnerText })
    $items = @()
    $categories = @('Operating supplies', 'Janitorial supplies', 'Dewatering supplies')
    foreach ($sheet in 1..3) {
        $xml = Read-Entry "xl/worksheets/sheet$sheet.xml"
        $links = @{}
        $relsPath = "xl/worksheets/_rels/sheet$sheet.xml.rels"
        if ($book.GetEntry($relsPath)) {
            $rels = Read-Entry $relsPath
            foreach ($link in $xml.worksheet.hyperlinks.hyperlink) {
                $linkId = $link.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
                $target = $rels.Relationships.Relationship | Where-Object { $_.Id -eq $linkId -and $_.Type -like '*/hyperlink' }
                if ($target.Target -match '^https?://') { $links[[string]($link.ref -replace '\D', '')] = [string]$target.Target }
            }
        }
        $location = ''
        foreach ($row in $xml.worksheet.sheetData.row) {
            $cells = @{}
            foreach ($cell in $row.c) {
                if ($null -ne $cell.v) {
                    $value = [string]$cell.v
                    if ($cell.t -eq 's') { $value = $shared[[int]$value] }
                    $cells[($cell.r -replace '\d', '')] = $value.Trim()
                }
            }
            if ([int]$row.r -lt 5) { continue }
            if ($sheet -eq 3) {
                $location = 'Dewatering Building'
                $description = $cells['A']; $unit = $cells['B']; $parText = $cells['C']
                $company = $cells['O']; $number = $cells['P']; $size = $cells['Q']
            } else {
                if ($cells['A']) { $location = $cells['A'] }
                $description = $cells['B']; $unit = $cells['C']; $parText = $cells['D']
                $company = $cells['P']; $number = $cells['Q']; $size = $cells['R']
            }
            if (!$description -or !$parText -or $description -eq 'UPDATED') { continue }
            $parsed = 0.0
            $numeric = [double]::TryParse($parText, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)
            $items += [ordered]@{
                id = "s$sheet-r$($row.r)"; description = $description; location = $location
                category = $categories[$sheet-1]; countSize = $unit
                par = $(if ($numeric) { $parsed } else { $null })
                parNote = $(if (!$numeric) { $parText } else { '' })
                company = $company; itemNumber = $number; caseSize = $size
                productUrl = $(if ($links[[string]$row.r]) { $links[[string]$row.r] } else { '' })
                sourceSheet = $sheet; sourceRow = [int]$row.r
            }
        }
    }
    $catalog = [ordered]@{ source = [IO.Path]::GetFileName($Workbook); items = $items }
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'catalog.json'), ($catalog | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
    Write-Output "Imported $($items.Count) items in $(@($items.location | Sort-Object -Unique).Count) locations."
} finally { $book.Dispose() }
