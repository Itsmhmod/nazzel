import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function doctorCommand(): Command {
  const cmd = new Command('doctor');
  cmd.description('Check dependencies and system health');
  cmd.option('--url <url>', 'Check reachability and extraction for a specific URL');
  
  cmd.action(async (options) => {
    const { diagnosticsRunner } = await createCompositionRoot();
    
    // NDJSON output for doctor
    const report = await diagnosticsRunner.run(options.url);
    process.stdout.write(JSON.stringify({ type: 'DIAGNOSTICS_REPORT', report }) + '\n');
    
    if (!report.isHealthy) {
      process.exitCode = 3; // DEPENDENCY_MISSING or other config failure
    }
  });

  return cmd;
}
