# SEDSP Frontend — first-time setup (Windows)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ">> npm install..." -ForegroundColor Cyan
npm install

$envFile = Join-Path $root ".env"
$example = Join-Path $root ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $example)) {
  Copy-Item $example $envFile
  Write-Host ">> Created .env from .env.example" -ForegroundColor Green
}

Write-Host ">> Done. Run: npm run dev" -ForegroundColor Green
