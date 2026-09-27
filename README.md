# Nazzel

Nazzel is a local-first CLI and interactive TUI media downloader powered by `yt-dlp` and `ffmpeg`.

## Project Status

Nazzel is currently under active development. The core application logic, managed dependency system, and interactive TUI are implemented and verified on Windows x64.

**Note**: Standalone release packaging (Single Executable Applications) is currently under development. Linux and macOS native distributions are planned but not yet officially published.

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
