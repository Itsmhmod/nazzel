import { AppError } from '@nazzel/domain/errors.js';
import type { IDependencyManager } from '@nazzel/application/interfaces/IDependencyManager.js';
import type {
  IDependencyReport,
  IDependencyStatus,
  DependencyName,
  INazzelConfig,
} from '@nazzel/domain/types.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';
import type { IFileSystem } from '@nazzel/application/interfaces/IFileSystem.js';
import { GithubReleaseProvider } from './GithubReleaseProvider.js';
import { Downloader } from './Downloader.js';
import * as path from 'path';
import * as os from 'os';
import envPaths from 'env-paths';
import { SafeZipExtractor } from './SafeZipExtractor.js';

const paths = envPaths('nazzel', { suffix: '' });
const MIN_YTDLP_DATE = '20231000'; // YYYYMMDD
const MIN_FFMPEG_VER = '5.0.0';

function compareVersions(v1: string, v2: string): number {
  const p1 = v1
    .replace(/^[vV]/, '')
    .split('.')
    .map((n) => parseInt(n, 10));
  const p2 = v2
    .replace(/^[vV]/, '')
    .split('.')
    .map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const val1 = p1[i];
    const val2 = p2[i];
    const n1 = val1 === undefined || isNaN(val1) ? 0 : val1;
    const n2 = val2 === undefined || isNaN(val2) ? 0 : val2;
    if (n1 > n2) {
      return 1;
    }
    if (n1 < n2) {
      return -1;
    }
  }
  return 0;
}

/**
 * DependencyManager handles detection, resolution, and safe installation of external dependencies.
 *
 * Integrity vs Authenticity:
 * - Integrity Verification: Ensures the downloaded file matches the expected SHA-256 hash provided
 *   by the release source (e.g., GitHub Releases). This prevents corrupted downloads.
 * - Authenticity Verification: Not currently implemented. We trust the GitHub API and HTTPS for transport,
 *   but we do not verify cryptographic signatures from the authors. SHA-256 mismatch will fail closed.
 */
export class DependencyManager implements IDependencyManager {
  private managedBinDir: string;
  private isWindows: boolean;

  constructor(
    private readonly runner: IProcessRunner,
    private readonly fileSystem: IFileSystem,
    private readonly config: INazzelConfig,
  ) {
    this.isWindows = os.platform() === 'win32';
    this.managedBinDir = paths.data
      ? path.join(paths.data, 'bin')
      : path.join(os.homedir(), '.local', 'share', 'nazzel', 'bin');
  }

  async detectAll(): Promise<IDependencyReport> {
    await this.fileSystem.ensureDir(this.managedBinDir);

    const deps = await Promise.all([
      this.detectYtDlp(),
      this.detectFFmpeg(),
      this.detectFFprobe(),
      this.detectDeno(),
      this.detectNode(),
    ]);

    const missingCritical = deps.filter((d) => d.status === 'missing').map((d) => d.name);
    const outdated = deps.filter((d) => d.status === 'outdated').map((d) => d.name);

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
    const dep = report.deps.find((d) => d.name === name);
    if (!dep || dep.status !== 'ok' || !dep.path) {
      throw AppError.from(
        'DEPENDENCY_MISSING',
        new Error(`Dependency ${name} is missing or not ok`),
        { name },
      );
    }
    return dep.path;
  }

  async installMissing(
    onProgress?: (name: string, downloaded: number, total: number | undefined) => void,
  ): Promise<boolean> {
    const report = await this.detectAll();
    let success = true;
    for (const dep of report.deps) {
      if (dep.status === 'missing' || dep.status === 'outdated' || dep.status === 'unknown') {
        try {
          await this.install(dep.name, onProgress);
        } catch {
          success = false;
        }
      }
    }
    return success;
  }

  async install(
    name: DependencyName,
    onProgress?: (name: string, downloaded: number, total: number | undefined) => void,
  ): Promise<boolean> {
    if (name === 'yt-dlp') {
      return this.installYtDlp(onProgress);
    } else if (name === 'ffmpeg' || name === 'ffprobe') {
      return this.installFfmpeg(onProgress);
    } else if (name === 'deno') {
      return this.installDeno(onProgress);
    }
    return false;
  }

  async update(name: DependencyName): Promise<boolean> {
    const report = await this.detectAll();
    const dep = report.deps.find((d) => d.name === name);
    if (dep && dep.source !== 'managed' && dep.source !== null) {
      throw new AppError(
        'CONFIG_INVALID',
        `Cannot update user-managed dependency: ${name} (source: ${dep.source})`,
      );
    }
    return this.install(name);
  }

  private async installYtDlp(
    onProgress?: (name: string, downloaded: number, total: number | undefined) => void,
  ): Promise<boolean> {
    await this.fileSystem.ensureDir(this.managedBinDir);
    const tempDir = path.join(this.managedBinDir, 'temp');
    await this.fileSystem.ensureDir(tempDir);

    let assetName = 'yt-dlp';
    if (this.isWindows) {
      assetName = 'yt-dlp.exe';
    } else if (os.platform() === 'darwin') {
      assetName = 'yt-dlp_macos';
    } else {
      assetName = 'yt-dlp_linux';
    }

    const release = await GithubReleaseProvider.getLatestRelease('yt-dlp/yt-dlp');
    const asset = release.assets.find((a) => a.name === assetName);
    const checksumsAsset = release.assets.find((a) => a.name === 'SHA2-256SUMS');

    if (!asset || !checksumsAsset) {
      throw new AppError('NETWORK_FAILURE', 'Could not find yt-dlp release assets');
    }

    const checksums = await GithubReleaseProvider.downloadChecksums(
      checksumsAsset.browser_download_url,
    );
    const expectedSha = checksums[assetName];
    if (!expectedSha) {
      throw new AppError('DEPENDENCY_INSTALL_FAILED', 'No checksum found for yt-dlp binary');
    }

    const tempBin = path.join(tempDir, assetName);
    await Downloader.downloadFile({
      url: asset.browser_download_url,
      destination: tempBin,
      expectedSha256: expectedSha,
      onProgress: onProgress ? (d, t) => onProgress('yt-dlp', d, t) : undefined,
    });

    if (!this.isWindows) {
      await this.runner.run({ bin: 'chmod', args: ['+x', tempBin] });
    }

    // Validation: Execute it to ensure it runs correctly before swapping
    const versionOutput = await this.getVersion(tempBin, ['--version']);
    if (!versionOutput) {
      await this.fileSystem.delete(tempBin).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        'Downloaded yt-dlp binary failed execution test.',
      );
    }

    const finalName = this.isWindows ? 'yt-dlp.exe' : 'yt-dlp';
    const finalBin = path.join(this.managedBinDir, finalName);
    const oldBin = path.join(this.managedBinDir, `${finalName}.old`);

    await this.atomicSwap(tempBin, finalBin, oldBin);
    return true;
  }

  private async installFfmpeg(
    onProgress?: (name: string, downloaded: number, total: number | undefined) => void,
  ): Promise<boolean> {
    await this.fileSystem.ensureDir(this.managedBinDir);
    const tempDir = path.join(this.managedBinDir, 'temp');
    await this.fileSystem.ensureDir(tempDir);

    let platform = '';
    let ext = '';
    if (this.isWindows) {
      platform = 'win64';
      ext = '.zip';
    } else if (os.platform() === 'darwin') {
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        'macOS managed FFmpeg installation is not supported by BtbN. Please install ffmpeg via Homebrew.',
      );
    } else {
      platform = 'linux64';
      ext = '.tar.xz';
    }

    // On Windows we use the gpl-shared variant which ships BOTH ffmpeg.exe and ffprobe.exe.
    // The gpl (static) variant only ships ffmpeg.exe as of current BtbN packaging.
    // On Linux the tar.xz gpl static build includes both ffmpeg and ffprobe.
    const variant = this.isWindows ? 'gpl-shared' : 'gpl';
    const assetNamePrefix = `ffmpeg-master-latest-${platform}-${variant}`;
    const assetName = `${assetNamePrefix}${ext}`;

    const release = await GithubReleaseProvider.getLatestRelease('BtbN/FFmpeg-Builds');
    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
      throw new AppError(
        'NETWORK_FAILURE',
        `Could not find FFmpeg release for ${platform} (${variant})`,
      );
    }

    // BtbN publishes a single 'checksums.sha256' file covering all assets.
    // Also accept legacy 'sha256.txt' and any *.sha256 suffix for future-proofing.
    const checksumsAsset = release.assets.find(
      (a) => a.name === 'checksums.sha256' || a.name === 'sha256.txt' || a.name.endsWith('.sha256'),
    );
    let expectedSha: string | undefined;
    if (checksumsAsset) {
      const checksums = await GithubReleaseProvider.downloadChecksums(
        checksumsAsset.browser_download_url,
      );
      expectedSha = checksums[assetName];
    }

    const tempArchive = path.join(tempDir, assetName);
    await Downloader.downloadFile({
      url: asset.browser_download_url,
      destination: tempArchive,
      expectedSha256: expectedSha,
      onProgress: onProgress ? (d, t) => onProgress('ffmpeg', d, t) : undefined,
    });

    const extractDir = path.join(tempDir, assetNamePrefix);
    await this.fileSystem.delete(extractDir).catch(() => {});

    if (ext === '.zip') {
      await SafeZipExtractor.extract({ sourceZip: tempArchive, targetDir: extractDir });
    } else {
      await this.fileSystem.ensureDir(extractDir);

      // Security: Validate archive contents against path traversal before extraction
      const listResult = await this.runner.run({ bin: 'tar', args: ['-tf', tempArchive] });
      if (listResult.exitCode !== 0) {
        throw new AppError(
          'DEPENDENCY_INSTALL_FAILED',
          `Failed to read archive contents: ${listResult.stderr}`,
        );
      }

      const files = listResult.stdout.split('\n').filter(Boolean);
      for (const file of files) {
        const parts = file.split(/[/\\]/);
        if (
          parts.includes('..') ||
          path.isAbsolute(file) ||
          file.startsWith('/') ||
          file.startsWith('\\')
        ) {
          await this.fileSystem.delete(tempArchive).catch(() => {});
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            'Archive rejected due to unsafe path traversal in contents.',
          );
        }
      }

      // Safe extraction parameters for tar
      const result = await this.runner.run({
        bin: 'tar',
        args: ['-xf', tempArchive, '-C', extractDir],
      });
      if (result.exitCode !== 0) {
        throw new AppError('DEPENDENCY_INSTALL_FAILED', `Tar extraction failed: ${result.stderr}`);
      }
    }

    const binSubdir = path.join(extractDir, assetNamePrefix, 'bin');
    const ffmpegExe = this.isWindows ? 'ffmpeg.exe' : 'ffmpeg';
    const ffprobeExe = this.isWindows ? 'ffprobe.exe' : 'ffprobe';

    const tempFfmpeg = path.join(binSubdir, ffmpegExe);
    const tempFfprobe = path.join(binSubdir, ffprobeExe);

    // Archive content validation: ensure both required executables exist before proceeding.
    // This catches archives that are missing ffprobe (e.g., wrong BtbN variant) early and
    // emits an accurate error rather than a misleading 'symlink escape' error.
    const ffmpegStat = await this.fileSystem.stat(tempFfmpeg).catch(() => null);
    const ffprobeStat = await this.fileSystem.stat(tempFfprobe).catch(() => null);
    if (!ffmpegStat || !ffmpegStat.isFile) {
      await this.fileSystem.delete(tempArchive).catch(() => {});
      await this.fileSystem.delete(extractDir).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        `Archive is missing required executable: ${ffmpegExe}. Verify the selected BtbN variant includes both ffmpeg and ffprobe.`,
      );
    }
    if (!ffprobeStat || !ffprobeStat.isFile) {
      await this.fileSystem.delete(tempArchive).catch(() => {});
      await this.fileSystem.delete(extractDir).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        `Archive is missing required executable: ${ffprobeExe}. The selected BtbN variant must include both ffmpeg and ffprobe.`,
      );
    }

    if (!this.isWindows) {
      await this.runner.run({ bin: 'chmod', args: ['+x', tempFfmpeg, tempFfprobe] });
    }

    // Security: Ensure extracted files are actually inside our staging directory and not escaped via symlink.
    const realExtractDir = await this.fileSystem.realpath(extractDir).catch(() => null);
    const realFfmpeg = await this.fileSystem.realpath(tempFfmpeg).catch(() => null);
    const realFfprobe = await this.fileSystem.realpath(tempFfprobe).catch(() => null);

    if (
      !realExtractDir ||
      !realFfmpeg ||
      !realFfprobe ||
      !realFfmpeg.startsWith(realExtractDir) ||
      !realFfprobe.startsWith(realExtractDir)
    ) {
      await this.fileSystem.delete(tempArchive).catch(() => {});
      await this.fileSystem.delete(extractDir).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        'Archive extraction escaped staging directory via symlinks.',
      );
    }

    const ffmpegOutput = await this.getVersion(tempFfmpeg, ['-version']);
    const ffprobeOutput = await this.getVersion(tempFfprobe, ['-version']);
    if (!ffmpegOutput || !ffprobeOutput) {
      await this.fileSystem.delete(tempArchive).catch(() => {});
      await this.fileSystem.delete(extractDir).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        'Downloaded FFmpeg binaries failed execution test.',
      );
    }

    // Activate the entire package as one logical unit
    const finalPkg = path.join(this.managedBinDir, 'ffmpeg_pkg');
    const oldPkg = path.join(this.managedBinDir, 'ffmpeg_pkg.old');

    await this.atomicSwap(binSubdir, finalPkg, oldPkg);

    await this.fileSystem.delete(tempArchive).catch(() => {});
    await this.fileSystem.delete(extractDir).catch(() => {});

    return true;
  }

  private async atomicSwap(tempPath: string, finalPath: string, oldPath: string) {
    try {
      await this.fileSystem.delete(oldPath);
    } catch {}

    try {
      const stats = await this.fileSystem.stat(finalPath);
      if (stats.isFile || stats.isDirectory) {
        await this.runner.run({
          bin: this.isWindows ? 'cmd' : 'mv',
          args: this.isWindows ? ['/c', 'move', '/y', finalPath, oldPath] : [finalPath, oldPath],
        });
      }
    } catch {}

    await this.runner.run({
      bin: this.isWindows ? 'cmd' : 'mv',
      args: this.isWindows ? ['/c', 'move', '/y', tempPath, finalPath] : [tempPath, finalPath],
    });
  }

  private getSource(
    binPath: string,
    configOverride?: string | null,
  ): 'config' | 'managed' | 'system' {
    if (configOverride && binPath === configOverride) {
      return 'config';
    }
    if (binPath.startsWith(this.managedBinDir)) {
      return 'managed';
    }
    return 'system';
  }

  private async detectYtDlp(): Promise<IDependencyStatus> {
    const pathsToTry = [
      this.config.ytdlpPath,
      path.join(this.managedBinDir, this.isWindows ? 'yt-dlp.exe' : 'yt-dlp'),
      'yt-dlp',
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
          source: this.getSource(binPath, this.config.ytdlpPath),
          minVersion: MIN_YTDLP_DATE,
        };
        if (isOutdated) {
          (result as any).reason = `Requires >= ${MIN_YTDLP_DATE}`;
        }
        return result;
      }
    }

    return {
      name: 'yt-dlp',
      status: 'missing',
      version: null,
      path: null,
      source: null,
      minVersion: MIN_YTDLP_DATE,
    };
  }

  private async detectFFmpeg(): Promise<IDependencyStatus> {
    const pathsToTry = [
      this.config.ffmpegPath,
      path.join(this.managedBinDir, 'ffmpeg_pkg', this.isWindows ? 'ffmpeg.exe' : 'ffmpeg'),
      path.join(this.managedBinDir, this.isWindows ? 'ffmpeg.exe' : 'ffmpeg'), // Legacy path fallback
      'ffmpeg',
    ].filter(Boolean) as string[];

    for (const binPath of pathsToTry) {
      const output = await this.getVersion(binPath, ['-version']);
      if (output) {
        const match = output.match(/ffmpeg version (\S+)/);
        const version = match?.[1] ?? 'unknown';
        return {
          name: 'ffmpeg',
          status: 'ok',
          version,
          path: binPath,
          source: this.getSource(binPath, this.config.ffmpegPath),
          minVersion: MIN_FFMPEG_VER,
        };
      }
    }

    return {
      name: 'ffmpeg',
      status: 'missing',
      version: null,
      path: null,
      source: null,
      minVersion: MIN_FFMPEG_VER,
    };
  }

  private async detectFFprobe(): Promise<IDependencyStatus> {
    const pathsToTry = [
      this.config.ffprobePath,
      path.join(this.managedBinDir, 'ffmpeg_pkg', this.isWindows ? 'ffprobe.exe' : 'ffprobe'),
      path.join(this.managedBinDir, this.isWindows ? 'ffprobe.exe' : 'ffprobe'), // Legacy path fallback
      'ffprobe',
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
          source: this.getSource(binPath, this.config.ffprobePath),
          minVersion: MIN_FFMPEG_VER,
        };
      }
    }

    return {
      name: 'ffprobe',
      status: 'missing',
      version: null,
      path: null,
      source: null,
      minVersion: MIN_FFMPEG_VER,
    };
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

  private async detectDeno(): Promise<IDependencyStatus> {
    const minVersion = '2.3.0';
    const name = this.isWindows ? 'deno.exe' : 'deno';
    const pathsToTry = [this.config.denoPath, path.join(this.managedBinDir, name), 'deno'].filter(
      Boolean,
    ) as string[];

    for (const binPath of pathsToTry) {
      const output = await this.getVersion(binPath, ['--version']);
      if (output) {
        const match = output.match(/deno\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
        const version = match?.[1];
        if (!version) {
          return {
            name: 'deno',
            status: 'broken',
            version: 'unknown',
            path: binPath,
            source: this.getSource(binPath, this.config.denoPath),
            minVersion,
            reason: 'Malformed version output',
          };
        }
        const isOutdated = compareVersions(version, minVersion) < 0;
        return {
          name: 'deno',
          status: isOutdated ? 'outdated' : 'ok',
          version,
          path: binPath,
          source: this.getSource(binPath, this.config.denoPath),
          minVersion,
        };
      }
    }

    return { name: 'deno', status: 'missing', version: null, path: null, source: null, minVersion };
  }

  private async detectNode(): Promise<IDependencyStatus> {
    const minVersion = '22.0.0';
    const pathsToTry = ['node'];

    // First try PATH
    for (const binPath of pathsToTry) {
      const output = await this.getVersion(binPath, ['-v']);
      if (output) {
        const match = output.match(/v([0-9]+\.[0-9]+\.[0-9]+)/i);
        const version = match?.[1];
        if (!version) {
          return {
            name: 'node',
            status: 'broken',
            version: 'unknown',
            path: binPath,
            source: 'system',
            minVersion,
            reason: 'Malformed version output',
          };
        }
        const isOutdated = compareVersions(version, minVersion) < 0;
        return {
          name: 'node',
          status: isOutdated ? 'outdated' : 'ok',
          version,
          path: binPath,
          source: 'system',
          minVersion,
        };
      }
    }

    // SEA Mode detection / process.execPath fallback
    const execLower = process.execPath.toLowerCase();
    if (execLower.endsWith('node') || execLower.endsWith('node.exe')) {
      const output = await this.getVersion(process.execPath, ['-v']);
      if (output) {
        const match = output.match(/v([0-9]+\.[0-9]+\.[0-9]+)/i);
        const version = match?.[1];
        if (version) {
          const isOutdated = compareVersions(version, minVersion) < 0;
          return {
            name: 'node',
            status: isOutdated ? 'outdated' : 'ok',
            version,
            path: process.execPath,
            source: 'system',
            minVersion,
          };
        }
      }
    }

    return { name: 'node', status: 'missing', version: null, path: null, source: null, minVersion };
  }

  private async installDeno(
    onProgress?: (name: string, downloaded: number, total: number | undefined) => void,
  ): Promise<boolean> {
    await this.fileSystem.ensureDir(this.managedBinDir);
    const tempDir = path.join(this.managedBinDir, 'temp');
    await this.fileSystem.ensureDir(tempDir);

    const platform = os.platform();
    const arch = os.arch();
    let assetName = 'deno-';

    if (arch === 'arm64') {
      assetName += 'aarch64-';
    } else {
      assetName += 'x86_64-';
    }

    if (platform === 'win32') {
      assetName += 'pc-windows-msvc.zip';
    } else if (platform === 'darwin') {
      assetName += 'apple-darwin.zip';
    } else {
      assetName += 'unknown-linux-gnu.zip';
    }

    const release = await GithubReleaseProvider.getLatestRelease('denoland/deno');
    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
      throw new AppError('NETWORK_FAILURE', `Could not find Deno release for ${platform} ${arch}`);
    }

    const checksumsAsset = release.assets.find((a) => a.name === `${assetName}.sha256sum`);
    let expectedSha: string | undefined;
    if (checksumsAsset) {
      const checksums = await GithubReleaseProvider.downloadChecksums(
        checksumsAsset.browser_download_url,
      );
      expectedSha = checksums[assetName];
    }

    const tempArchive = path.join(tempDir, assetName);
    await Downloader.downloadFile({
      url: asset.browser_download_url,
      destination: tempArchive,
      expectedSha256: expectedSha,
      onProgress: onProgress ? (d, t) => onProgress('deno', d, t) : undefined,
    });

    const extractDir = path.join(tempDir, `deno-${platform}-${arch}`);
    await this.fileSystem.delete(extractDir).catch(() => {});
    await SafeZipExtractor.extract({ sourceZip: tempArchive, targetDir: extractDir });

    const denoExe = platform === 'win32' ? 'deno.exe' : 'deno';
    const tempDeno = path.join(extractDir, denoExe);

    if (platform !== 'win32') {
      await this.runner.run({ bin: 'chmod', args: ['+x', tempDeno] });
    }

    const versionOutput = await this.getVersion(tempDeno, ['--version']);
    if (!versionOutput) {
      await this.fileSystem.delete(tempArchive).catch(() => {});
      await this.fileSystem.delete(extractDir).catch(() => {});
      throw new AppError(
        'DEPENDENCY_INSTALL_FAILED',
        'Downloaded Deno binary failed execution test.',
      );
    }

    const finalBin = path.join(this.managedBinDir, denoExe);
    const oldBin = path.join(this.managedBinDir, `${denoExe}.old`);
    await this.atomicSwap(tempDeno, finalBin, oldBin);

    await this.fileSystem.delete(tempArchive).catch(() => {});
    await this.fileSystem.delete(extractDir).catch(() => {});
    return true;
  }
}
