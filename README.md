# Nazzel

> Local-first terminal media downloader — beautiful TUI, powered by yt-dlp.

**Status**: Phase 0 — Project Foundation

## Requirements

- Node.js ≥ 20 LTS
- yt-dlp (auto-managed)
- FFmpeg (auto-managed or manually installed)

## Quick Start

```bash
npm install
npm run build
node dist/cli/index.js
```

## Development

```bash
npm run typecheck   # type check
npm run lint        # lint
npm run test        # all tests
npm run test:unit   # unit tests only
npm run test:watch  # watch mode
```

## Architecture

See [docs/architecture.md](docs/architecture.md) and the master plan.

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

## Agents & Skills

This project is configured for use with Antigravity IDE.
See [.agents/](.agents/) for agents, skills, and coding rules.

## License

MIT
