import { AppError } from '@nazzel/domain/errors.js';
import type { IProbeResult } from '@nazzel/domain/types.js';
import type { IFfprobeRunner } from '@nazzel/application/interfaces/IFfprobeRunner.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';

export class FfprobeRunner implements IFfprobeRunner {
  constructor(
    private readonly runner: IProcessRunner,
    private readonly ffprobeBin: string
  ) {}

  async probe(filePath: string, signal?: AbortSignal): Promise<IProbeResult> {
    const processArgs: any = {
      bin: this.ffprobeBin,
      args: [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '--',
        filePath
      ],
      timeoutMs: 10000, // Probe should be fast
    };
    if (signal !== undefined) {processArgs.signal = signal;}

    const result = await this.runner.run(processArgs);

    if (result.exitCode !== 0) {
      throw AppError.from('EXTRACTOR_FAILURE', new Error(result.stderr || 'ffprobe failed'), { filePath, exitCode: result.exitCode });
    }

    try {
      const data = JSON.parse(result.stdout.trim());
      
      const format = data.format || {};
      const streams = Array.isArray(data.streams) ? data.streams : [];

      return {
        duration: format.duration ? Number(format.duration) : null,
        size: format.size ? Number(format.size) : null,
        bitRate: format.bit_rate ? Number(format.bit_rate) : null,
        formatName: format.format_name || 'unknown',
        streams: streams.map((s: any) => ({
          index: s.index ?? 0,
          codecName: s.codec_name || 'unknown',
          codecType: s.codec_type || 'unknown',
          width: s.width ? Number(s.width) : undefined,
          height: s.height ? Number(s.height) : undefined,
          bitRate: s.bit_rate ? Number(s.bit_rate) : undefined,
        })),
      };
    } catch (err) {
      throw AppError.from('EXTRACTOR_FAILURE', err, { filePath, reason: 'Failed to parse ffprobe JSON' });
    }
  }
}
