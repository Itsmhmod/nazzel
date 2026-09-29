# Security Policy

## Supported Versions

We currently provide support and security updates for the latest stable release only.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Nazzel, please report it privately by opening a GitHub Security Advisory on the [Nazzel repository](https://github.com/Itsmhmod/nazzel/security/advisories) or reaching out directly to the maintainers. Do not disclose the vulnerability publicly until it has been patched.

We aim to respond to security reports within 72 hours.

## Release Verification and Provenance

Nazzel takes the security of its standalone binary releases seriously.

1. **Checksum Verification**: Every release includes a `SHA256SUMS` file containing the SHA-256 hashes of all released artifacts. The official installation scripts automatically verify this checksum before installing the binary.
2. **Build Provenance**: All artifacts are built using GitHub Actions on GitHub-hosted native runners. We generate SLSA build provenance attestations for every artifact via `actions/attest-build-provenance`, binding the compiled binaries strictly to the workflow and commit that produced them.
3. **No Embedded Secrets**: The release artifacts, including the Single Executable Applications (SEA), are audited to ensure no development credentials, `.env` files, or configuration secrets are included.
4. **Update Trust Model**: Updates must always trace back to an official GitHub Release from this repository and must pass SHA-256 integrity validation. Do not install binaries from untrusted forks or third-party mirrors.
