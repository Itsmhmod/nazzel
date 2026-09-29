# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-29

### Added
- Standalone SEA (Single Executable Application) distribution foundation exists for Windows, macOS, and Linux.
- Native targets (`windows-x64`, `windows-arm64`, `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`) are successfully built by CI.
- Automated provenance attestation, release manifests, and SHA256SUMS generated for all native binaries.
- Terminal-first CLI and TUI for downloading media powered by yt-dlp.

### Known Limitations
- Windows GitHub-hosted YouTube external smoke tests can be affected by external service restrictions (e.g., YouTube IP bans/rate limits). This does not affect artifact integrity.
- Standalone binaries require manual placement in the PATH. There is no automated installer available yet.
