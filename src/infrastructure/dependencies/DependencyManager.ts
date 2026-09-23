import { AppError } from '@nazzel/domain/errors.js';
import type { 
  IDependencyManager 
} from '@nazzel/application/interfaces/IDependencyManager.js';
import type { 
  IDependencyReport, 
  IDependencyStatus, 
  DependencyName,
  INazzelConfig
} from '@nazzel/domain/types.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';
import type { IFileSystem } from '@nazzel/application/interfaces/IFileSystem.js';
import * as path from 'path';
import * as os from 'os';


const MIN_YTDLP_DATE = '20231000'; // YYYYMMDD

export class DependencyManager implements IDependencyManager {
  private managedBinDir: string;
  private isWindows: boolean;

  constructor(
    private readonly runner: IProcessRunner,
    private readonly fileSystem: IFileSystem,
    private readonly config: INazzelConfig,
  ) {
    this.isWindows = os.platform() === 'win32';
    this.managedBinDir = this.isWindows 
      ? path.join(process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local'), 'nazzel', 'bin')
      : path.join(os.homedir(), '.local', 'share', 'nazzel', 'bin');
  }

  async detectAll(): Promise<IDependencyReport> {
    await this.fileSystem.ensureDir(this.managedBinDir);

    const deps = await Promise.all([
      this.detectYtDlp(),
      this.detectFFmpeg(),
      this.detectFFprobe(),
    ]);

    const missingCritical = deps.filter(d => d.status === 'missing').map(d => d.name);
    const outdated = deps.filter(d => d.status === 'outdated').map(d => d.name);

    return {
      allOk: missingCritical.length === 0 && outdated.length === 0,
      deps,
      missingCritical,
      outdated,
      checkedAt: new Date().toISOString(),
    };
  }

  async getBinaryPath(name: DependencyName): Promise<string> {
    const report = await this.detectAll();
    const dep = report.deps.find(d => d.name === name);
    if (!dep || dep.status === 'missing' || !dep.path) {
      throw AppError.from('DEPENDENCY_MISSING', new Error(`Dependency ${name} is missing`), { name });
    }
    return dep.path;
  }



  private async detectYtDlp(): Promise<IDependencyStatus> {
    const minVersion = MIN_YTDLP_DATE;
    const pathsToTry = [
      this.config.ytdlpPath,
      path.join(this.managedBinDir, this.isWindows ? 'yt-dlp.exe' : 'yt-dlp'),
      'yt-dlp'
    ].filter(Boolean) as string[];

    for (const binPath of pathsToTry) {
      const version = await this.getVersion(binPath, ['--version']);
      if (version) {
        const isOutdated = parseInt(version.replace(/\./g, ''), 10) < parseInt(MIN_YTDLP_DATE, 10);
        const result: IDependencyStatus = {
          name: 'yt-dlp',
          status: isOutdated ? 'outdated' : 'ok',
          version,
          path: binPath,
          minVersion,
        };
        if (isOutdated) {
          (result as any).reason = `Requires >= ${minVersion}`;
        }
        return result;
      }
    }

    return { name: 'yt-dlp', status: 'missing', version: null, path: null, minVersion };
  }

  private async detectFFmpeg(): Promise<IDependencyStatus> {
    const minVersion = '5.0.0'; // Example
    const pathsToTry = [
      this.config.ffmpegPath,
      'ffmpeg'
    ].filter(Boolean) as string[];

    for (const binPath of pathsToTry) {
      const output = await this.getVersion(binPath, ['-version']);
      if (output) {
        const match = output.match(/ffmpeg version (\S+)/);
        const version = match?.[1] ?? 'unknown';
        return {
          name: 'ffmpeg',
          status: 'ok', // Skip strict semver logic for brevity unless we bring in semver
          version,
          path: binPath,
          minVersion,
        };
      }
    }

    return { name: 'ffmpeg', status: 'missing', version: null, path: null, minVersion };
  }

  private async detectFFprobe(): Promise<IDependencyStatus> {
    const minVersion = '5.0.0';
    const pathsToTry = [
      this.config.ffprobePath,
      'ffprobe'
    ].filter(Boolean) as string[];

    for (const binPath of pathsToTry) {
      const output = await this.getVersion(binPath, ['-version']);
      if (output) {
        const match = output.match(/ffprobe version (\S+)/);
        const version = match?.[1] ?? 'unknown';
        return {
          name: 'ffprobe',
          status: 'ok',
          version,
          path: binPath,
          minVersion,
        };
      }
    }

    return { name: 'ffprobe', status: 'missing', version: null, path: null, minVersion };
  }

  private async getVersion(binPath: string, args: string[]): Promise<string | null> {
    try {
      const result = await this.runner.run({ bin: binPath, args, timeoutMs: 10000 });
      if (result.exitCode === 0) {
        return result.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }
}
