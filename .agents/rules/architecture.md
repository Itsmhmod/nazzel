# Nazzel Architecture Rules

These rules are enforced at code review time by the `@architect` agent and at compile time by ESLint layer boundary rules.

## Layer Dependency Rules

```
CLI → Application interfaces
TUI → Application interfaces (NOT concrete implementations, NOT infrastructure)
Application → Infrastructure interfaces (NOT concrete implementations)
Infrastructure → Domain types, OS APIs
Domain → Nothing (no imports from any other layer)
Shared → Domain types only
Config → Domain types only
```

**Violations are build errors.** ESLint `import/no-restricted-paths` enforces this at CI time.

## Interface-First Design

- Every external dependency (yt-dlp, FFmpeg, filesystem, clipboard) must be accessed through an interface defined in `src/application/interfaces/`.
- Concrete implementations live in `src/infrastructure/`.
- Application layer tests mock these interfaces. Integration tests use real implementations.

## Process Execution Rules

- `ProcessRunner` is the **only** place in the codebase that calls `child_process.spawn` or `execa`.
- `shell: false` is mandatory. Never `shell: true`.
- The `--` end-of-options sentinel is mandatory whenever user-controlled input (URL, path, format ID) is passed to any external CLI tool.
- Binary paths must be resolved absolute paths. Never pass a bare command name that depends on PATH to `execa`.

## State Machine Rule

- The TUI state machine (`tuiMachineReducer`) must be a pure function: `(state, event) => state`.
- No side effects in the reducer. No async operations. No I/O.

## Output Template Rule

- yt-dlp output filename templates use yt-dlp's own template language (`%(id)s.%(ext)s`).
- Never construct filename strings by concatenating user input.

## Error Model Rule

- All errors crossing layer boundaries must be `AppError` instances.
- Never throw raw `Error`, `TypeError`, or string values across boundaries.
- Infrastructure layer converts OS/process errors into `AppError` before they escape.

## No Business Logic in TUI

- TUI components may only render state and emit commands.
- No format parsing, no retry logic, no file path construction in `.tsx` files.

## No Unnecessary States

- Do not add TUI states unless the architecture requires them.
- Each new state requires: a screen component, all transition handlers, and tests.
