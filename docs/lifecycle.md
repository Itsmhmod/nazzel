# Lifecycle Management

Nazzel provides built-in commands to safely manage its own lifecycle, including updates, repairs, and uninstallation.

All of these commands operate without needing external package managers (no Node.js, npm, or Homebrew required).

## Update

Nazzel can update itself to the latest stable release securely and atomically.

```bash
nazzel update
```

**How it works:**
1. It connects to GitHub Releases to discover the latest stable version.
2. It verifies the new version is actually newer (downgrades require `--version <version>`).
3. It downloads the exact native executable for your architecture to a temporary location.
4. It downloads the official `SHA256SUMS` and mathematically verifies the temporary executable.
5. It atomically replaces the active binary.
6. It runs a test execution of the new binary. If it crashes, it automatically rolls back to your old version.

### Check for Updates

If you just want to see if an update is available without modifying your system:

```bash
nazzel update --check
```

*Note: Nazzel does **not** check for updates in the background, and has no telemetry.*

---

## Repair

If you accidentally deleted a managed dependency or your downloads are failing due to FFmpeg/yt-dlp issues:

```bash
nazzel repair
```

**How it works:**
1. It cleans up any leftover temporary files from previous updates.
2. It strictly validates your managed dependencies.
3. If any are missing or corrupted, it automatically redownloads them via the `DependencyManager`.
4. It leaves your configuration and history fully intact.

---

## Uninstall

To safely remove Nazzel from your system:

```bash
nazzel uninstall
```

**What it does:**
- It deletes the Nazzel executable.
- On Windows, it safely removes Nazzel's installation directory from your User `PATH`.
- **It preserves** your application data, history, configuration files, and previously downloaded dependencies in case you want to reinstall later.

### Full Purge (Destructive)

If you want to remove absolutely everything Nazzel has ever touched (except your downloaded media):

```bash
nazzel uninstall --purge-data
```

**What it does:**
- Everything in the standard uninstall.
- Deletes the `~/.local/share/nazzel` (or `%LOCALAPPDATA%\nazzel\Data`) directory (which removes yt-dlp, FFmpeg, Deno).
- Deletes your configuration file.
- Deletes your download history database.
- Deletes your cached files.
