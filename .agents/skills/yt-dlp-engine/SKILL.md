---
name: yt-dlp-engine
description: >
  Reference guide for yt-dlp integration: structured output modes, progress
  templates, format selectors, the -- sentinel, and yt-dlp-wrap usage.
---

# Skill: yt-dlp Engine Integration

## Fundamental Principle

**Always use structured output. Never parse human-readable yt-dlp text.**

## Analysis Command

```typescript
// Always use this exact argument structure
const args = [
  '--dump-json',        // structured JSON metadata output
  '--no-playlist',      // single video only (unless playlist mode)
  '--no-warnings',      // suppress warnings from stderr
  '--no-color',         // no ANSI in output
  '--',                 // ← MANDATORY end-of-options sentinel
  url,                  // user URL as a separate argv element
];
```

Output: A single JSON line on stdout. Parse with `JSON.parse()`. Never regex-parse this.

## Download Command

```typescript
const progressTemplate = JSON.stringify({
  _type: 'progress',
  status: '%(progress.status)s',
  percent: '%(progress.percentage)s',
  speed: '%(progress.speed)s',
  eta: '%(progress.eta)s',
  downloaded: '%(progress.downloaded_bytes)s',
  total: '%(progress.total_bytes)s',
  fragment_index: '%(progress.fragment_index)s',
  fragment_count: '%(progress.fragment_count)s',
});

const args = [
  '--newline',
  '--progress-template', progressTemplate,
  '--print-json',          // emit final metadata JSON on completion
  '-f', formatId,
  '-o', outputTemplate,    // e.g. '/path/to/dir/%(id)s.%(ext)s'
  '--merge-output-format', 'mp4',
  '--',
  url,
];
```

## Progress Line Classification

stdout lines from the download command are one of:
1. Progress JSON line (starts with `{"_type":"progress"`)
2. Final metadata JSON (large JSON object, `_type` is absent or `"video"`)
3. `[download]` status lines — ignore these (they are human-readable duplicates)

```typescript
function classifyOutputLine(line: string): 'progress' | 'metadata' | 'ignore' {
  if (!line.startsWith('{')) return 'ignore';
  try {
    const parsed = JSON.parse(line) as { _type?: string };
    return parsed._type === 'progress' ? 'progress' : 'metadata';
  } catch {
    return 'ignore';
  }
}
```

## Format Schema (key fields)

```typescript
// From yt-dlp --dump-json .formats[]
interface YtDlpFormat {
  format_id: string;
  ext: string;
  resolution: string;    // e.g. "1920x1080" or "audio only"
  fps: number | null;
  vcodec: string;        // "none" for audio-only
  acodec: string;        // "none" for video-only
  filesize: number | null;
  filesize_approx: number | null;
  tbr: number | null;
  format_note: string | null;
}
```

## Format Scoring

Best format selection logic (lives in `src/infrastructure/ytdlp/formats.ts`):

1. Score by resolution height (prefer 1080p over 720p)
2. Prefer `mp4` container over `webm`
3. Prefer h264 over vp9 for compatibility
4. Group video-only + audio-only pairs into combined formats

## The -- Sentinel Rule

```typescript
// ❌ WRONG — URL could start with - and be interpreted as a flag
['yt-dlp', '--dump-json', url]

// ✅ CORRECT — -- terminates option parsing
['yt-dlp', '--dump-json', '--', url]
```

This is mandatory for every yt-dlp invocation. The `--` must be the last option before user input.

## Error Detection

yt-dlp exit codes:
- `0` = success
- `1` = error (check stderr for details)
- `101` = too many retries (treat as NETWORK_FAILURE)

Common stderr patterns to classify (parse only these exact strings):
- `"ERROR: [Errno"` → FS_PERMISSION_DENIED or FS_WRITE_FAILED
- `"ERROR: Unable to download"` → NETWORK_FAILURE
- `"ERROR: Unsupported URL"` → EXTRACTOR_FAILURE
- `"ERROR: requested format not available"` → FORMAT_UNAVAILABLE

## yt-dlp-wrap Usage

```typescript
import YTDlpWrap from 'yt-dlp-wrap';

// Get binary path
const ytDlpWrap = new YTDlpWrap(resolvedBinaryPath);

// Check version
const version = await ytDlpWrap.getVersion();

// The actual spawning is handled by ProcessRunner — not yt-dlp-wrap directly
// yt-dlp-wrap is used for binary management only
```
