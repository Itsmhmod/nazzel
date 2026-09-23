import { Command } from 'commander';

export function versionCommand(): Command {
  const cmd = new Command('version');
  cmd.description('Show the Nazzel version');
  
  cmd.action(() => {
    // In a real build, we might import this from package.json or inject it
    const version = '0.1.0';
    process.stdout.write(JSON.stringify({ type: 'VERSION_INFO', version }) + '\n');
  });

  return cmd;
}
