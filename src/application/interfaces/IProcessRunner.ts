import type { IProcessArgs, IProcessResult } from '@nazzel/domain/types.js';

export interface IProcessRunner {
  /**
   * Run a process to completion, buffering stdout and stderr.
   * Useful for short-lived commands like `yt-dlp --dump-json` or `ffprobe`.
   */
  run(args: IProcessArgs): Promise<IProcessResult>;

  /**
   * Spawn a long-running process and yield stdout lines as an async generator.
   * Stderr is captured internally and attached to the thrown AppError if the process fails.
   */
  spawn(args: IProcessArgs): AsyncGenerator<string, void, unknown>;
}
