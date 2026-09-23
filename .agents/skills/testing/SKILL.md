---
name: testing
description: >
  Vitest setup, fixture capture workflow, ink-testing-library patterns,
  process lifecycle tests, and integration test gating.
---

# Skill: Testing

## Running Tests

```bash
npm run test:unit      # tests/unit/**/*.test.ts
npm run test:tui       # tests/tui/**/*.test.tsx
npm run test:int       # tests/integration/**/*.test.ts
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

## Vitest Import Style

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

No globals. Always import from `vitest`.

## Mocking Application Interfaces

```typescript
// Create a typed mock of an interface
const mockEngine: IMediaEngine = {
  analyze: vi.fn().mockResolvedValue(mockMediaInfo),
  download: vi.fn(),
};

// Inject via constructor
const orchestrator = new DownloadOrchestrator(mockEngine, mockFileSystem, mockEventBus);
```

Never mock concrete classes. Only mock interfaces.

## Fixture Capture Workflow

```bash
# 1. Capture real yt-dlp output (requires yt-dlp installed)
yt-dlp --dump-json "https://www.youtube.com/watch?v=jNQXAC9IVRw" \
  > tests/fixtures/ytdlp-responses/yt-first-video-metadata.json

# 2. Add header comment to the fixture file
```

```jsonc
// Captured: 2026-09-22
// Command: yt-dlp --dump-json "https://www.youtube.com/watch?v=jNQXAC9IVRw"
// yt-dlp version: 2025.01.15
// NOTE: Sensitive fields (like cookies) have been removed
{
  "id": "jNQXAC9IVRw",
  ...
}
```

## Loading Fixtures in Tests

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadFixture(name: string): string {
  return readFileSync(resolve(__dirname, `../../fixtures/${name}`), 'utf8');
}

const rawJson = loadFixture('ytdlp-responses/yt-first-video-metadata.json');
const metadata = JSON.parse(rawJson);
```

## TUI Screen Tests with ink-testing-library

```typescript
import { render } from 'ink-testing-library';
import React from 'react';
import { HomeScreen } from '../../../src/tui/screens/HomeScreen.js';

const homeState: TuiState = { screen: 'HOME', url: '' };

it('renders the URL input prompt', () => {
  const { lastFrame } = render(
    React.createElement(HomeScreen, { state: homeState, dispatch: vi.fn() }),
  );
  expect(lastFrame()).toContain('Enter a URL to download');
});

it('dispatches URL_SUBMITTED when Enter is pressed', () => {
  const dispatch = vi.fn();
  const { stdin } = render(
    React.createElement(HomeScreen, { state: { ...homeState, url: 'https://example.com' }, dispatch }),
  );
  stdin.write('\r'); // Enter key
  expect(dispatch).toHaveBeenCalledWith({ type: 'URL_SUBMITTED', url: 'https://example.com' });
});
```

## Process Lifecycle Tests

```typescript
it('terminates the child process when AbortSignal fires', async () => {
  const controller = new AbortController();
  const runner = new ProcessRunner();

  // Start a long-running process
  const promise = runner.run({
    bin: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 60000)'],
    signal: controller.signal,
    timeoutMs: 30_000,
  });

  // Abort it
  setTimeout(() => controller.abort(), 50);

  // Expect a CANCELLED error
  await expect(promise).rejects.toMatchObject({ code: 'CANCELLED' });
});
```

## Integration Test Gating

```typescript
// Gate tests that require real yt-dlp or network
const integrationEnabled = !!process.env['NAZZEL_INTEGRATION'];

it.skipIf(!integrationEnabled)('downloads a real video', async () => {
  // ...
});
```

Run with: `NAZZEL_INTEGRATION=1 npm run test:int`

## State Machine Tests

```typescript
// tuiMachineReducer is a pure function — test all transitions
describe('tuiMachineReducer', () => {
  it('transitions from HOME to ANALYZING on URL_SUBMITTED', () => {
    const state: TuiState = { screen: 'HOME', url: '' };
    const next = tuiMachineReducer(state, { type: 'URL_SUBMITTED', url: 'https://example.com' });
    expect(next.screen).toBe('ANALYZING');
    expect(next.url).toBe('https://example.com');
  });

  it('stays in HOME on URL_SUBMITTED with empty URL', () => {
    const state: TuiState = { screen: 'HOME', url: '' };
    const next = tuiMachineReducer(state, { type: 'URL_SUBMITTED', url: '' });
    expect(next.screen).toBe('HOME'); // Guard prevents transition
  });
});
```
