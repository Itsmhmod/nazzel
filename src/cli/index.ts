#!/usr/bin/env node

import { createCli } from './cli.js';
import { initLogger } from '@nazzel/shared/logger.js';
import { getExitCodeForError, EXIT_CODES } from './exitCodes.js';

async function main() {
  // Initialize default logger (it may be re-initialized by specific commands like --no-tui)
  initLogger({ level: 'info', tui: true });

  const program = createCli();

  try {
    // Parse arguments and execute command
    await program.parseAsync(process.argv);
  } catch (err: any) {
    // Commander throws errors with specific codes for parsing issues
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exitCode = 0;
      return;
    }
    
    if (err.code === 'commander.unknownOption' || err.code === 'commander.missingArgument' || err.code === 'commander.invalidArgument') {
      process.exitCode = EXIT_CODES.CLI_INVALID_ARGS;
      return;
    }

    process.exitCode = getExitCodeForError(err);
  }
}

let isShuttingDown = false;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  process.exitCode = getExitCodeForError(reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  process.exitCode = getExitCodeForError(error);
  // Force exit on uncaught exception to avoid undefined state
  process.exit(process.exitCode);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  if (isShuttingDown) { return; } // Prevent duplicate handling
  isShuttingDown = true;
  process.exitCode = EXIT_CODES.CANCELLED;
  
  // Try to write NDJSON for the cancellation event if in machine-readable mode
  process.stdout.write(JSON.stringify({ type: 'PROCESS_INTERRUPTED' }) + '\n');
  
  // Give child processes (like yt-dlp) a moment to clean up via their own SIGINT
  // We fall back to process.exit() if Node doesn't exit naturally after 2 seconds
  setTimeout(() => {
    process.exit(process.exitCode);
  }, 2000).unref();
});

// Run
main().catch((err) => {
  process.exitCode = getExitCodeForError(err);
});
