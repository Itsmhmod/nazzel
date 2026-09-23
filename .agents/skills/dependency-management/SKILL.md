---
name: dependency-management
description: >
  Binary detection, yt-dlp-wrap installation, FFmpeg binary download and
  verification, auto-update policy, and the nazzel doctor command.
---

# Skill: Dependency Management

## Detection Order

For each binary (yt-dlp, ffmpeg, ffprobe), detect in this order:

1. **Config override**: `config.ytdlpPath`, `config.ffmpegPath`, `config.ffprobePath`
2. **PATH lookup**: `which yt-dlp` / `where yt-dlp` on Windows
3. **Nazzel-managed directory**: `~/.local/share/nazzel/bin/` (Linux/macOS) or `%LOCALAPPDATA%\nazzel\bin\` (Windows)
4. **Failure**: return `IDependencyStatus { status: 'missing' }`

## Version Extraction

```typescript
// yt-dlp
const { stdout } = await runner.run({ bin: ytdlpPath, args: ['--version'], timeoutMs: 5000 });
// stdout: "2025.01.15\n"
const version = stdout.trim();

// ffmpeg
const { stdout } = await runner.run({ bin: ffmpegPath, args: ['-version'], timeoutMs: 5000 });
// stdout: "ffmpeg version 7.0.2 built with ..."
const version = stdout.match(/ffmpeg version (\S+)/)?.[1] ?? null;

// ffprobe — same as ffmpeg
```

## Version Comparison

Use the `semver` package for Node.js version comparison.

For yt-dlp (date-based versions like `2025.01.15`):
```typescript
// Compare as YYYYMMDD integers
const isOutdated = parseInt(detected.replace(/\./g, ''), 10) < parseInt(MIN_YTDLP_DATE, 10);
```

For FFmpeg (semver-like `7.0.2`):
```typescript
import { lt } from 'semver';
const isOutdated = lt(detectedVersion, MIN_FFMPEG_VERSION);
```

## yt-dlp Installation via yt-dlp-wrap

```typescript
import YTDlpWrap from 'yt-dlp-wrap';

// Downloads the correct platform binary to the managed dir
await YTDlpWrap.downloadFromGithub(managedBinDir);
```

## FFmpeg Binary Download

```typescript
// Platform binary sources (pinned versions):
const FFMPEG_SOURCES = {
  linux: { url: 'https://github.com/BtbN/FFmpeg-Builds/releases/...', sha256: '...' },
  darwin: { url: 'https://evermeet.cx/ffmpeg/...', sha256: '...' },
  win32: { url: 'https://github.com/BtbN/FFmpeg-Builds/releases/...', sha256: '...' },
};

// Verification before execution:
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

async function verifySha256(filePath: string, expected: string): Promise<boolean> {
  const data = await readFile(filePath);
  const hash = createHash('sha256').update(data).digest('hex');
  return hash === expected;
}
```

**Never execute a downloaded binary without a passing SHA-256 check.**

## Auto-Update Policy

- **yt-dlp**: Update on `nazzel update` command, or when `EXTRACTOR_FAILURE` occurs and the current version is outdated.
- **FFmpeg**: Never auto-updated. Too large, too risk-prone. Provide install instructions instead.
- **Update check cadence**: At most once per 24 hours. Cache the result in a temp file with a timestamp.

```typescript
// Update check debouncing
const LAST_CHECK_FILE = join(tmpdir(), 'nazzel-update-check.json');

async function shouldCheckForUpdate(): Promise<boolean> {
  try {
    const { checkedAt } = JSON.parse(await readFile(LAST_CHECK_FILE, 'utf8')) as { checkedAt: string };
    const elapsed = Date.now() - new Date(checkedAt).getTime();
    return elapsed > 24 * 60 * 60 * 1000; // 24 hours
  } catch {
    return true; // file doesn't exist — check
  }
}
```

## nazzel doctor Output Structure

```typescript
interface DoctorResult {
  allOk: boolean;
  items: Array<{
    name: string;
    status: 'ok' | 'missing' | 'outdated' | 'error';
    version: string | null;
    path: string | null;
    message?: string;
    action?: string; // actionable next step for non-ok items
  }>;
}
```

Display the results as a formatted table in both TUI and --no-tui modes.
