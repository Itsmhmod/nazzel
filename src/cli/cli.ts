import { Command } from 'commander';
import { getExitCodeForError } from './exitCodes.js';
import { getLogger } from '@nazzel/shared/logger.js';
import { doctorCommand } from './commands/doctor.js';
import { historyCommand } from './commands/history.js';
import { configCommand } from './commands/config.js';
import { queueCommand } from './commands/queue.js';
import { updateCommand } from './commands/update.js';
import { versionCommand } from './commands/version.js';
import { repairCommand } from './commands/repair.js';
import { uninstallCommand } from './commands/uninstall.js';
import { NAZZEL_VERSION } from '../shared/version.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('nazzel')
    .description('Local-first terminal media downloader')
    .version(NAZZEL_VERSION, '-v, --version')
    .exitOverride() // So we can catch parse errors and exit manually
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
      writeOut: (str) => process.stdout.write(str),
    });

  // Default command: download
  program
    .argument('[url]', 'URL to download')
    .option('-f, --format <id>', 'Select specific format')
    .option('--audio-only', 'Download audio only')
    .option('-o, --output <path>', 'Specific output path')
    .option('--no-tui', 'Run in machine-readable NDJSON mode without TUI')
    .action(async (url, options) => {
      try {
        const { downloadCommand } = await import('./commands/download.js');
        await downloadCommand(url, options);
      } catch (error) {
        const logger = getLogger();
        logger.error('Unhandled command error', { error });
        process.exitCode = getExitCodeForError(error);
      }
    });

  // Subcommands
  program.addCommand(doctorCommand());
  program.addCommand(historyCommand());
  program.addCommand(configCommand());
  program.addCommand(queueCommand());
  program.addCommand(updateCommand());
  program.addCommand(versionCommand());
  program.addCommand(repairCommand());
  program.addCommand(uninstallCommand());

  return program;
}
