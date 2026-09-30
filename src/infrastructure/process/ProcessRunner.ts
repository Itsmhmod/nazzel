import { execa } from 'execa';
import { createInterface } from 'readline';
import { AppError } from '@nazzel/domain/errors.js';
import type { IProcessArgs, IProcessResult } from '@nazzel/domain/types.js';
import type { IProcessRunner } from '../../application/interfaces/IProcessRunner.js';

export class ProcessRunner implements IProcessRunner {
  async run(args: IProcessArgs): Promise<IProcessResult> {
    if (!args.bin || args.bin.trim() === '' || args.bin === '.') {
      throw AppError.from('PROCESS_CRASH', new Error('Executable path is missing or invalid'), { bin: args.bin });
    }
    try {
      const execaOptions: any = { reject: false, shell: false };
      if (args.cwd !== undefined) {
        execaOptions.cwd = args.cwd;
      }
      if (args.env !== undefined) {
        execaOptions.env = args.env;
      }
      if (args.signal !== undefined) {
        execaOptions.cancelSignal = args.signal;
      }
      if (args.timeoutMs !== undefined) {
        execaOptions.timeout = args.timeoutMs;
      }

      const result = await execa(args.bin, args.args, execaOptions);

      return {
        exitCode: result.exitCode ?? -1,
        stdout: typeof result.stdout === 'string' ? result.stdout : '',
        stderr: typeof result.stderr === 'string' ? result.stderr : '',
      };
    } catch (error: any) {
      if (error.isCanceled) {
        throw AppError.from('CANCELLED', new Error('Process cancelled'), { bin: args.bin });
      }
      if (error.timedOut) {
        throw AppError.from('PROCESS_CRASH', new Error('Process timed out'), {
          bin: args.bin,
          timeoutMs: args.timeoutMs,
        });
      }
      throw AppError.from('PROCESS_CRASH', error, { bin: args.bin });
    }
  }

  async *spawn(args: IProcessArgs): AsyncGenerator<string, void, unknown> {
    if (!args.bin || args.bin.trim() === '' || args.bin === '.') {
      throw AppError.from('PROCESS_CRASH', new Error('Executable path is missing or invalid'), { bin: args.bin });
    }
    const execaOptions: any = { reject: false, shell: false };
    if (args.cwd !== undefined) {
      execaOptions.cwd = args.cwd;
    }
    if (args.env !== undefined) {
      execaOptions.env = args.env;
    }
    if (args.signal !== undefined) {
      execaOptions.cancelSignal = args.signal;
    }
    if (args.timeoutMs !== undefined) {
      execaOptions.timeout = args.timeoutMs;
    }

    const child = execa(args.bin, args.args, execaOptions);

    if (!child.stdout || !child.stderr) {
      throw AppError.from('PROCESS_CRASH', new Error('Failed to get process streams'), {
        bin: args.bin,
      });
    }

    const rl = createInterface({
      input: child.stdout as unknown as NodeJS.ReadableStream,
      crlfDelay: Infinity,
    });

    // Buffer stderr to attach to error if exitCode != 0
    let stderrBuffer = '';
    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      // Keep bounded buffer to avoid memory leaks
      if (stderrBuffer.length > 65536) {
        stderrBuffer = stderrBuffer.slice(-65536);
      }
    });

    for await (const line of rl) {
      yield line;
    }

    const result = await child;

    if (result.isCanceled) {
      throw AppError.from('CANCELLED', new Error('Process cancelled'), { bin: args.bin });
    }

    if (result.timedOut) {
      throw AppError.from('PROCESS_CRASH', new Error('Process timed out'), {
        bin: args.bin,
        timeoutMs: args.timeoutMs,
      });
    }

    if (result.exitCode !== 0) {
      const errorMsg = stderrBuffer.trim() || 'Process exited with non-zero code';
      throw AppError.from('PROCESS_CRASH', new Error(errorMsg), {
        bin: args.bin,
        exitCode: result.exitCode,
      });
    }
  }
}
