import type {
  IMediaInfo,
  IDownloadRequest,
  IDownloadProgress,
  IDownloadResult,
} from '@nazzel/domain/types.js';

export interface IMediaEngine {
  /**
   * Fetch structured metadata about a media URL.
   */
  analyze(url: string, signal?: AbortSignal): Promise<IMediaInfo>;

  /**
   * Start a download process, yielding real-time progress updates.
   * Resolves to the final output file details on completion.
   */
  download(
    request: IDownloadRequest,
    downloadId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<IDownloadProgress, IDownloadResult, unknown>;
}
