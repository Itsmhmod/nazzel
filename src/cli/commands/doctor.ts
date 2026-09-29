/* eslint-disable no-console */
import { Command } from 'commander';
import { createCompositionRoot } from '../CompositionRoot.js';

export function doctorCommand(): Command {
  const cmd = new Command('doctor');
  cmd.description('Check dependencies and system health');
  cmd.option('--url <url>', 'Check reachability and extraction for a specific URL');
  cmd.option('--json', 'Output report in JSON format');

  cmd.action(async (options) => {
    const { diagnosticsRunner } = await createCompositionRoot();

    const report = await diagnosticsRunner.run(options.url);

    if (options.json) {
      console.log(JSON.stringify({ type: 'DIAGNOSTICS_REPORT', report }));
      if (!report.isHealthy) {
        process.exitCode = 3;
      }
      return;
    }

    console.log(`\nNazzel Diagnostics Report\n========================`);
    console.log(`Overall Health: ${report.isHealthy ? 'PASS' : 'BROKEN'}`);
    console.log(`\nDependencies:`);
    for (const dep of report.dependencies.deps) {
      const source = dep.source ? ` [${dep.source}]` : '';
      const version = dep.version ? ` (v${dep.version})` : '';

      let statusStr = dep.status.toUpperCase();
      if (dep.name === 'ffmpeg' && dep.status === 'missing' && process.platform === 'darwin') {
        statusStr = 'UNSUPPORTED (Please install via Homebrew)';
      }

      console.log(`- ${dep.name}: ${statusStr}${version}${source}`);
      if (dep.reason) {
        console.log(`    Reason: ${dep.reason}`);
      }
      if (dep.path) {
        console.log(`    Path: ${dep.path}`);
      }
    }

    if (options.url) {
      console.log(`\nURL Extraction Test: ${options.url}`);
      if (report.extractor) {
        console.log(`- Result: ${report.extractor.status === 'ok' ? 'PASS' : 'FAILED'}`);
        console.log(`- Details: ${report.extractor.details}`);
      }
    }

    console.log(); // Trailing newline

    if (!report.isHealthy) {
      process.exitCode = 3;
    }
  });

  return cmd;
}
