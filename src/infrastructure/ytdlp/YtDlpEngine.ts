import { AppError } from '@nazzel/domain/errors.js';
import type {
  IMediaInfo,
  IDownloadRequest,
  IDownloadProgress,
  IDownloadResult,
} from '@nazzel/domain/types.js';
import type { IMediaEngine } from '../../application/interfaces/IMediaEngine.js';
import type { IProcessRunner } from '../../application/interfaces/IProcessRunner.js';
import { YtDlpOutputParser } from './YtDlpOutputParser.js';
import * as path from 'path';

export class YtDlpEngine implements IMediaEngine {
  private parser = new YtDlpOutputParser();

  constructor(
    private readonly runner: IProcessRunner,
    private readonly ytdlpBin: string,
    private readonly ffprobeRunner?: import('../../application/interfaces/IFfprobeRunner.js').IFfprobeRunner,
    private readonly jsRuntimeBin: string | null = null,
    private readonly ffmpegBin: string | null = null,
  ) {}

  private getJsRuntimeArgs(): string[] {
    if (this.jsRuntimeBin) {
      // If we have an explicitly resolved runtime (Deno or Node), pass it.
      // yt-dlp expects 'deno:path' or 'node:path'.
      const name = this.jsRuntimeBin.toLowerCase().includes('node') ? 'node' : 'deno';
      return ['--js-runtimes', `${name}:${this.jsRuntimeBin}`];
    }

    // Otherwise, return empty to let yt-dlp fall back to its default system PATH search.
    return [];
  }

  async analyze(url: string, signal?: AbortSignal): Promise<IMediaInfo> {
    const processArgs: any = {
      bin: this.ytdlpBin,
      args: [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        ...this.getJsRuntimeArgs(),
        '--',
        url,
      ],
      timeoutMs: 30000,
    };
    if (signal !== undefined) {
      processArgs.signal = signal;
    }

    const result = await this.runner.run(processArgs);

    if (result.exitCode !== 0) {
      throw AppError.from('EXTRACTOR_FAILURE', new Error(result.stderr || 'Analyze failed'), {
        url,
        exitCode: result.exitCode,
      });
    }

    return this.parser.parseMediaInfo(result.stdout.trim(), url);
  }

  async *download(
    request: IDownloadRequest,
    downloadId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<IDownloadProgress, IDownloadResult, unknown> {
    const formatArg =
      request.formatId || (request.audioOnly ? 'bestaudio' : 'bestvideo+bestaudio/best');
    const outputTemplate = request.outputDir
      ? path.join(request.outputDir, '%(id)s.%(ext)s')
      : '%(id)s.%(ext)s';

    const args = [
      '--newline',
      '--progress-template',
      '{"_type":"progress","percent":%(progress.percentage)s,"speed":"%(progress.speed)s","eta":%(progress.eta)s,"downloaded":%(progress.downloaded_bytes)s,"total":%(progress.total_bytes)s,"frag_index":%(progress.fragment_index)s,"frag_count":%(progress.fragment_count)s,"filename":"%(info.filepath)s"}',
      '--print-json',
      '-f',
      formatArg,
      '-o',
      outputTemplate,
      ...this.getJsRuntimeArgs(),
    ];

    if (this.ffmpegBin) {
      args.push('--ffmpeg-location', this.ffmpegBin);
    }

    if (request.audioOnly) {
      args.push('--extract-audio');
    }

    args.push('--', request.url);

    if (!this.ytdlpBin || this.ytdlpBin.trim() === '' || this.ytdlpBin === '.') {
      throw new AppError('DEPENDENCY_MISSING', 'yt-dlp executable path is missing or invalid. Run `nazzel doctor` to repair.');
    }

    const processArgs: any = {
      bin: this.ytdlpBin,
      args,
    };
    if (signal !== undefined) {
      processArgs.signal = signal;
    }

    const processStream = this.runner.spawn(processArgs);

    let finalMetadata: any = null;

    for await (const line of processStream) {
      if (!line.trim()) {
        continue;
      }

      const progress = this.parser.parseProgressLine(line, downloadId);
      if (progress) {
        yield progress;
        continue;
      }

      const finalMeta = this.parser.parseFinalMetadata(line);
      if (finalMeta) {
        finalMetadata = finalMeta;
      }
    }

    if (!finalMetadata) {
      throw AppError.from('PROCESS_CRASH', new Error('No final metadata returned from yt-dlp'), {
        url: request.url,
      });
    }

    let verified = false;
    const filePath = finalMetadata._filename || 'unknown';

    if (this.ffprobeRunner && filePath !== 'unknown') {
      try {
        // Yield verification phase event
        yield {
          downloadId,
          percent: 100,
          speed: null,
          eta: null,
          downloaded: finalMetadata.filesize || finalMetadata.filesize_approx || 0,
          total: finalMetadata.filesize || finalMetadata.filesize_approx || 0,
          phase: 'verifying',
        };

        const probe = await this.ffprobeRunner.probe(filePath, signal);
        verified = !!probe.formatName;
        finalMetadata.duration = probe.duration || finalMetadata.duration;
      } catch {
        verified = false;
      }
    }

    return {
      downloadId,
      filePath,
      fileSize: finalMetadata.filesize || finalMetadata.filesize_approx || 0,
      duration: finalMetadata.duration || null,
      verified,
      completedAt: new Date().toISOString(),
    };
  }
}
