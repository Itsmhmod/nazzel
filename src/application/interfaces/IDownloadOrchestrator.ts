import type { IDownloadRequest, IMediaInfo } from '@nazzel/domain/types.js';

export interface IDownloadOrchestrator {
  analyze(url: string, downloadId: string): Promise<IMediaInfo>;
  download(request: IDownloadRequest, downloadId: string, metadataTitle?: string): void;
  cancel(downloadId: string): void;
}
