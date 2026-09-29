# Nazzel B2 Release Engineering Report

## Executive Summary
Phase B2 successfully established the official production release pipeline for Nazzel. The pipeline is fully autonomous, consuming the exact verified artifacts from the `build-sea` jobs, executing independent validation, and automatically publishing GitHub Releases when prerequisites are met.

## Verification Baseline
The release process builds upon the verified B1.1 matrix:
- `windows-x64` (native)
- `windows-arm64` (native)
- `darwin-x64` (native on macOS-15-intel)
- `darwin-arm64` (native)
- `linux-x64` (native)
- `linux-arm64` (native)

## Release Architecture

### 1. Artifact Generation (`release.yml`)
1. **Tag Validation**: Ensures `v*` tags match the `package.json` version to prevent drift.
2. **Matrix Build**: The matrix builds Node SEA binaries across 6 targets concurrently.
3. **Offline Smoke Tests**: Validates dependencies, history configuration, and binary execution.
4. **Finalize**: 
   - Aggregates all native binaries.
   - Recalculates `SHA256` for every binary independently.
   - Generates `SHA256SUMS`.
   - Generates `release-manifest.json` referencing actual files.
   - Generates `actions/attest-build-provenance` over all final artifacts.
   - Archives everything under `release-artifacts`.

### 2. Autonomous Publication (`publish-release.yml`)
- Triggers on `workflow_run` success of the Native Release Pipeline.
- Downloads `release-artifacts` directly (preventing rebuilds).
- Independently recalculates and verifies `SHA256SUMS`.
- Extracts release notes dynamically from `CHANGELOG.md`.
- Automatically publishes the GitHub Release with the correct final artifacts attached.

## Installation Contract (B3 Forward-Look)
Nazzel is and remains **Terminal-First**. 
There will be no GUI, Electron shell, or graphical installer wizard. 
Phase B3 will implement installation scripts conforming to the following model:

- **Windows**: PowerShell script that detects x64/ARM64, verifies `SHA256`, and downloads the executable to the user's CLI directory.
- **Linux/macOS**: Shell script that detects architecture, verifies integrity, and places the executable in `/usr/local/bin` or `~/.local/bin`.

## Known Limitations
- **External Windows Validation**: The Windows external network validation step against YouTube often fails in GitHub Actions due to YouTube blocking/rate-limiting the runner's IP address. This is a known infrastructure constraint, not an artifact defect. Artifact integrity is isolated from this test.
- **Local Windows SEA Verification**: File-locking policies on Windows environments may interfere with `npm run build` or the `node-local.exe` testing execution (e.g. `Access is denied`). Verification delegates to the clean execution on GitHub's native Windows runners.
