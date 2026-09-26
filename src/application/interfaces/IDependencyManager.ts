import type { IDependencyReport, DependencyName } from '../../domain/types.js';

export interface IDependencyManager {
  /**
   * Detects all dependencies (yt-dlp, ffmpeg, ffprobe) and returns a report.
   */
  detectAll(): Promise<IDependencyReport>;

  /**
   * Returns the resolved path to a specific binary, throwing an error if missing.
   */
  getBinaryPath(name: DependencyName): Promise<string>;

  /**
   * Attempts to update a dependency.
   */
  update(name: DependencyName): Promise<boolean>;

  /**
   * Installs a specific dependency if missing or forced.
   */
  install(name: DependencyName): Promise<boolean>;

  /**
   * Installs all missing managed dependencies.
   */
  installMissing(onProgress?: (name: string, downloaded: number, total: number | undefined) => void): Promise<boolean>;
}
