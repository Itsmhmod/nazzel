// @ts-nocheck
import { vi, describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagnosticsRunner } from '../../../src/application/DiagnosticsRunner.js';
import type { IDependencyManager } from '../../../src/application/interfaces/IDependencyManager.js';
import type { IFileSystem } from '../../../src/application/interfaces/IFileSystem.js';
import { ConfigManager } from '../../../src/application/ConfigManager.js';
import type { IDependencyReport } from '../../../src/domain/types.js';

const mockHttpRequest = vi.hoisted(() => vi.fn());
const mockHttpsRequest = vi.hoisted(() => vi.fn());

vi.mock('http', () => ({
  request: mockHttpRequest
}));

vi.mock('https', () => ({
  request: mockHttpsRequest
}));

describe('DiagnosticsRunner', () => {
  let mockDepManager: vi.Mocked<IDependencyManager>;
  let mockFileSystem: vi.Mocked<IFileSystem>;
  let mockConfigManager: vi.Mocked<ConfigManager>;
  let runner: DiagnosticsRunner;

  const validDeps: IDependencyReport = {
    allOk: true,
    deps: [],
    missingCritical: [],
    outdated: [],
    checkedAt: new Date().toISOString()
  };

  beforeEach(() => {
    mockDepManager = {
      detectAll: vi.fn().mockResolvedValue(validDeps),
      install: vi.fn(),
      update: vi.fn(),
      validate: vi.fn()
    } as any;

    mockFileSystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      stat: vi.fn(),
      move: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      readJson: vi.fn(),
      readFile: vi.fn(),
      writeJson: vi.fn().mockResolvedValue(undefined),
      appendLine: vi.fn()
    };

    mockConfigManager = {
      load: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockReturnValue({ outputDir: '/test/out' }),
      save: vi.fn()
    } as any;

    runner = new DiagnosticsRunner(
      mockDepManager,
      mockFileSystem,
      mockConfigManager,
      '/test/config.json',
      '/test/history.ndjson'
    );

    // Default mock network request to succeed
    const setupMockReq = (mockFn: any) => {
      mockFn.mockImplementation((url: any, options: any, cb: any) => {
        const req = {
          on: vi.fn(),
          end: vi.fn().mockImplementation(() => {
            if (cb) { cb({ statusCode: 200 }); }
          }),
          destroy: vi.fn()
        };
        return req;
      });
    };
    setupMockReq(mockHttpRequest);
    setupMockReq(mockHttpsRequest);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reports healthy environment when everything passes', async () => {
    const report = await runner.run();
    
    expect(report.isHealthy).toBe(true);
    expect(report.dependencies.allOk).toBe(true);
    expect(report.outputDir.status).toBe('ok');
    expect(report.config.status).toBe('ok');
    expect(report.history.status).toBe('ok');
    expect(report.network.status).toBe('ok');
  });

  it('reports dependency failure if deps are missing', async () => {
    mockDepManager.detectAll.mockResolvedValue({ ...validDeps, allOk: false });
    
    const report = await runner.run();
    
    expect(report.isHealthy).toBe(false);
    expect(report.dependencies.allOk).toBe(false);
  });

  it('reports output path invalid if not writable', async () => {
    mockFileSystem.ensureDir.mockRejectedValue(new Error('Permission denied'));
    
    const report = await runner.run();
    
    expect(report.isHealthy).toBe(false);
    expect(report.outputDir.status).toBe('error');
    expect(report.outputDir.details).toContain('Permission denied');
  });

  it('reports network offline if both pings fail', async () => {
    const setupFailReq = (mockFn: any) => {
      mockFn.mockImplementation((_url: any, _options: any, _cb: any) => {
        const req = {
          on: (event: string, handler: Function) => {
            if (event === 'error') { setTimeout(handler as any, 0); }
          },
          end: vi.fn(),
          destroy: vi.fn()
        };
        return req;
      });
    };
    setupFailReq(mockHttpRequest);
    setupFailReq(mockHttpsRequest);

    const report = await runner.run();
    
    expect(report.isHealthy).toBe(false);
    expect(report.network.status).toBe('offline');
  });
});
