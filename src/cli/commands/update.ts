import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function updateCommand(): Command {
  const cmd = new Command('update');
  cmd.description('Update yt-dlp to the latest version');
  
  cmd.action(async () => {
    const root = await createCompositionRoot();
    
    try {
      process.stdout.write(JSON.stringify({ type: 'UPDATE_STARTED', dependency: 'yt-dlp' }) + '\n');
      const success = await root.depManager.update('yt-dlp');
      if (success) {
        process.stdout.write(JSON.stringify({ type: 'UPDATE_COMPLETED', dependency: 'yt-dlp' }) + '\n');
      } else {
        process.stdout.write(JSON.stringify({ type: 'UPDATE_FAILED', dependency: 'yt-dlp' }) + '\n');
        process.exitCode = 1;
      }
    } catch (e: any) {
      process.stdout.write(JSON.stringify({ type: 'UPDATE_FAILED', dependency: 'yt-dlp', error: e.message }) + '\n');
      process.exitCode = 1;
    }
  });

  return cmd;
}
