import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function queueCommand(): Command {
  const cmd = new Command('queue');
  cmd.description('Manage the download queue');

  const cancelCmd = new Command('cancel');
  cancelCmd.description('Cancel a specific queued or active download');
  cancelCmd.argument('<id>', 'ID of the download to cancel');
  
  cancelCmd.action(async (id) => {
    const { orchestrator } = await createCompositionRoot();
    orchestrator.cancel(id);
    process.stdout.write(JSON.stringify({ type: 'DOWNLOAD_CANCELLED', downloadId: id }) + '\n');
  });

  cmd.addCommand(cancelCmd);

  return cmd;
}
