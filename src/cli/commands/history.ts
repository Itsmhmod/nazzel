import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function historyCommand(): Command {
  const cmd = new Command('history');
  cmd.description('View or manage download history');
  cmd.option('--clear', 'Clear the history file');

  cmd.action(async (options) => {
    const { historyManager } = await createCompositionRoot();

    if (options.clear) {
      await historyManager.clear();
      process.stdout.write(JSON.stringify({ type: 'HISTORY_CLEARED' }) + '\n');
    } else {
      const history = await historyManager.readAll();
      process.stdout.write(JSON.stringify({ type: 'HISTORY_LIST', history }) + '\n');
    }
  });

  return cmd;
}
