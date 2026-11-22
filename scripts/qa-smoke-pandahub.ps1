<#
.SYNOPSIS
  Exercise PandaHub CLI -> real Git ref -> persisted AI Insights on a staging repo.
.DESCRIPTION
  Creates a disposable Git project in TEMP and pushes ONLY a new qa-smoke-* branch
  to an already existing PandaHub repository. Never writes to main or deletes data.
  Does not run without -Execute. Opting into external AI requires -EnableAI.
  This is a LIVE staging test, not a replacement for CI or isolated build runners.
.EXAMPLE
  .\scripts\qa-smoke-pandahub.ps1 -Repository "yourname/test-project"
.EXAMPLE
  .\scripts\qa-smoke-pandahub.ps1 -Repository "yourname/test-project" -Execute -EnableAI
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Repository,
    [switch]$Execute,
    [switch]$EnableAI
)

$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
    throw 'Repository must be OWNER/REPOSITORY.'
}
if (-not (Get-Command panda -ErrorAction SilentlyContinue)) {
    throw 'Install the PandaHub CLI first (pip install -e .\cli).'
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Install Git first.'
}

$branch = 'qa-smoke-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$workdir = Join-Path $env:TEMP ('PandaHub-QA-' + [guid]::NewGuid().ToString('N').Substring(0, 10))

Write-Host 'PandaHub live smoke test' -ForegroundColor Cyan
Write-Host "Target repository: $Repository"
Write-Host "New remote branch: $branch"
Write-Host "Local scratch directory: $workdir"
Write-Host 'Use a disposable STAGING repository only. The script never targets main.'
if (-not $Execute) {
    Write-Host 'DRY RUN: no repository changes. Add -Execute to push synthetic QA code.' -ForegroundColor Yellow
    if ($EnableAI) {
        Write-Host 'AI opt-in requested; this allows code diffs to go to an external AI provider.'
    }
    return
}

panda whoami
if ($LASTEXITCODE -ne 0) {
    throw 'PandaHub is not logged in. Run panda login and try again.'
}

# Only synthetic test code is used. Never copy local production code or tokens.
New-Item -ItemType Directory -Path $workdir -Force | Out-Null
Push-Location $workdir
try {
    git init -q
    if ($LASTEXITCODE -ne 0) { throw 'Git init failed' }
    git config user.name 'PandaHub QA'
    git config user.email 'pandahub-qa@example.invalid'
    git switch -c $branch
    if ($LASTEXITCODE -ne 0) { throw 'Could not create QA branch' }

    @'
# PandaHub QA repository
Synthetic code for validating the PandaHub Git-to-AI integration.
'@ | Set-Content -Encoding utf8 README.md

    @'
def authenticate(value):
    if not value:
        raise ValueError("Input is required")
    return True
'@ | Set-Content -Encoding utf8 app.py

    git add README.md app.py
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage QA files' }
    git commit -qm 'QA: verify PandaHub Git and AI pipeline'
    if ($LASTEXITCODE -ne 0) { throw 'Could not commit QA files' }

    panda remote-add $Repository
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure PandaHub remote' }

    if ($EnableAI) {
        # This opt-in applies to the whole test repo, not just its QA branch.
        panda insights enable $Repository
        if ($LASTEXITCODE -ne 0) { throw 'AI opt-in failed. Nothing has been pushed.' }
    }

    panda push -u pandahub $branch
    if ($LASTEXITCODE -ne 0) { throw 'Git push failed. Check authentication and Git backend logs.' }

    $sha = (git rev-parse HEAD).Trim()
    Write-Host "Pushed $sha on $branch" -ForegroundColor Green

    git ls-remote --exit-code pandahub ("refs/heads/" + $branch)
    if ($LASTEXITCODE -ne 0) {
        throw 'Push appeared successful, but remote did not advertise the branch.'
    }

    Write-Host 'Checking recorded insights (a worker may still be processing)...' -ForegroundColor Cyan
    panda insights list $Repository --limit 10
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Insights lookup failed. Check API permissions and database migrations.'
    }

    Write-Host "QA workspace preserved: $workdir"
    Write-Host "Check the Insights page and run: panda insights show $Repository $sha"
    Write-Host 'Only a completed job with real suggestions confirms AI output.'
    Write-Host 'Delete the QA branch manually after checking results.'
}
finally {
    Pop-Location
}
