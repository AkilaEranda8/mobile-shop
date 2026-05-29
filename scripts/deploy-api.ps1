param(
  [string]$Message = "deploy",
  [string]$PlinkPassword = $env:PLINK_PASS,
  [string]$PlinkUser = "root",
  [string]$PlinkHost = "49.12.207.238"
)

function ExecGit([string]$cmd) {
  Write-Host "> git $cmd"
  $p = Start-Process git -ArgumentList $cmd -NoNewWindow -RedirectStandardOutput -RedirectStandardError -PassThru -Wait
  return $p.ExitCode
}

if (-not $PlinkPassword -or $PlinkPassword -eq "") {
  Write-Host "ERROR: Plink password not provided. Set PLINK_PASS env var or pass -PlinkPassword parameter." -ForegroundColor Red
  exit 2
}

Write-Host "Checking for local changes..."
$changes = & git status --porcelain
if ($changes) {
  Write-Host "Staging changes..."
  & git add -A
  Write-Host "Committing with message: $Message"
  & git commit -m "$Message"
} else {
  Write-Host "No local changes to commit."
}

Write-Host "Pushing to remote..."
$push = & git push
if ($LASTEXITCODE -ne 0) {
  Write-Host "git push failed (exit $LASTEXITCODE). Aborting." -ForegroundColor Red
  exit $LASTEXITCODE
}

# Build and restart remote service via plink
$remoteCmd = 'cd /opt/fashionerp && nohup docker compose build api > /tmp/api-build29.log 2>&1 && docker compose up -d --no-deps --force-recreate api >> /tmp/api-build29.log 2>&1 & echo BUILD_PID=$!'
$plinkArgs = @('-pw', $PlinkPassword, '-batch', "$PlinkUser@$PlinkHost", $remoteCmd)

Write-Host "Running remote build and restart..."
$proc = Start-Process -FilePath plink -ArgumentList $plinkArgs -NoNewWindow -Wait -PassThru
if ($proc.ExitCode -ne 0) {
  Write-Host "Remote deploy command failed (exit $($proc.ExitCode)). Check connectivity and credentials." -ForegroundColor Red
  exit $proc.ExitCode
}

Write-Host "Remote deploy command queued. Now tailing /tmp/api-build29.log (press Ctrl+C to stop)" -ForegroundColor Green
$tailArgs = @('-pw', $PlinkPassword, '-batch', "$PlinkUser@$PlinkHost", 'tail -f /tmp/api-build29.log')
& plink @tailArgs
