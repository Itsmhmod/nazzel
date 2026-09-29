import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessRunner } from '@nazzel/infrastructure/process/ProcessRunner.js';
import * as execaMod from 'execa';
import { PassThrough } from 'stream';

// We need to mock execa to test success and failure paths
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

describe('ProcessRunner', () => {
  let runner: ProcessRunner;

  beforeEach(() => {
    runner = new ProcessRunner();
    vi.clearAllMocks();
  });

  describe('run()', () => {
    it('returns stdout and stderr on success', async () => {
      vi.mocked(execaMod.execa).mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'success',
        stderr: '',
      } as any);

      const result = await runner.run({
        bin: 'testbin',
        args: ['arg1'],
      });

      expect(execaMod.execa).toHaveBeenCalledWith(
        'testbin',
        ['arg1'],
        expect.objectContaining({
          reject: false,
        }),
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('success');
    });

    it('throws PROCESS_CRASH if process times out', async () => {
      const timeoutError = new Error('timedout') as any;
      timeoutError.timedOut = true;

      vi.mocked(execaMod.execa).mockRejectedValueOnce(timeoutError);

      await expect(runner.run({ bin: 'test', args: [], timeoutMs: 100 })).rejects.toMatchObject({
        code: 'PROCESS_CRASH',
      });
    });

    it('passes options accurately without shell execution', async () => {
      vi.mocked(execaMod.execa).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr: '',
      } as any);

      await runner.run({
        bin: 'safe_bin',
        args: ['--arg', 'with space'],
        cwd: '/tmp',
        env: { TEST: '1' },
      });

      expect(execaMod.execa).toHaveBeenCalledWith(
        'safe_bin',
        ['--arg', 'with space'],
        expect.objectContaining({
          reject: false,
          cwd: '/tmp',
          env: { TEST: '1' },
        }),
      );
      // Note: execa defaults to shell: false. We ensure we never pass shell: true.
      expect(execaMod.execa).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          shell: true,
        }),
      );
    });
  });

  describe('spawn()', () => {
    it('throws CANCELLED error if spawned process is canceled', async () => {
      const cancelResult = {
        isCanceled: true,
        exitCode: 1,
      };

      const mockChild = Promise.resolve(cancelResult) as any;
      const stdout = new PassThrough();
      stdout.end(); // immediately end to close readline
      mockChild.stdout = stdout;
      const stderr = new PassThrough();
      mockChild.stderr = stderr;

      vi.mocked(execaMod.execa).mockReturnValueOnce(mockChild);

      const gen = runner.spawn({ bin: 'test', args: [] });
      await expect(gen.next()).rejects.toMatchObject({ code: 'CANCELLED' });
    });
  });
});
