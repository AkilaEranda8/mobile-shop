# Publish Hexalyte-Setup.exe + desktop-version.json to production web downloads.
# Prereq: npm run dist:desktop  (and HEXALYTE_SSH_PASS set for remote upload)
param(
  [string]$HostName = $(if ($env:HEXALYTE_SSH_HOST) { $env:HEXALYTE_SSH_HOST } else { '157.180.113.249' }),
  [string]$RemoteDir = '/opt/hexalyte/apps/web/public/downloads'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$pkgPath = Join-Path $root 'apps\desktop\package.json'
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$version = $pkg.version
$setup = Join-Path $root "apps\desktop\dist\Hexalyte-Setup-$version.exe"
$webCopy = Join-Path $root 'apps\web\public\downloads\Hexalyte-Setup.exe'
$versionJson = Join-Path $root 'apps\web\public\downloads\desktop-version.json'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$hostkey = if ($env:HEXALYTE_SSH_HOSTKEY) { $env:HEXALYTE_SSH_HOSTKEY } else { 'SHA256:MaoCAPagrZeoANEjYH9e2cgUAdAxSbUEA23KfqqCIRU' }

if (-not (Test-Path $setup)) {
  Write-Host "ERROR: $setup not found. Run: npm run dist:desktop" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path $webCopy) | Out-Null
Copy-Item $setup $webCopy -Force
Write-Host "Local copy: $webCopy"

$manifestObj = [ordered]@{
  version     = $version
  downloadUrl = '/downloads/Hexalyte-Setup.exe'
  message     = 'A new Hexalyte desktop update is available. Please install it to continue.'
}
$manifest = ($manifestObj | ConvertTo-Json -Compress)
[System.IO.File]::WriteAllText($versionJson, $manifest)
Write-Host "Wrote $versionJson (v$version)"

if (-not $env:HEXALYTE_SSH_PASS) {
  Write-Host "HEXALYTE_SSH_PASS not set - local file ready; remote upload skipped." -ForegroundColor Yellow
  exit 0
}

if (-not (Test-Path $plink) -or -not (Test-Path $pscp)) {
  Write-Host "PuTTY plink/pscp not found - upload manually to $RemoteDir" -ForegroundColor Yellow
  exit 0
}

Write-Host "Ensuring remote downloads dir..."
& $plink -ssh -batch -pw $env:HEXALYTE_SSH_PASS -hostkey $hostkey "root@${HostName}" "mkdir -p $RemoteDir"

Write-Host "Uploading installer + version manifest..."
& $pscp -batch -pw $env:HEXALYTE_SSH_PASS -hostkey $hostkey $webCopy "root@${HostName}:${RemoteDir}/Hexalyte-Setup.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $pscp -batch -pw $env:HEXALYTE_SSH_PASS -hostkey $hostkey $versionJson "root@${HostName}:${RemoteDir}/desktop-version.json"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Uploaded. Download URL: https://app.hexalyte.com/downloads/Hexalyte-Setup.exe"
Write-Host "Version manifest: https://app.hexalyte.com/downloads/desktop-version.json (v$version)"
