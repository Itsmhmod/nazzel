<#
.SYNOPSIS
Nazzel Terminal Installer for Windows
https://github.com/Itsmhmod/nazzel
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = "Itsmhmod/nazzel"
$InstallDir = Join-Path $env:LOCALAPPDATA "nazzel\bin"
$ExeName = "nazzel.exe"

# 1. Detect Architecture
$Arch = $env:PROCESSOR_ARCHITECTURE
if ($Arch -eq "AMD64") {
    $TargetArch = "x64"
} elseif ($Arch -eq "ARM64") {
    $TargetArch = "arm64"
} else {
    Write-Error "Unsupported architecture: $Arch"
    exit 1
}

Write-Host "=> Detecting latest stable release for windows-$TargetArch..."

# 2. Resolve Latest Release
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ReleaseApiUrl = "https://api.github.com/repos/$Repo/releases/latest"
try {
    $Release = Invoke-RestMethod -Uri $ReleaseApiUrl -UseBasicParsing
} catch {
    Write-Error "Failed to fetch release metadata. Network or rate limit issue."
    exit 1
}

$Version = $Release.tag_name.TrimStart('v')
$Tag = $Release.tag_name
Write-Host "=> Found Nazzel v$Version"

$ExactAssetName = "nazzel-$Version-windows-$TargetArch.exe"
$AssetDownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$ExactAssetName"
$ChecksumsUrl = "https://github.com/$Repo/releases/download/$Tag/SHA256SUMS"

# 3. Create temp directory
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "nazzel-install-$(New-Guid)"
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    # 4. Download Binary and Checksums
    $TmpExePath = Join-Path $TmpDir $ExactAssetName
    $TmpChecksumsPath = Join-Path $TmpDir "SHA256SUMS"

    Write-Host "=> Downloading binary..."
    curl.exe -# -L -o "$TmpExePath" "$AssetDownloadUrl"

    Write-Host "=> Downloading checksums..."
    curl.exe -sSL -o "$TmpChecksumsPath" "$ChecksumsUrl"

    # 5. Verify Integrity
    Write-Host "=> Verifying integrity..."
    $Checksums = Get-Content -Path $TmpChecksumsPath
    $ExpectedHashLine = $Checksums | Where-Object { $_ -match [regex]::Escape($ExactAssetName) }
    
    if (-not $ExpectedHashLine) {
        Write-Error "Checksum for $ExactAssetName not found in SHA256SUMS."
        exit 1
    }

    $ExpectedHash = ($ExpectedHashLine -split '\s+')[0].Trim().ToUpper()
    $ActualHash = (Get-FileHash -Path $TmpExePath -Algorithm SHA256).Hash.ToUpper()

    if ($ExpectedHash -ne $ActualHash) {
        Write-Error "Checksum mismatch! Expected $ExpectedHash but got $ActualHash. Download may be corrupted."
        exit 1
    }
    Write-Host "=> Checksum verified."

    # 6. Install Atomically
    Write-Host "=> Installing to $InstallDir..."
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $FinalExePath = Join-Path $InstallDir $ExeName
    # Atomic replace (overwrite)
    Move-Item -Path $TmpExePath -Destination $FinalExePath -Force

    # 7. Check PATH
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($UserPath -split ';' -notcontains $InstallDir) {
        Write-Host "=> Adding $InstallDir to User PATH..."
        $NewPath = "$UserPath;$InstallDir"
        [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
        $env:PATH = "$env:PATH;$InstallDir"
    }

    Write-Host "`n=> Successfully installed Nazzel v$Version."
    
    # Try running it
    & $FinalExePath --version
    
    Write-Host "=> Nazzel is ready! Run 'nazzel --help' to get started."
    Write-Host "Note: If 'nazzel' is not recognized in this current terminal window, please restart your terminal."

} finally {
    if (Test-Path $TmpDir) {
        Remove-Item -Path $TmpDir -Recurse -Force
    }
}
