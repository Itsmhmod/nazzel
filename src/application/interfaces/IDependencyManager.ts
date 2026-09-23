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
}
