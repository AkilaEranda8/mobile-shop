# Publish Hexalyte-Setup.exe to production web downloads folder.
# Prereq: npm run dist:desktop  (and HEXALYTE_SSH_PASS set for remote upload)
param(
  [string]$HostName = $(if ($env:HEXALYTE_SSH_HOST) { $env:HEXALYTE_SSH_HOST } else { '157.180.113.249' }),
  [string]$RemoteDir = '/opt/hexalyte/apps/web/public/downloads'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$setup = Join-Path $root 'apps\desktop\dist\Hexalyte-Setup-1.0.0.exe'
$webCopy = Join-Path $root 'apps\web\public\downloads\Hexalyte-Setup.exe'

if (-not (Test-Path $setup)) {
  Write-Host "ERROR: $setup not found. Run: npm run dist:desktop" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path $webCopy) | Out-Null
Copy-Item $setup $webCopy -Force
Write-Host "Local copy: $webCopy"

if (-not $env:HEXALYTE_SSH_PASS) {
  Write-Host "HEXALYTE_SSH_PASS not set — local file ready; skip remote upload." -ForegroundColor Yellow
  exit 0
}

$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$hostkey = 'SHA256:MaoCAPagrZeoANEjYH9e2cgUAdAxSbUEA23KfqqCIRU'
if (-not (Test-Path $pscp)) {
  Write-Host "pscp not found — upload manually to $RemoteDir" -ForegroundColor Yellow
  exit 0
}

Write-Host "Ensuring remote downloads dir..."
$plink = 'C:\Program Files\PuTTY\plink.exe'
& $plink -ssh -batch -pw $env:HEXALYTE_SSH_PASS -hostkey $hostkey "root@$HostName" "mkdir -p $RemoteDir"

Write-Host "Uploading to root@${HostName}:$RemoteDir ..."
& $pscp -batch -pw $env:HEXALYTE_SSH_PASS -hostkey $hostkey $webCopy "root@${HostName}:$RemoteDir/Hexalyte-Setup.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Uploaded. Download URL: https://app.hexalyte.com/downloads/Hexalyte-Setup.exe"
