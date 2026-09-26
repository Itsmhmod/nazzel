import { AppError } from '@nazzel/domain/errors.js';
import type { IDownloadRequest, IMediaInfo, IDownloadResult } from '@nazzel/domain/types.js';
import type { IMediaEngine } from './interfaces/IMediaEngine.js';
import type { AppEventBus } from './AppEventBus.js';
import type { QueueManager } from './QueueManager.js';
import type { RecoveryManager } from './RecoveryManager.js';
import type { HistoryManager } from './HistoryManager.js';
import type { ConfigManager } from './ConfigManager.js';
import type { IDependencyManager } from './interfaces/IDependencyManager.js';
import type { IFileSystem } from './interfaces/IFileSystem.js';
import { validateUrl, validateFormatId, validateOutputDir } from '../shared/sanitize.js';

export class DownloadOrchestrator {
  private activeAnalyses = new Map<string, AbortController>();

  constructor(
    private readonly eventBus: AppEventBus,
    private readonly mediaEngine: IMediaEngine,
    private readonly queueManager: QueueManager,
    private readonly recoveryManager: RecoveryManager,
    private readonly historyManager: HistoryManager,
    private readonly configManager: ConfigManager,
    private readonly dependencyManager: IDependencyManager,
    private readonly fileSystem: IFileSystem
  ) {}

  /**
   * Analyzes a URL to fetch metadata. Runs immediately outside the download queue.
   */
  async analyze(url: string, downloadId: string): Promise<IMediaInfo> {
    validateUrl(url);
    const controller = new AbortController();
    this.activeAnalyses.set(downloadId, controller);
    try {
      const info = await this.mediaEngine.analyze(url, controller.signal);
      return info;
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        throw new AppError('CANCELLED', 'Analysis aborted');
      }
      const appError = error instanceof AppError ? error : new AppError('EXTRACTOR_FAILURE', error.message, { cause: error });
      throw appError;
    } finally {
      this.activeAnalyses.delete(downloadId);
    }
  }

  /**
   * Queues a download request for execution based on concurrency limits.
   */
  download(request: IDownloadRequest, downloadId: string, metadataTitle: string = 'Unknown Title'): void {
    this.eventBus.emit({ type: 'DOWNLOAD_QUEUED', downloadId, url: request.url });
    
    this.queueManager.enqueue(downloadId, async (signal: AbortSignal) => {
      await this.executeDownloadLifecycle(request, downloadId, signal, metadataTitle);
    });
  }

  /**
   * Cancels a queued or active download or analysis.
   */
  cancel(downloadId: string): void {
    if (this.activeAnalyses.has(downloadId)) {
      this.activeAnalyses.get(downloadId)!.abort();
    }
    this.queueManager.cancel(downloadId);
  }

  private async executeDownloadLifecycle(
    request: IDownloadRequest, 
    downloadId: string, 
    signal: AbortSignal,
    title: string
  ): Promise<void> {
    const config = this.configManager.get();
    let activeFile: string | undefined = undefined;
    let finalOutputSeen = false;
    
    // Validate inputs
    validateUrl(request.url);
    if (request.formatId) { validateFormatId(request.formatId); }
    if (request.outputDir) { validateOutputDir(request.outputDir); }

    while (!signal.aborted) {
      this.eventBus.emit({ type: 'DOWNLOAD_STARTED', downloadId, url: request.url, title });
      
      try {
        const engineRequest: IDownloadRequest = {
          ...request,
          formatId: request.formatId || config.preferredFormat,
          outputDir: request.outputDir || config.outputDir
        };

        const generator = this.mediaEngine.download(engineRequest, downloadId, signal);
        
        let finalResult: IDownloadResult | undefined;

        // Manually iterate to extract both yielded progress and the final returned result
        while (true) {
          const { value, done } = await generator.next();
          
          if (done) {
            finalResult = value as IDownloadResult;
            finalOutputSeen = true;
            break;
          }
          
          if (value && (value as any).activeFile) {
            activeFile = (value as any).activeFile;
          }
          this.eventBus.emit({ type: 'PROGRESS_UPDATE', progress: value });
        }

        if (!finalResult) {
          throw new AppError('VERIFY_FAILURE', 'Download finished but no result was returned');
        }

        if (!finalResult.verified) {
          throw new AppError('VERIFY_FAILURE', 'FFprobe verification failed post-download');
        }

        // Success
        this.eventBus.emit({ type: 'DOWNLOAD_COMPLETED', result: finalResult });
        
        await this.historyManager.append({
          id: downloadId,
          timestamp: new Date().toISOString(),
          url: request.url,
          title,
          formatId: engineRequest.formatId!,
          filePath: finalResult.filePath,
          duration: finalResult.duration,
          fileSize: finalResult.fileSize,
          status: 'completed'
        });

        return; // Exit retry loop
        
      } catch (error: any) {
        if (signal.aborted || (error && error.code === 'CANCELLED')) {
           await this.cleanupPartialFiles(activeFile, finalOutputSeen);
           this.eventBus.emit({ type: 'DOWNLOAD_CANCELLED', downloadId });
           await this.historyManager.append({
             id: downloadId,
             timestamp: new Date().toISOString(),
             url: request.url,
             title,
             formatId: request.formatId || 'best',
             filePath: '',
             duration: null,
             fileSize: 0,
             status: 'cancelled'
           });
           return;
        }

        const appError = error instanceof AppError ? error : new AppError('PROCESS_CRASH', error.message, { cause: error });
        const plan = this.recoveryManager.evaluateError(downloadId, appError, config.maxRetries, config.retryBackoffMs);

        if (plan.action === 'NONE') {
          await this.cleanupPartialFiles(activeFile, finalOutputSeen);
          this.eventBus.emit({ type: 'DOWNLOAD_FAILED', downloadId, error: appError });
          await this.historyManager.append({
             id: downloadId,
             timestamp: new Date().toISOString(),
             url: request.url,
             title,
             formatId: request.formatId || 'best',
             filePath: '',
             duration: null,
             fileSize: 0,
             status: 'failed',
             failureCode: appError.code
           });
          return; 
        }

        // Recover
        this.eventBus.emit({
          type: 'RECOVERY_STARTED', 
          downloadId, 
          attempt: plan.attempt, 
          maxAttempts: plan.maxAttempts,
          errorCode: appError.code
        });

        if (plan.action === 'UPDATE_DEP_THEN_RETRY') {
          let updateSuccess = false;
          try {
            updateSuccess = await this.dependencyManager.update('yt-dlp');
          } catch {
            updateSuccess = false;
          }
          if (!updateSuccess) {
            await this.cleanupPartialFiles(activeFile, finalOutputSeen);
            this.eventBus.emit({ type: 'DOWNLOAD_FAILED', downloadId, error: appError });
            await this.historyManager.append({
              id: downloadId,
              timestamp: new Date().toISOString(),
              url: request.url,
              title,
              formatId: request.formatId || 'best',
              filePath: '',
              duration: null,
              fileSize: 0,
              status: 'failed',
              failureCode: appError.code
            });
            return;
          }
        }

        this.recoveryManager.recordAttempt(downloadId, config.retryBackoffMs);

        if (plan.delayMs > 0) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, plan.delayMs);
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new AppError('CANCELLED', 'Aborted during recovery backoff'));
            });
          });
        }
      }
    }
  }

  private async cleanupPartialFiles(activeFile: string | undefined, finalOutputSeen: boolean): Promise<void> {
    if (!activeFile) { return; }
    
    // We only clean up `.part` and `.ytdl` of the active file, and the file itself if it's explicitly temporary or not finalized.
    // If we have seen the final output, the activeFile is the finalized media. Do NOT delete it on verification failure.
    if (!finalOutputSeen || activeFile.endsWith('.part') || activeFile.endsWith('.ytdl')) {
      try {
        const ex = await this.fileSystem.exists(activeFile);
        if (ex) {
          await this.fileSystem.delete(activeFile);
        }
      } catch {}
    }

    try {
      const partFile = activeFile + '.part';
      const exPart = await this.fileSystem.exists(partFile);
      if (exPart) {
        await this.fileSystem.delete(partFile);
      }
    } catch {}

    try {
      const ytdlFile = activeFile + '.ytdl';
      const exYtdl = await this.fileSystem.exists(ytdlFile);
      if (exYtdl) {
        await this.fileSystem.delete(ytdlFile);
      }
    } catch {}
  }
}
