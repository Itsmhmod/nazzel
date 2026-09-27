import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessRunner } from '@nazzel/infrastructure/process/ProcessRunner.js';

describe('ProcessRunner Integration', () => {
  let runner: ProcessRunner;

  beforeEach(() => {
    runner = new ProcessRunner();
  });

  it('runs node -v and captures stdout', async () => {
    const result = await runner.run({ bin: 'node', args: ['-v'] });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it('spawns a process and yields stdout', async () => {
    const gen = runner.spawn({ bin: 'node', args: ['-e', 'console.log("line1"); console.log("line2");'] });
    const lines: string[] = [];
    for await (const line of gen) {
      lines.push(line);
    }
    expect(lines).toEqual(['line1', 'line2']);
  });
});
