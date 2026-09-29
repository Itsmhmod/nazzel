import { Command } from 'commander';
import { LifecycleManager } from '../../application/LifecycleManager.js';

export function updateCommand(): Command {
  const cmd = new Command('update');
  cmd.description('Update Nazzel to the latest stable release');

  cmd.option('--check', 'Check for updates without installing');
  cmd.option('--version <version>', 'Install a specific version');

  cmd.action(async (options) => {
    const lifecycle = new LifecycleManager();

    try {
      if (options.check) {
        const result = await lifecycle.checkUpdate();
        process.stdout.write(`Nazzel Update Check\n\n`);
        process.stdout.write(`Current version: ${result.currentVersion}\n`);
        process.stdout.write(`Latest stable:   ${result.latestVersion}\n`);
        process.stdout.write(`Architecture:    ${result.platform}-${result.arch}\n\n`);

        if (result.hasUpdate) {
          process.stdout.write(`Update available! Run 'nazzel update' to upgrade.\n`);
        } else {
          process.stdout.write(`You are up to date.\n`);
        }
        return;
      }

      process.stdout.write(`Starting update...\n`);
      const resultMsg = await lifecycle.update(options.version);
      process.stdout.write(`\n✓ ${resultMsg}\n`);
    } catch (e: any) {
      process.stderr.write(`\n❌ Error: ${e.message}\n`);
      process.exitCode = 1;
    }
  });

  return cmd;
}
