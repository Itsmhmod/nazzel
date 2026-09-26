import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadOrchestrator } from '../../../src/application/DownloadOrchestrator.js';
import { AppEventBus } from '../../../src/application/AppEventBus.js';
import { QueueManager } from '../../../src/application/QueueManager.js';
import { RecoveryManager } from '../../../src/application/RecoveryManager.js';
import type { HistoryManager } from '../../../src/application/HistoryManager.js';
import type { ConfigManager } from '../../../src/application/ConfigManager.js';
import type { IDependencyManager } from '../../../src/application/interfaces/IDependencyManager.js';
import type { IFileSystem } from '../../../src/application/interfaces/IFileSystem.js';
import type { IMediaEngine } from '../../../src/application/interfaces/IMediaEngine.js';
import { AppError } from '../../../src/domain/errors.js';
import type { IDownloadRequest, IDownloadResult, IMediaInfo } from '../../../src/domain/types.js';

describe('DownloadOrchestrator', () => {
  let eventBus: AppEventBus;
  let mockMediaEngine: vi.Mocked<IMediaEngine>;
  let queueManager: QueueManager;
  let recoveryManager: RecoveryManager;
  let mockHistoryManager: vi.Mocked<HistoryManager>;
  let mockConfigManager: vi.Mocked<ConfigManager>;
  let mockDependencyManager: vi.Mocked<IDependencyManager>;
  let mockFileSystem: vi.Mocked<IFileSystem>;
  let orchestrator: DownloadOrchestrator;

  const sampleRequest: IDownloadRequest = { url: 'https://test.com/vid' };
  
  const sampleResult: IDownloadResult = {
    downloadId: 'dl-1',
    filePath: '/tmp/vid.mp4',
    fileSize: 1024,
    duration: 100,
    verified: true,
    completedAt: '2026-09-22T00:00:00Z'
  };

  const sampleMediaInfo: IMediaInfo = {
    id: 'vid-1',
    title: 'Test Vid',
    url: 'https://test.com/vid',
    duration: 100,
    thumbnail: null,
    formats: [],
    isPlaylist: false,
    extractor: 'test',
    uploadDate: null,
    uploader: null,
    viewCount: null
  };

  beforeEach(() => {
    eventBus = new AppEventBus();
    queueManager = new QueueManager(1);
    recoveryManager = new RecoveryManager();
    
    mockMediaEngine = {
      analyze: vi.fn(),
      download: vi.fn()
    } as any;

    mockHistoryManager = {
      append: vi.fn().mockResolvedValue(undefined),
      readAll: vi.fn(),
      clear: vi.fn()
    } as any;

    mockConfigManager = {
      get: vi.fn().mockReturnValue({ preferredFormat: 'best', outputDir: '/out', maxRetries: 3, retryBackoffMs: 1 }),
      load: vi.fn(),
      save: vi.fn()
    } as any;

    mockDependencyManager = {
      update: vi.fn().mockResolvedValue(true),
      getBinaryPath: vi.fn().mockResolvedValue('/bin/path')
    } as any;

    mockFileSystem = {
      exists: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(undefined)
    } as any;

    orchestrator = new DownloadOrchestrator(
      eventBus,
      mockMediaEngine,
      queueManager,
      recoveryManager,
      mockHistoryManager,
      mockConfigManager,
      mockDependencyManager,
      mockFileSystem
    );
  });

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  it('analyzes successfully', async () => {
    mockMediaEngine.analyze.mockResolvedValue(sampleMediaInfo);
    const result = await orchestrator.analyze('https://test.com/vid', 'dl-1');
    expect(result.title).toBe('Test Vid');
  });

  it('completes a successful download lifecycle', async () => {
    const events: any[] = [];
    eventBus.subscribe(e => events.push(e));

    async function* mockGenerator() {
      yield { downloadId: 'dl-1', percent: 50, speed: '1M', eta: 10, downloaded: 500, total: 1024, phase: 'downloading' };
      return sampleResult;
    }
    
    mockMediaEngine.download.mockReturnValue(mockGenerator() as any);

    orchestrator.download(sampleRequest, 'dl-1', 'Test Vid');
    
    await delay(20); // wait for queue and execution to settle

    const types = events.map(e => e.type);
    expect(types).toEqual([
      'DOWNLOAD_QUEUED',
      'DOWNLOAD_STARTED',
      'PROGRESS_UPDATE',
      'DOWNLOAD_COMPLETED'
    ]);

    expect(mockHistoryManager.append).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', title: 'Test Vid' })
    );
  });

  it('handles format selection and config defaults', async () => {
    async function* mockGenerator() { return sampleResult; }
    mockMediaEngine.download.mockReturnValue(mockGenerator() as any);

    orchestrator.download({ url: 'https://test.com/vid', formatId: '137' }, 'dl-2', 'Title');
    
    await delay(10);
    
    expect(mockMediaEngine.download).toHaveBeenCalledWith(
      expect.objectContaining({ formatId: '137', outputDir: '/out' }),
      'dl-2',
      expect.any(AbortSignal)
    );
  });

  it('recovers from a transient failure', async () => {
    const events: any[] = [];
    eventBus.subscribe(e => events.push(e));

    let attempts = 0;
    async function* mockGeneratorFailsFirst() {
      attempts++;
      if (attempts === 1) {
        throw new AppError('NETWORK_FAILURE', 'Conn lost', true);
      }
      return sampleResult;
    }
    
    mockMediaEngine.download.mockImplementation(() => mockGeneratorFailsFirst() as any);

    orchestrator.download(sampleRequest, 'dl-3');
    
    await delay(30);

    const types = events.map(e => e.type);
    expect(types).toContain('RECOVERY_STARTED');
    expect(types).toContain('DOWNLOAD_COMPLETED');
    expect(attempts).toBe(2);
  });

  it('gives up on non-recoverable error and logs history', async () => {
    async function* mockGeneratorFails() {
      throw new AppError('FORMAT_UNAVAILABLE', 'Bad format', false);
    }
    mockMediaEngine.download.mockReturnValue(mockGeneratorFails() as any);

    orchestrator.download(sampleRequest, 'dl-4');
    await delay(20);

    expect(mockHistoryManager.append).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failureCode: 'FORMAT_UNAVAILABLE' })
    );
  });

  it('handles cancellation and logs history', async () => {
    const events: any[] = [];
    eventBus.subscribe(e => events.push(e));

    async function* mockGeneratorHangs(signal: AbortSignal) {
      await new Promise<void>((_, reject) => {
        signal.addEventListener('abort', () => reject(new AppError('CANCELLED', 'Aborted')));
      });
      return sampleResult;
    }
    
    mockMediaEngine.download.mockImplementation((req, id, signal) => mockGeneratorHangs(signal!) as any);

    orchestrator.download(sampleRequest, 'dl-5');
    
    await delay(10);
    orchestrator.cancel('dl-5');
    
    await delay(10);

    const types = events.map(e => e.type);
    expect(types).toContain('DOWNLOAD_CANCELLED');
    expect(types).not.toContain('DOWNLOAD_COMPLETED');

    expect(mockHistoryManager.append).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
  });

  it('triggers dependency update on EXTRACTOR_FAILURE and retries', async () => {
    let attempts = 0;
    async function* mockGeneratorUpdateNeeded() {
      attempts++;
      if (attempts === 1) {
        throw new AppError('EXTRACTOR_FAILURE', 'update needed');
      }
      return sampleResult;
    }
    
    mockMediaEngine.download.mockImplementation(() => mockGeneratorUpdateNeeded() as any);

    orchestrator.download(sampleRequest, 'dl-update');
    await delay(30);

    expect(mockDependencyManager.update).toHaveBeenCalledWith('yt-dlp');
    expect(attempts).toBe(2);
  });

  it('cleans up partial files on permanent failure', async () => {
    mockFileSystem.exists.mockResolvedValue(true);
    
    async function* mockGeneratorFails() {
      yield { downloadId: 'dl-fail', percent: 50, speed: '1M', eta: 10, downloaded: 500, total: 1024, phase: 'downloading', activeFile: '/tmp/active.mp4' };
      throw new AppError('FORMAT_UNAVAILABLE', 'permanent failure', false);
    }
    mockMediaEngine.download.mockReturnValue(mockGeneratorFails() as any);

    orchestrator.download(sampleRequest, 'dl-fail');
    await delay(20);

    expect(mockFileSystem.delete).toHaveBeenCalledWith('/tmp/active.mp4');
    expect(mockFileSystem.delete).toHaveBeenCalledWith('/tmp/active.mp4.part');
    expect(mockFileSystem.delete).toHaveBeenCalledWith('/tmp/active.mp4.ytdl');
  });
});
