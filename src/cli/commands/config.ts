import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function configCommand(): Command {
  const cmd = new Command('config');
  cmd.description('View or modify configuration');

  // Default action: view config
  cmd.action(async () => {
    const { configManager } = await createCompositionRoot();
    const config = configManager.get();
    process.stdout.write(JSON.stringify({ type: 'CONFIG_LIST', config }) + '\n');
  });

  const setCmd = new Command('set');
  setCmd.description('Set a configuration value');
  setCmd.argument('<key>', 'Configuration key (e.g., outputDir, concurrency)');
  setCmd.argument('<value>', 'Configuration value');

  setCmd.action(async (key, value) => {
    const { configManager } = await createCompositionRoot();

    // Naive parsing for ints/booleans if needed, but for Phase 3 we'll rely on the config manager schema validation
    const parsedValue = /^\d+$/.test(value)
      ? parseInt(value, 10)
      : value === 'true'
        ? true
        : value === 'false'
          ? false
          : value;

    const current = configManager.get();
    await configManager.save({ ...current, [key]: parsedValue });
    process.stdout.write(
      JSON.stringify({ type: 'CONFIG_UPDATED', key, value: parsedValue }) + '\n',
    );
  });

  cmd.addCommand(setCmd);

  return cmd;
}
