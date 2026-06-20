# Bootstrap Node.js 22+ for Windows setup scripts (no Node prerequisite).
# On success: writes resolved node.exe path to scripts/.node-path.txt and stdout.
# On failure: writes errors to stderr and exits non-zero.

$ErrorActionPreference = 'Stop'

$NodeMajorMin = 22
$NodeVersion = '22.16.0'
$NodeZip = "node-v$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZip"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$ToolsNode = Join-Path $Root '.tools\node\node.exe'
$NodePathFile = Join-Path $ScriptDir '.node-path.txt'

function Test-NodeVersion {
    param([string]$NodeExe)
    if (-not (Test-Path $NodeExe)) { return $false }
    try {
        $versionOutput = & $NodeExe --version 2>$null
        if (-not $versionOutput) { return $false }
        $major = [int]($versionOutput -replace '^v(\d+)\..*', '$1')
        return $major -ge $NodeMajorMin
    } catch {
        return $false
    }
}

function Resolve-SystemNode {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd -and (Test-NodeVersion $cmd.Source)) {
        return $cmd.Source
    }
    return $null
}

function Install-PortableNode {
    $toolsDir = Join-Path $Root '.tools'
    $zipPath = Join-Path $toolsDir $NodeZip
    $extractDir = Join-Path $toolsDir 'node-extract'

    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    if (Test-Path $extractDir) {
        Remove-Item -Recurse -Force $extractDir
    }

    Write-Host "Downloading Node.js $NodeVersion..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $NodeUrl -OutFile $zipPath -UseBasicParsing

    Write-Host "Extracting to .tools/node/ ..." -ForegroundColor Cyan
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $extractedNodeDir = Join-Path $extractDir "node-v$NodeVersion-win-x64"
    $targetDir = Join-Path $toolsDir 'node'
    if (Test-Path $targetDir) {
        Remove-Item -Recurse -Force $targetDir
    }
    Move-Item -Path $extractedNodeDir -Destination $targetDir

    Remove-Item -Force $zipPath
    Remove-Item -Recurse -Force $extractDir

    if (-not (Test-NodeVersion $ToolsNode)) {
        throw "Portable Node install failed: $ToolsNode not found or version too old."
    }

    return $ToolsNode
}

try {
    $resolved = Resolve-SystemNode
    if (-not $resolved -and (Test-NodeVersion $ToolsNode)) {
        $resolved = $ToolsNode
    }
    if (-not $resolved) {
        $resolved = Install-PortableNode
    }

    Set-Content -Path $NodePathFile -Value $resolved -Encoding ascii -NoNewline
    exit 0
} catch {
    Write-Error $_
    exit 1
}
