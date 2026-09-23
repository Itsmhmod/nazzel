---
name: release
description: >
  Versioning policy, changelog generation, npm publish checklist,
  and binary packaging with Node SEA.
---

# Skill: Release Engineering

## Versioning Policy (Semver)

| Change Type | Version Bump | Example |
|---|---|---|
| Bug fix, no behavior change | PATCH | 0.1.0 → 0.1.1 |
| New feature, backward-compatible | MINOR | 0.1.0 → 0.2.0 |
| Breaking CLI change, removed flag | MAJOR | 0.1.0 → 1.0.0 |

First public release: `0.1.0`.

## Changelog Format (Keep a Changelog)

```markdown
# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-01
### Added
- Playlist support (#12)
- Clipboard URL detection (#8)

### Fixed
- Progress bar overflow on narrow terminals (#15)

### Changed
- Retry backoff cap increased to 30s (#18)
```

## Release Checklist

```bash
# 1. Ensure on main branch, clean state
git status  # must be clean

# 2. Full CI
npm run typecheck && npm run lint && npm run test && npm run build

# 3. Bump version
npm version patch|minor|major  # updates package.json and creates git tag

# 4. Update CHANGELOG.md manually — move Unreleased items to the new version

# 5. Build clean
npm run clean && npm run build

# 6. Inspect dist/
ls dist/cli/index.js  # must exist

# 7. Publish
npm publish --access public

# 8. Push tag
git push --follow-tags
```

## npm Package Contents

The `.npmignore` or `package.json` `files` field must include only:
```json
{
  "files": ["dist/", "README.md", "LICENSE"]
}
```

Never publish: `src/`, `tests/`, `.agents/`, `docs/` (source and tests are excluded).

## Node SEA (Single Executable Application)

For self-contained binary releases (no Node.js installation required):

```bash
# Generate the SEA blob
node --experimental-sea-config sea-config.json

# Inject into Node binary
cp $(which node) nazzel-linux-x64
npx postject nazzel-linux-x64 NODE_SEA_BLOB sea.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

Sea config (`sea-config.json`):
```json
{
  "main": "dist/cli/index.js",
  "output": "sea.blob",
  "disableExperimentalSEAWarning": true
}
```

Platform binaries are released as GitHub release assets:
- `nazzel-linux-x64`
- `nazzel-macos-arm64`
- `nazzel-win-x64.exe`

## Pre-release Smoke Test

After build, before publish:
```bash
node dist/cli/index.js --version
node dist/cli/index.js doctor
```

Both must exit 0 without errors.
