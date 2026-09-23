# Nazzel Testing Rules

## Required for Every Phase

A phase is NOT done until:
```
npm run typecheck   # exits 0
npm run lint        # exits 0
npm run test:unit   # exits 0, no skipped tests
npm run build       # exits 0
```

## Test File Location

- `tests/unit/` — pure logic tests, no I/O, no network, no real processes
- `tests/integration/` — real process calls, real filesystem, no real network
- `tests/tui/` — Ink component rendering tests
- `tests/fixtures/` — real captured yt-dlp / ffprobe output (never invented)

## Test File Naming

- Test files mirror source files: `src/shared/retry.ts` → `tests/unit/shared/retry.test.ts`
- Fixtures must include a header comment with the command that produced them and the date

## Fixture Rule

**All yt-dlp and FFprobe output used in tests must be real captured output.**

To capture a fixture:
```bash
yt-dlp --dump-json "https://example.com/video" > tests/fixtures/ytdlp-responses/example-video.json
```

Then add a comment at the top of the fixture file:
```
// Captured: 2026-09-22
// Command: yt-dlp --dump-json "https://www.youtube.com/watch?v=..."
// yt-dlp version: 2025.01.15
```

Never invent JSON responses for yt-dlp or ffprobe.

## Mocking Rules

- Only mock layer interfaces (`IMediaEngine`, `IFileSystem`, `IProcessRunner`), not concrete classes.
- In unit tests, always inject mocked interfaces via constructor parameters.
- Never mock `fs`, `child_process`, or Node built-ins directly in unit tests — wrap in an interface first.

## Test Coverage Expectations

| Layer | Target |
|---|---|
| Domain (types, errors, constants) | 90%+ |
| Shared (logger, retry, sanitize) | 85%+ |
| Application (orchestrator, recovery) | 80%+ |
| Infrastructure (parsers, detectors) | 75%+ |
| TUI state machine | 90%+ |

## What NOT to Test

- Do not test that yt-dlp successfully downloads a video (yt-dlp's responsibility)
- Do not test that FFmpeg successfully transcodes (FFmpeg's responsibility)
- Do not write tests for test utilities themselves
- Do not add `it.skip()` without a GitHub issue number in a comment

## Integration Test Tagging

Integration tests that require yt-dlp or network access must be in `tests/integration/` and must be tagged:
```typescript
it.skipIf(!process.env['NAZZEL_INTEGRATION'])('downloads a real video', async () => { ... });
```

Run integration tests with: `NAZZEL_INTEGRATION=1 npm run test:int`
