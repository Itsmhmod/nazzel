import { Command } from 'commander';
import { LifecycleManager } from '../../application/LifecycleManager.js';
import { createCompositionRoot } from '../CompositionRoot.js';

export function repairCommand(): Command {
  const cmd = new Command('repair');
  cmd.description('Repair Nazzel installation and dependencies');

  cmd.action(async () => {
    const lifecycle = new LifecycleManager();

    try {
      process.stdout.write(`Starting repair...\n`);
      const root = await createCompositionRoot();
      const repairs = await lifecycle.repair(root.depManager);

      process.stdout.write(`\nRepair completed.\n`);
      for (const msg of repairs) {
        process.stdout.write(`- ${msg}\n`);
      }
    } catch (e: any) {
      process.stderr.write(`\n❌ Repair failed: ${e.message}\n`);
      process.exitCode = 1;
    }
  });

  return cmd;
}
