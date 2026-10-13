[CmdletBinding()]
param(
    [ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$Server = '192.168.0.88',
    [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$User = 'root',
    [switch]$PackageOnly,
    [switch]$SkipTests
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$appRoot = $PSScriptRoot
$archive = Join-Path $repoRoot 'deployment\operator-inventory.tar.gz'
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). Deployment stopped." }
}
foreach ($program in @('node','npm.cmd','tar')) { Get-Command $program -ErrorAction Stop | Out-Null }
if (-not $PackageOnly) {
    foreach ($program in @('ssh','scp')) { Get-Command $program -ErrorAction Stop | Out-Null }
}
Push-Location $appRoot
try {
    if (-not $SkipTests) {
        if (-not (Test-Path -LiteralPath (Join-Path $appRoot 'node_modules\nodemailer'))) {
            Invoke-Checked 'npm.cmd' @('ci','--ignore-scripts')
        }
        Invoke-Checked 'npm.cmd' @('test')
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $archive -Parent) | Out-Null
    $files = @('Dockerfile','.dockerignore','.gitignore','.env.example','package.json','package-lock.json','server.js','email.js','catalog.json','compose.yaml','public','test','README.md','UNRAID-SETUP.md','import-workbook.ps1','scrape-images.js','import-image.js','image-sources.json','image-import-report.json','pack-size-review.json','deploy.ps1','deploy-unraid.sh')
    Invoke-Checked 'tar' (@('-czf',$archive,'-C',$appRoot) + $files)
    if ($PackageOnly) { Write-Host "Package ready: $archive"; return }
    $target = "${User}@${Server}"
    Write-Host "Uploading to $target..."
    Invoke-Checked 'scp' @($archive,"${target}:/mnt/user/appdata/operator-inventory.tar.gz")
    Invoke-Checked 'scp' @((Join-Path $appRoot 'deploy-unraid.sh'),"${target}:/mnt/user/appdata/operator-inventory-update.sh")
    Write-Host 'Unpacking, rebuilding, and checking the app on Unraid...'
    Invoke-Checked 'ssh' @($target,'bash /mnt/user/appdata/operator-inventory-update.sh')
    Write-Host 'Deployment complete. Open https://inventory.gibbhub.io'
} finally { Pop-Location }
