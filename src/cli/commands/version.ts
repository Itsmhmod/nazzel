import { Command } from 'commander';

import { NAZZEL_VERSION } from '../../shared/version.js';

export function versionCommand(): Command {
  const cmd = new Command('version');
  cmd.description('Show the Nazzel version');

  cmd.action(() => {
    process.stdout.write(JSON.stringify({ type: 'VERSION_INFO', version: NAZZEL_VERSION }) + '\n');
  });

  return cmd;
}
