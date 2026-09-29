import { resolve } from 'path';
import { AppError } from '@nazzel/domain/errors.js';
import type { IFileSystem } from './interfaces/IFileSystem.js';
import { parseConfigWithDefaults } from '@nazzel/config/schema.js';
import { DEFAULT_CONFIG, CONFIG_FILE_PATH, CONFIG_DIR } from '@nazzel/config/defaults.js';
import type { INazzelConfig } from '@nazzel/domain/types.js';

export class ConfigManager {
  private readonly fileSystem: IFileSystem;
  private readonly configPath: string;
  private readonly configDir: string;
  private cachedConfig: INazzelConfig | null = null;

  constructor(
    fileSystem: IFileSystem,
    configPath: string = CONFIG_FILE_PATH,
    configDir: string = CONFIG_DIR,
  ) {
    this.fileSystem = fileSystem;
    this.configPath = configPath;
    this.configDir = configDir;
  }

  /**
   * Loads, parses, validates, merges defaults, and normalizes paths.
   */
  async load(): Promise<INazzelConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    let raw: unknown = {};
    const exists = await this.fileSystem.exists(this.configPath);

    if (exists) {
      try {
        raw = await this.fileSystem.readJson(this.configPath);
      } catch (error: any) {
        throw new AppError('CONFIG_INVALID', 'Failed to read config file', {
          cause: error,
          context: { path: this.configPath },
        });
      }
    }

    try {
      const validated = parseConfigWithDefaults(raw, DEFAULT_CONFIG);
      this.cachedConfig = this.normalizePaths(validated);
      return this.cachedConfig;
    } catch (error: any) {
      throw new AppError('CONFIG_INVALID', 'Configuration validation failed', { cause: error });
    }
  }

  /**
   * Retrieves the current configuration. Throws if not loaded yet.
   */
  get(): INazzelConfig {
    if (!this.cachedConfig) {
      throw new AppError('CONFIG_INVALID', 'Config accessed before load() was called');
    }
    return this.cachedConfig;
  }

  /**
   * Saves the provided config securely and atomically.
   */
  async save(newConfig: INazzelConfig): Promise<void> {
    // Validate first to ensure we don't save garbage
    let validated: INazzelConfig;
    try {
      validated = parseConfigWithDefaults(newConfig, DEFAULT_CONFIG);
      validated = this.normalizePaths(validated);
    } catch (error: any) {
      throw new AppError('CONFIG_INVALID', 'Configuration validation failed on save', {
        cause: error,
      });
    }

    await this.fileSystem.ensureDir(this.configDir);

    const tempPath = `${this.configPath}.tmp.${Date.now()}`;

    try {
      // Atomic write pattern: write to temp file, then rename/move
      await this.fileSystem.writeJson(tempPath, validated);
      await this.fileSystem.move(tempPath, this.configPath);
      this.cachedConfig = validated;
    } catch (error: any) {
      // Best-effort cleanup
      try {
        await this.fileSystem.delete(tempPath);
      } catch {
        // Ignore cleanup failure
      }
      throw new AppError('FS_WRITE_FAILED', 'Failed to save config file atomically', {
        cause: error,
        context: { path: this.configPath },
      });
    }
  }

  /**
   * Normalizes any path settings to be absolute paths.
   */
  private normalizePaths(config: INazzelConfig): INazzelConfig {
    return {
      ...config,
      outputDir: resolve(config.outputDir),
      historyFile: resolve(config.historyFile),
      ytdlpPath: config.ytdlpPath ? resolve(config.ytdlpPath) : null,
      ffmpegPath: config.ffmpegPath ? resolve(config.ffmpegPath) : null,
      ffprobePath: config.ffprobePath ? resolve(config.ffprobePath) : null,
    };
  }
}
