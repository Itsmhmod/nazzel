// @ts-nocheck
import { vi, describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import { ConfigManager } from '../../../src/application/ConfigManager.js';
import type { IFileSystem } from '../../../src/application/interfaces/IFileSystem.js';
import { DEFAULT_CONFIG } from '../../../src/config/defaults.js';
import { AppError } from '../../../src/domain/errors.js';
import type { INazzelConfig } from '../../../src/domain/types.js';

describe('ConfigManager', () => {
  let mockFileSystem: vi.Mocked<IFileSystem>;
  let manager: ConfigManager;

  beforeEach(() => {
    mockFileSystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      stat: vi.fn(),
      move: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      readJson: vi.fn().mockResolvedValue({}),
      writeJson: vi.fn().mockResolvedValue(undefined),
      appendLine: vi.fn(),
    };
    manager = new ConfigManager(mockFileSystem, '/test/config.json', '/test');
  });

  it('loads default config when file does not exist', async () => {
    mockFileSystem.exists.mockResolvedValue(false);
    
    const config = await manager.load();
    
    expect(config.concurrency).toBe(DEFAULT_CONFIG.concurrency);
    expect(config.outputDir).toBe(resolve(DEFAULT_CONFIG.outputDir));
    expect(mockFileSystem.readJson).not.toHaveBeenCalled();
  });

  it('merges valid loaded config with defaults', async () => {
    mockFileSystem.exists.mockResolvedValue(true);
    mockFileSystem.readJson.mockResolvedValue({ concurrency: 4 });
    
    const config = await manager.load();
    
    expect(config.concurrency).toBe(4);
    expect(config.maxRetries).toBe(DEFAULT_CONFIG.maxRetries); // from defaults
  });

  it('throws CONFIG_INVALID for invalid config shapes', async () => {
    mockFileSystem.exists.mockResolvedValue(true);
    mockFileSystem.readJson.mockResolvedValue({ concurrency: -1 }); // Invalid: below min
    
    await expect(manager.load()).rejects.toThrow(AppError);
    await expect(manager.load()).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
  });

  it('normalizes paths to absolute', async () => {
    mockFileSystem.exists.mockResolvedValue(true);
    mockFileSystem.readJson.mockResolvedValue({ outputDir: './relative/path' });
    
    const config = await manager.load();
    
    expect(config.outputDir).toBe(resolve('./relative/path'));
  });

  it('atomically saves config', async () => {
    // Load first so it has defaults to merge against
    await manager.load();
    
    const newConfig: INazzelConfig = {
      ...DEFAULT_CONFIG,
      concurrency: 5,
    };

    await manager.save(newConfig);

    expect(mockFileSystem.ensureDir).toHaveBeenCalledWith('/test');
    expect(mockFileSystem.writeJson).toHaveBeenCalledWith(
      expect.stringMatching(/^\/test\/config\.json\.tmp\.\d+$/),
      expect.objectContaining({ concurrency: 5 })
    );
    expect(mockFileSystem.move).toHaveBeenCalledWith(
      expect.stringMatching(/^\/test\/config\.json\.tmp\.\d+$/),
      '/test/config.json'
    );
  });

  it('recovers from move failure by attempting to delete temp file', async () => {
    await manager.load();
    const newConfig: INazzelConfig = { ...DEFAULT_CONFIG };

    mockFileSystem.move.mockRejectedValue(new Error('Permission denied'));

    await expect(manager.save(newConfig)).rejects.toThrow(AppError);
    expect(mockFileSystem.delete).toHaveBeenCalledWith(
      expect.stringMatching(/^\/test\/config\.json\.tmp\.\d+$/)
    );
  });

  it('throws CONFIG_INVALID on get() before load()', () => {
    expect(() => manager.get()).toThrow(AppError);
    expect(() => manager.get()).toThrow('before load');
  });

  it('caches config after load', async () => {
    mockFileSystem.exists.mockResolvedValue(false);
    await manager.load();
    await manager.load();
    
    // exists should only be called once if cached
    expect(mockFileSystem.exists).toHaveBeenCalledTimes(1);
    expect(manager.get()).toBeDefined();
  });
});
