# Nazzel

Nazzel is a local-first CLI and interactive TUI media downloader powered by `yt-dlp` and `ffmpeg`.

## Project Status

Nazzel is currently under active development. The core application logic, managed dependency system, and interactive TUI are implemented and verified on Windows, macOS, and Linux.

**Note**: Standalone release packaging (Single Executable Applications) is now available for all native targets!

## Future Installation Contract (Coming in Phase B3)

Nazzel is a **Terminal-First** application. The standalone binaries are native executables that run directly in your terminal without requiring Node.js to be installed.
There are **no GUIs, no graphical setup wizards, and no Electron desktop shells**.

The future automated installation experience (B3) will follow this exact contract:

### Windows
1. Run a terminal install command.
2. The installer will detect Windows x64 or ARM64.
3. It will download the correct Nazzel standalone binary.
4. It will verify the SHA256 hash automatically.
5. It will install the executable to a user-owned CLI directory and add it to the PATH.

### macOS / Linux
1. Run a terminal install command (`curl | bash` or similar).
2. The installer will detect OS and Architecture (x64/ARM64).
3. It will download the matching native binary.
4. It will verify the SHA256 hash.
5. It will place the executable in a user `bin` directory.

Currently, you must download the artifacts from the [GitHub Releases](https://github.com/Itsmhmod/nazzel/releases) page manually and place them in your `PATH`.

## Technology Stack

- **Runtime**: Node.js >= 22 (Current development targets Node 26 for experimental SEA)
- **Language**: TypeScript
- **UI Framework**: React + Ink (Terminal UI)
- **Core Dependencies**: `yt-dlp`, `ffmpeg`, `ffprobe` (managed automatically by Nazzel)

## Developer Setup

1. Clone the repository
2. Run `npm ci`
3. Run `npm run build`
4. Run `npm run dev` to start the CLI/TUI from source.

## Testing

- Unit tests: `npm run test:unit`
- TUI tests: `npm run test:tui`
- Integration tests: `npm run test:int`
- Full test suite: `npm run test`

## Official Repository
The canonical source for Nazzel is hosted at [GitHub](https://github.com/Itsmhmod/nazzel).

## Architecture

See `docs/` and the master plan for detailed architecture.

```
src/
  cli/           # Entry point, commands, flags, exit codes
  tui/           # React + Ink screens, state machine
  application/   # Orchestration, queue, recovery, history
  domain/        # Types, errors, events, constants (no deps)
  infrastructure/ # yt-dlp, FFmpeg, filesystem, process runner
  config/        # Schema, defaults, path resolution
  shared/        # Logger, retry, sanitize, event bus
```

## License

MIT
