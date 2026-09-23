# Nazzel Coding Rules

## TypeScript

- `strict: true` is non-negotiable. Never disable strict checks.
- No `any`. Use `unknown` and narrow it.
- Prefer `readonly` for all object properties in domain types and interfaces.
- Use `as const` for literal objects used as lookup tables.
- Use `type` imports (`import type { ... }`) for type-only imports.
- Never use `// @ts-ignore` or `// @ts-expect-error` without a documented justification comment.

## Naming

- Interfaces are prefixed with `I`: `IMediaEngine`, `IFileSystem`.
- Types are PascalCase: `AppErrorCode`, `DependencyName`.
- Constants are SCREAMING_SNAKE_CASE: `MAX_RETRY_HARD_LIMIT`.
- Functions are camelCase: `validateUrl`, `consumeAttempt`.
- Files mirror their primary export: `AppError` lives in `errors.ts`, `IMediaEngine` in `IMediaEngine.ts`.

## Functions

- Max 40 lines per function. If longer, extract helpers.
- Every exported function has a JSDoc comment.
- Prefer early returns over deep nesting.
- No mutation of function parameters.

## Logging

- Never use `console.log`, `console.warn`, `console.error` in `src/`.
- All logging must go through `getLogger()` from `src/shared/logger.ts`.
- Test files may use `console` freely.

## Async

- Never create unhandled promise rejections. Every `promise.then()` that can reject must have a `.catch()`.
- Use `async/await` over raw `.then()` chains.
- Never `await` inside a loop when the calls are independent — use `Promise.all`.

## Process Execution

- Never use `exec`, `execSync`, `spawnSync`, or shell string commands.
- Always use `ProcessRunner.spawn()` or `ProcessRunner.run()` with an args array.
- Always pass the `--` sentinel before any user-supplied URL or path.

## File Size Limit

- Source files should not exceed 300 lines. Split into modules if longer.
- Exception: generated type files (e.g., `types.ts`).

## Imports

- Use `.js` extensions in all relative imports (required for ESM/NodeNext).
- Group imports: external → domain → shared → local.
- No circular imports. ESLint will flag these.

## Comments

- Explain *why*, not *what*.
- Complex algorithms need a block comment with a reference or explanation.
- TODO comments must include a GitHub issue number: `// TODO(#42): implement playlist support`.
