param([string]$OutputPath)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source=Join-Path $repo 'plugins/northglenn-sop-editor'
$manifest=Get-Content (Join-Path $source 'plugin.json') -Raw | ConvertFrom-Json
if(-not $OutputPath){$OutputPath=Join-Path $repo "deployment/northglenn-sop-editor-$($manifest.version).zip"}
$archive=[IO.Path]::GetFullPath($OutputPath)
Push-Location $repo
try{
 & node --test scripts/sop-word-conversion.test.mjs
 if($LASTEXITCODE -ne 0){throw 'Plugin checks failed.'}
 Add-Type -AssemblyName System.IO.Compression
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($archive))|Out-Null
 if(Test-Path -LiteralPath $archive){Remove-Item -LiteralPath $archive}
 [IO.Compression.ZipFile]::CreateFromDirectory($source,$archive)
 $zip=[IO.Compression.ZipFile]::OpenRead($archive)
 try{
  $names=@($zip.Entries | ForEach-Object {$_.FullName.Replace('\','/')})
  foreach($required in @('plugin.json','.codex-plugin/plugin.json','skills/sop-review-and-revision/SKILL.md','skills/word-sop-conversion/SKILL.md','skills/word-sop-conversion/scripts/docx-to-sop.mjs','skills/word-sop-conversion/scripts/sop-model.cjs')){
   if($required -notin $names){throw "Missing plugin component: $required"}
  }
  if($names | Where-Object {$_ -match '\.docx$|\.sop\.json$|(^|/)data/|node_modules/|(^|/)\.git/'}){throw 'Private input, generated data, or dependency files must not be packaged.'}
  Write-Output "Verified $($names.Count) packaged files: $archive"
 }finally{$zip.Dispose()}
}finally{Pop-Location}
