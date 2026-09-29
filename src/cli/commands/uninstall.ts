import { Command } from 'commander';
import { LifecycleManager } from '../../application/LifecycleManager.js';

export function uninstallCommand(): Command {
  const cmd = new Command('uninstall');
  cmd.description('Uninstall Nazzel');

  cmd.option('--purge-data', 'Purge all application data, history, configuration, and logs');

  cmd.action(async (options) => {
    const lifecycle = new LifecycleManager();

    try {
      process.stdout.write(`Starting uninstall...\n`);
      if (options.purgeData) {
        process.stdout.write(
          `WARNING: --purge-data flag provided. All user data will be permanently deleted.\n`,
        );
      }

      const actions = await lifecycle.uninstall(!!options.purgeData);

      process.stdout.write(`\nUninstall initiated successfully.\n`);
      for (const msg of actions) {
        process.stdout.write(`- ${msg}\n`);
      }
    } catch (e: any) {
      process.stderr.write(`\n❌ Uninstall failed: ${e.message}\n`);
      process.exitCode = 1;
    }
  });

  return cmd;
}
