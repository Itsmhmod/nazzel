#!/usr/bin/env node
/**
 * @fileoverview Nazzel CLI entry point.
 *
 * This file is intentionally minimal for Phase 0.
 * It validates the Node.js version and prints version info.
 * Full command implementation happens in Phase 3.
 */

import { APP_NAME, MIN_NODE_VERSION } from '../domain/constants.js';

// ---------------------------------------------------------------------------
// Runtime version guard — fail fast before any other imports
// Uses process.version directly to avoid a semver dependency in Phase 0
// ---------------------------------------------------------------------------

function meetsMinNodeVersion(current: string, min: string): boolean {
  // Both strings are in the form "vMAJOR.MINOR.PATCH" or "MAJOR.MINOR.PATCH"
  const parse = (v: string): number[] =>
    v
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10));

  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [mMaj = 0, mMin = 0, mPatch = 0] = parse(min);

  if (cMaj !== mMaj) { return cMaj > mMaj; }
  if (cMin !== mMin) { return cMin > mMin; }
  return cPatch >= mPatch;
}

if (!meetsMinNodeVersion(process.version, MIN_NODE_VERSION)) {
  process.stderr.write(
    `${APP_NAME} requires Node.js ${MIN_NODE_VERSION} or higher.\n` +
      `You are running ${process.version}.\n` +
      `Please upgrade Node.js: https://nodejs.org\n`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main — placeholder for Phase 0
// Full CLI implementation is Phase 3.
// ---------------------------------------------------------------------------

function main(): void {
  process.stdout.write(`${APP_NAME} v0.1.0 — media downloader (Phase 0 skeleton)\n`);
  process.stdout.write('Run nazzel --help for usage (available in Phase 3).\n');
}

main();
