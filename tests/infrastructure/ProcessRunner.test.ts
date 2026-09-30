import { describe, it, expect, vi } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process/ProcessRunner.js';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('ProcessRunner', () => {
  it('throws explicitly when bin is empty string', async () => {
    const runner = new ProcessRunner();
    await expect(runner.run({ bin: '', args: [] })).rejects.toThrow('Executable path is missing or invalid');
  });

  it('throws explicitly when bin is dot', async () => {
    const runner = new ProcessRunner();
    await expect(runner.run({ bin: '.', args: [] })).rejects.toThrow('Executable path is missing or invalid');
  });

  it('throws explicitly when bin is whitespace', async () => {
    const runner = new ProcessRunner();
    await expect(runner.run({ bin: '   ', args: [] })).rejects.toThrow('Executable path is missing or invalid');
  });

  it('does not throw for valid bin', async () => {
    const runner = new ProcessRunner();
    const { execa } = await import('execa');
    vi.mocked(execa).mockReturnValue({
      exitCode: 0,
      stdout: 'ok',
      stderr: ''
    } as any);

    const res = await runner.run({ bin: 'valid-bin', args: [] });
    expect(res.stdout).toBe('ok');
    expect(execa).toHaveBeenCalledWith('valid-bin', [], expect.any(Object));
  });
});
