import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { AppError } from '@nazzel/domain/errors.js';
import { GithubReleaseProvider } from '../infrastructure/dependencies/GithubReleaseProvider.js';
import { Downloader } from '../infrastructure/dependencies/Downloader.js';
import { NAZZEL_VERSION } from '../shared/version.js';
import { DependencyManager } from '../infrastructure/dependencies/DependencyManager.js';
import envPaths from 'env-paths';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  platform: string;
  arch: string;
}

export class LifecycleManager {
  private readonly REPO = 'Itsmhmod/nazzel';
  private readonly isDev: boolean;
  private readonly exePath: string;
  private readonly lockPath: string;

  constructor() {
    this.exePath = process.execPath;
    const basename = path.basename(this.exePath).toLowerCase();
    this.isDev =
      basename.includes('node') ||
      basename.includes('tsx') ||
      this.exePath.includes('node_modules');
    const paths = envPaths('nazzel', { suffix: '' });
    this.lockPath = path.join(paths.data, 'update.lock');
    if (!fs.existsSync(paths.data)) {
      fs.mkdirSync(paths.data, { recursive: true });
    }
  }

  private getPlatformArch(): { platform: string; arch: string } {
    let platform = os.platform() as string;
    let arch = os.arch();

    if (platform === 'win32') {
      platform = 'windows';
    }
    if (arch === 'x64') {
      arch = 'x64';
    }
    if (arch === 'arm64') {
      arch = 'arm64';
    }

    return { platform, arch };
  }

  // Simple semantic version comparator (e.g. 0.1.0 vs 0.1.1)
  // Prereleases like 0.1.0-test1 are ignored as we only fetch latest stable releases via GithubReleaseProvider.getLatestRelease.
  // If explicitly requested, we can do a naive compare.
  private compareVersions(v1: string, v2: string): number {
    const parse = (v: string) => {
      const match = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.*))?$/);
      if (!match) {
        return [0, 0, 0, v];
      }
      return [
        parseInt(match[1] as string),
        parseInt(match[2] as string),
        parseInt(match[3] as string),
        match[4] || '',
      ];
    };

    const p1 = parse(v1);
    const p2 = parse(v2);

    for (let i = 0; i < 3; i++) {
      if ((p1[i] as number) > (p2[i] as number)) {
        return 1;
      }
      if ((p1[i] as number) < (p2[i] as number)) {
        return -1;
      }
    }
    // Prerelease logic: stable > prerelease.
    if (!p1[3] && p2[3]) {
      return 1;
    }
    if (p1[3] && !p2[3]) {
      return -1;
    }
    return 0;
  }

  public async checkUpdate(): Promise<UpdateCheckResult> {
    const release = await GithubReleaseProvider.getLatestRelease(this.REPO);
    const latestVersion = release.tag_name.replace(/^v/, '');
    const { platform, arch } = this.getPlatformArch();

    // Do not automatically select prereleases (already handled if we use /releases/latest endpoint which ignores prereleases unless there are no stable ones).
    const cmp = this.compareVersions(latestVersion, NAZZEL_VERSION);

    return {
      currentVersion: NAZZEL_VERSION,
      latestVersion,
      hasUpdate: cmp > 0,
      platform,
      arch,
    };
  }

  private lock(): number {
    try {
      const fd = fs.openSync(
        this.lockPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      );
      fs.writeSync(fd, process.pid.toString());
      return fd;
    } catch (e: any) {
      if (e.code === 'EEXIST') {
        throw new AppError(
          'UPDATE_FAILED',
          'Another update or lifecycle operation is currently in progress. Stale lock? Run repair to clear.',
        );
      }
      throw new AppError('UPDATE_FAILED', `Failed to acquire lock: ${e.message}`);
    }
  }

  private unlock(fd: number) {
    try {
      fs.closeSync(fd);
      fs.unlinkSync(this.lockPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  public async update(targetVersion?: string): Promise<string> {
    if (this.isDev) {
      throw new AppError(
        'UPDATE_FAILED',
        'Nazzel is running from a development environment. Cannot self-update source code.',
      );
    }

    let release;
    if (targetVersion) {
      const tag = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
      release = await GithubReleaseProvider.getReleaseByTag(this.REPO, tag);
    } else {
      release = await GithubReleaseProvider.getLatestRelease(this.REPO);
    }

    const version = release.tag_name.replace(/^v/, '');

    // Downgrade protection
    if (!targetVersion && this.compareVersions(version, NAZZEL_VERSION) <= 0) {
      return `Already up to date: ${NAZZEL_VERSION}`;
    }

    const { platform, arch } = this.getPlatformArch();
    const assetName = `nazzel-${version}-${platform}-${arch}${platform === 'windows' ? '.exe' : ''}`;

    const asset = release.assets.find((a: any) => a.name === assetName);
    if (!asset) {
      throw new AppError('UPDATE_FAILED', `No release artifact found for ${assetName}`);
    }

    const fd = this.lock();
    const tmpExe = path.join(
      os.tmpdir(),
      `nazzel-temp-${Date.now()}${platform === 'windows' ? '.exe' : ''}`,
    );
    const backupExe = this.exePath + '.old';

    try {
      // Get SHA256SUMS
      process.stderr.write('Fetching SHA256SUMS...\n');
      const checksumsUrl = `https://github.com/${this.REPO}/releases/download/${release.tag_name}/SHA256SUMS`;
      let checksums: Record<string, string>;
      try {
        checksums = await GithubReleaseProvider.downloadChecksums(checksumsUrl);
      } catch (e: any) {
        throw new AppError('UPDATE_FAILED', `Failed to download checksums: ${e.message}`);
      }

      const expectedSha256 = checksums[assetName];
      if (!expectedSha256) {
        throw new AppError(
          'UPDATE_FAILED',
          `Checksum for ${assetName} missing in SHA256SUMS file.`,
        );
      }

      // Download
      process.stderr.write('Downloading artifact: ' + asset.browser_download_url + '\n');
      await Downloader.downloadFile({
        url: asset.browser_download_url,
        destination: tmpExe,
        expectedSha256,
      });
      process.stderr.write('Download complete. Performing file replacement...\n');

      if (platform !== 'windows') {
        fs.chmodSync(tmpExe, 0o755);
      }

      // Safe atomic replacement
      if (fs.existsSync(backupExe)) {
        fs.unlinkSync(backupExe);
      }

      // Rename currently running executable (Windows permits this, Linux/macOS permit replacing via rename)
      fs.renameSync(this.exePath, backupExe);
      try {
        fs.renameSync(tmpExe, this.exePath);
      } catch (err) {
        // Rollback on rename failure
        fs.renameSync(backupExe, this.exePath);
        throw err;
      }

      // Verify new executable executes correctly
      const result = spawnSync(this.exePath, ['--version'], { encoding: 'utf8' });
      if (result.status !== 0 || !result.stdout.includes(version)) {
        // Rollback
        fs.unlinkSync(this.exePath);
        fs.renameSync(backupExe, this.exePath);
        throw new AppError(
          'UPDATE_FAILED',
          'New executable failed verification. Rolled back successfully.',
        );
      }

      // Cleanup backup if possible (Windows might lock it until we exit, so we ignore errors here)
      try {
        fs.unlinkSync(backupExe);
      } catch {
        /* ignore */
      }

      return `Updated to Nazzel ${version}`;
    } finally {
      if (fs.existsSync(tmpExe)) {
        try {
          fs.unlinkSync(tmpExe);
        } catch {
          /* ignore */
        }
      }
      this.unlock(fd);
    }
  }

  public async repair(depManager: DependencyManager): Promise<string[]> {
    let fd: number;
    const repairs: string[] = [];

    try {
      fd = this.lock();
    } catch (e: any) {
      if (e.code === 'UPDATE_FAILED' && e.message.includes('Stale lock?')) {
        let isRunning = true; // Assume active by default
        try {
          if (fs.existsSync(this.lockPath)) {
            const lockContent = fs.readFileSync(this.lockPath, 'utf8').trim();
            const pid = parseInt(lockContent, 10);
            if (!isNaN(pid)) {
              isRunning = false;
              try {
                process.kill(pid, 0);
                isRunning = true;
              } catch (killErr: any) {
                if (killErr.code === 'EPERM') {
                  isRunning = true;
                }
              }
            } else {
              // If empty or invalid, assume it crashed during creation (stale)
              isRunning = false;
            }
          } else {
            // File doesn't exist? Race condition, try to lock again.
            isRunning = false;
          }
        } catch {
          // If we can't read it or parse it, assume it's active to be safe
        }

        if (isRunning) {
          throw e;
        }

        try {
          if (fs.existsSync(this.lockPath)) {
            fs.unlinkSync(this.lockPath);
          }
        } catch {
          throw new AppError('UPDATE_FAILED', 'Failed to remove stale lock file.');
        }

        repairs.push('Cleared stale lock file.');
        fd = this.lock();
      } else {
        throw e;
      }
    }

    try {
      // 1. Check for old backup files from updates and clean them up
      if (!this.isDev) {
        const backupExe = this.exePath + '.old';
        if (fs.existsSync(backupExe)) {
          try {
            fs.unlinkSync(backupExe);
            repairs.push('Cleaned up stale backup executable.');
          } catch {
            /* might still be locked, ignore */
          }
        }
      }

      // 2. Ensure dependencies
      try {
        await depManager.installMissing();
        repairs.push('Verified managed dependencies (yt-dlp, ffmpeg, ffprobe, deno).');
      } catch (e: any) {
        repairs.push(`Dependency repair failed: ${e.message}`);
      }

      return repairs.length > 0 ? repairs : ['No repairs were necessary.'];
    } finally {
      this.unlock(fd);
    }
  }

  public async uninstall(purgeData: boolean): Promise<string[]> {
    if (this.isDev) {
      throw new AppError(
        'UNINSTALL_FAILED',
        'Nazzel is running from a development environment. Cannot uninstall source code.',
      );
    }

    const fd = this.lock();
    const actions: string[] = [];
    const { platform } = this.getPlatformArch();

    try {
      // Create a detached process to delete the executable, because we are running it right now on Windows.
      // On Windows, you can't delete an executing file, but you CAN delete a renamed executing file? No, Windows prevents deleting any running executable.
      // We will spawn a background script that waits 2 seconds, then deletes the exe.
      if (platform === 'windows') {
        const scriptPath = path.join(os.tmpdir(), `nazzel-uninstall-${Date.now()}.ps1`);
        let scriptContent = `Start-Sleep -Seconds 2; Remove-Item -Force -Path '${this.exePath}';`;

        // Remove from PATH if requested or default
        const binDir = path.dirname(this.exePath);
        scriptContent += `
        $UserPath = [Environment]::GetEnvironmentVariable('PATH', 'User');
        if ($UserPath -match [regex]::Escape('${binDir}')) {
            $NewPath = ($UserPath -split ';' | Where-Object { $_ -ne '${binDir}' }) -join ';';
            [Environment]::SetEnvironmentVariable('PATH', $NewPath, 'User');
        }`;

        if (purgeData) {
          const paths = envPaths('nazzel', { suffix: '' });
          scriptContent += `
          Remove-Item -Recurse -Force -Path '${paths.data}' -ErrorAction SilentlyContinue;
          Remove-Item -Recurse -Force -Path '${paths.config}' -ErrorAction SilentlyContinue;
          Remove-Item -Recurse -Force -Path '${paths.cache}' -ErrorAction SilentlyContinue;
          `;
          actions.push('Purged application data, configuration, history, and dependencies.');
        }

        fs.writeFileSync(scriptPath, scriptContent);
        const child = require('child_process').spawn(
          'powershell',
          ['-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
          { detached: true, stdio: 'ignore' },
        );
        child.unref();
        actions.push('Scheduled executable deletion and PATH cleanup (will complete after exit).');
      } else {
        // macOS/Linux: we can just unlink the running executable
        fs.unlinkSync(this.exePath);
        actions.push('Removed Nazzel executable.');

        if (purgeData) {
          const paths = envPaths('nazzel', { suffix: '' });
          fs.rmSync(paths.data, { recursive: true, force: true });
          fs.rmSync(paths.config, { recursive: true, force: true });
          fs.rmSync(paths.cache, { recursive: true, force: true });
          actions.push('Purged application data, configuration, history, and dependencies.');
        }
        actions.push(
          'Note: You may need to manually remove ~/.local/bin from your PATH if you added it only for Nazzel.',
        );
      }

      return actions;
    } finally {
      this.unlock(fd);
    }
  }
}
