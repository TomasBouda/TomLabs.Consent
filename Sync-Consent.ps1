<#
.SYNOPSIS
    Copies tomlabs-consent.js from this repository into a web application's repository.

.DESCRIPTION
    Every app keeps its own copy of the script (no shared host, no runtime dependency).
    Without -Destination, every existing tomlabs-consent.js in the target repository is updated
    (node_modules, bin, obj, dist and .git are skipped). The first time, pass -Destination with the
    path of the app's static web root, relative to the repository.

.EXAMPLE
    ./Sync-Consent.ps1 -Repo F:\Root\GIT\GimmeImage -Destination src/GimmeImage/wwwroot/js

.EXAMPLE
    ./Sync-Consent.ps1 -Repo F:\Root\GIT\GimmeImage
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)] [string] $Repo,
    [string] $Destination
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'tomlabs-consent.js'
$fileName = 'tomlabs-consent.js'

function Get-ConsentVersion([string] $Path) {
    $header = Get-Content -LiteralPath $Path -TotalCount 1
    if ($header -match 'tomlabs-consent v(\S+)') { return $Matches[1] }
    return 'unknown'
}

if (-not (Test-Path -LiteralPath $Repo -PathType Container)) { throw "Repository '$Repo' does not exist." }
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$newVersion = Get-ConsentVersion $source

if ($Destination) {
    $folder = Join-Path $Repo $Destination
    if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
    $targets = @(Join-Path $folder $fileName)
}
else {
    $skip = '[\\/](node_modules|bin|obj|dist|\.git|\.ui-build)[\\/]'
    $targets = @(Get-ChildItem -LiteralPath $Repo -Recurse -File -Filter $fileName |
        Where-Object { $_.FullName -notmatch $skip } |
        ForEach-Object FullName)
    if ($targets.Count -eq 0) {
        throw "No $fileName found in '$Repo'. Run again with -Destination <static web root relative to the repository>."
    }
}

foreach ($target in $targets) {
    $oldVersion = if (Test-Path -LiteralPath $target) { Get-ConsentVersion $target } else { 'none' }
    if ($PSCmdlet.ShouldProcess($target, "Copy tomlabs-consent v$newVersion (was $oldVersion)")) {
        Copy-Item -LiteralPath $source -Destination $target -Force
        Write-Host "$($target.Substring($Repo.Length + 1)): $oldVersion -> $newVersion"
    }
}
