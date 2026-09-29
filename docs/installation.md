# Installation

Nazzel is a **Terminal-First** application. It runs completely standalone—you do not need Node.js, yt-dlp, FFmpeg, or Deno installed on your system to use it. Nazzel downloads and manages its own dependencies internally.

## Supported Architectures

We provide pre-compiled native binaries for the following architectures:
- **Windows**: x64, ARM64
- **macOS**: Intel (x64), Apple Silicon (ARM64)
- **Linux**: x64, ARM64

---

## Windows

The Windows installer uses PowerShell to download the latest stable release, verify its SHA256 integrity, and place the executable in a user-owned directory (`%LOCALAPPDATA%\nazzel\bin`).

Run the following command in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Itsmhmod/nazzel/main/install.ps1' -OutFile 'install.ps1'; .\install.ps1; Remove-Item 'install.ps1'"
```

**What it does:**
1. Detects your Windows architecture (x64 or ARM64).
2. Downloads the matching official binary.
3. Automatically verifies the SHA-256 checksum to ensure it hasn't been tampered with.
4. Atomically places the executable at `%LOCALAPPDATA%\nazzel\bin\nazzel.exe`.
5. Safely adds this directory to your User `PATH` if it's not already there.

*Note: If the `nazzel` command is not immediately recognized, you may need to restart your terminal for the PATH changes to take effect.*

---

## macOS & Linux

The macOS and Linux installer uses a shell script to detect your OS and architecture, verify integrity, and place the binary into a standard user-local bin folder (`~/.local/bin`).

Run the following command in your terminal:

```bash
curl -sSL https://raw.githubusercontent.com/Itsmhmod/nazzel/main/install.sh | bash
```

**What it does:**
1. Detects your OS (`darwin` or `linux`) and architecture (`x64` or `arm64`).
2. Downloads the corresponding official binary.
3. Checks `SHA256SUMS` to verify the binary's integrity using `shasum` or `sha256sum`.
4. Makes the binary executable and atomically moves it to `~/.local/bin/nazzel`.

**PATH Behavior:**
If `~/.local/bin` is not in your shell's `PATH`, the installer will output instructions on how to add it. You will need to add it to your `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## Verification

After installation, verify that Nazzel is installed correctly:

```bash
nazzel --version
```

To see the status of Nazzel's managed internal dependencies (yt-dlp, ffmpeg), you can run:

```bash
nazzel doctor
```

*(Nazzel will automatically fetch its dependencies the first time it needs them, so it's normal if they are reported as "Not Installed" on first run).*

## Troubleshooting

- **Access Denied (Windows)**: If you get permission issues downloading, ensure you run the installation command from a normal, non-elevated user shell. The installer does not require Administrator privileges.
- **Checksum Mismatch**: If the installer reports a checksum mismatch, the download may have been interrupted or intercepted. Re-run the installation command.
- **Command Not Found**: Ensure you restarted your terminal. For macOS/Linux, verify that `~/.local/bin` is exported in your active shell profile (`~/.zshrc` or `~/.bashrc`).
