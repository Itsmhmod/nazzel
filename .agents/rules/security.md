# Nazzel Security Rules

## Process Execution

**CRITICAL: Never construct shell command strings from user input.**

```typescript
// ❌ FORBIDDEN
exec(`yt-dlp ${url}`)
spawn('sh', ['-c', `yt-dlp ${url}`])
execa('yt-dlp', [url])  // without -- sentinel

// ✅ REQUIRED
execa('yt-dlp', ['--dump-json', '--', url])
//                               ^^^  End-of-options sentinel mandatory
```

The `--` sentinel must appear before every user-controlled argument in every yt-dlp and ffprobe invocation. This is a non-negotiable rule enforced by the `@security-reviewer` agent on every PR.

## Input Validation

- All user-supplied input (URLs, paths, format IDs) must be validated through `src/shared/sanitize.ts` before use.
- `validateUrl()` must be called before any URL is passed to the media engine.
- `validateOutputDir()` must be called before any path is used for file output.
- `validateFormatId()` must be called before any format ID is passed to yt-dlp.

## Output Path Confinement

The final download path must be verified to be within the user's configured `outputDir`:

```typescript
const resolved = path.resolve(outputDir, filename);
if (!resolved.startsWith(path.resolve(outputDir))) {
  throw new AppError('FS_PATH_INVALID', 'Path traversal detected in output path');
}
```

## Filename Generation

- Never use the media title directly as a filename — always run through `sanitizeFilename()`.
- The yt-dlp output template must be `%(id)s.%(ext)s` (safe, unique identifiers only).
- Human-readable names are applied via filesystem rename after download, using `sanitizeFilename()`.

## History File

- History entries must never contain authentication tokens, passwords, or API keys.
- URLs in history are stored as-is (they may contain watch tokens from services, which is acceptable).
- The history file is not world-readable: set permissions to 0600 on write (Unix).

## Config File

- The config file is set to 0600 permissions on write (Unix).
- Config values are validated with Zod on every load — corrupted config surfaces a clear error.
- Config values are never interpolated into shell commands.

## Dynamic Code Execution

- `eval()` is forbidden (enforced by ESLint `no-eval`).
- `new Function()` is forbidden (enforced by ESLint `no-new-func`).
- `require()` with user-controlled paths is forbidden.
- Dynamic `import()` with user-controlled paths is forbidden.

## Dependency Downloads

When downloading FFmpeg or yt-dlp binaries:
- Download from a pinned, well-known URL (not user-configurable).
- Verify the downloaded binary with a SHA-256 checksum before extraction.
- Never execute a downloaded binary without first verifying its checksum.
- Store managed binaries in a Nazzel-controlled directory, not in temp.

## Error Messages

- Never include raw stack traces in user-facing error messages.
- Never include internal file paths in error messages that are shown to the user.
- Use `AppError.toJSON()` for structured error output — it excludes the stack.

## Secrets in Logs

- The structured logger must never receive auth tokens or passwords as context values.
- URLs logged in debug mode are acceptable (they may contain query params from video services).
