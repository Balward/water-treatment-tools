[CmdletBinding()]
param(
    [ValidateSet('All','Suite','Inventory')][string]$Target = 'All',
    [ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$Server = '192.168.0.88',
    [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$User = 'root',
    [switch]$PackageOnly
)
$ErrorActionPreference = 'Stop'
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). Deployment stopped." }
}
Push-Location $PSScriptRoot
try {
    Invoke-Checked 'node' @('scripts/sync-operations-theme.cjs')
    if ($Target -in @('All','Suite')) {
        foreach ($file in @('shared/operations/navigation.js','apps/dashboard/dashboard.js','claude-proxy-server.js','apps/live-operations-dashboard/script.js','apps/live-operations-dashboard/wall-ui.js','apps/live-operations-dashboard/wall-comments.js','apps/alum-hydrometer-conversion/operations-ui.js','apps/sodium-hypochlorite-calculator/calculation.js','apps/sodium-hypochlorite-calculator/operations.js','apps/water-data-explorer/operations.js','apps/water-data-explorer/operations-ui.js','apps/robojar-analyzer/operations.js','apps/robojar-analyzer/operations-ui.js','apps/dose-predictor/operations.js','apps/dose-predictor/operations-ui.js','apps/plant-flow/operations.js','apps/video-tutorials/operations.js','apps/water-treatment-flashcards/operations.js','apps/water-treatment-flashcards/operations-ui.js','apps/regulation-100-study/lessons.js','apps/regulation-100-study/operations.js','apps/regulation-100-study/operations-ui.js')) {
            Invoke-Checked 'node' @('--check',$file)
        }
        Invoke-Checked 'node' @('scripts/check-hypochlorite-math.cjs')
        New-Item -ItemType Directory -Force -Path 'deployment' | Out-Null
        $archive = Join-Path $PSScriptRoot 'deployment\water-treatment-tools.tar.gz'
        $files = @('Dockerfile','.dockerignore','package.json','package-lock.json','.env.template','claude-proxy-server.js','nginx.conf','global-styles.css','apps','assets','shared','docs','sample-data','README.md','docker-compose.yml','deploy-unraid.sh','update.sh')
        Invoke-Checked 'tar' (@('-czf',$archive,'--exclude=apps/operator-inventory','--exclude=*/design','--exclude=*/node_modules','--exclude=*/.env','--exclude=*/.env.backup','--exclude=*/preview','--exclude=*/data','-C',$PSScriptRoot) + $files)
        Write-Host "Suite package ready: $archive"
        if (-not $PackageOnly) {
            $destination = "${User}@${Server}"
            Invoke-Checked 'scp' @($archive,"${destination}:/mnt/user/appdata/water-treatment-tools.tar.gz")
            Invoke-Checked 'scp' @((Join-Path $PSScriptRoot 'deploy-unraid.sh'),"${destination}:/mnt/user/appdata/water-treatment-tools-update.sh")
            Invoke-Checked 'ssh' @($destination,'bash /mnt/user/appdata/water-treatment-tools-update.sh')
        }
    }
    if ($Target -in @('All','Inventory')) {
        $arguments = @{Server=$Server;User=$User;PackageOnly=$PackageOnly}
        & (Join-Path $PSScriptRoot 'apps\operator-inventory\deploy.ps1') @arguments
        if (-not $?) { throw 'Inventory deployment failed.' }
    }
    Write-Host "Finished: $Target"
} finally { Pop-Location }
