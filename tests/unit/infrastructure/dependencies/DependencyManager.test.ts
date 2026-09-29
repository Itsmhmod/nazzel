import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DependencyManager } from '../../../../src/infrastructure/dependencies/DependencyManager.js';
import { GithubReleaseProvider } from '../../../../src/infrastructure/dependencies/GithubReleaseProvider.js';
import { Downloader } from '../../../../src/infrastructure/dependencies/Downloader.js';

import type { IProcessRunner } from '../../../../src/application/interfaces/IProcessRunner.js';
import type { IFileSystem } from '../../../../src/application/interfaces/IFileSystem.js';
import type { INazzelConfig } from '../../../../src/domain/types.js';
import { Mocked } from 'vitest';
import * as path from 'path';

vi.mock('../../../../src/infrastructure/dependencies/GithubReleaseProvider.js');
vi.mock('../../../../src/infrastructure/dependencies/Downloader.js');
vi.mock('../../../../src/infrastructure/dependencies/SafeZipExtractor.js');

describe('DependencyManager', () => {
  let runner: Mocked<IProcessRunner>;
  let fileSystem: Mocked<IFileSystem>;
  let config: INazzelConfig;
  let manager: DependencyManager;

  beforeEach(() => {
    runner = {
      run: vi.fn(),
      spawn: vi.fn(),
    };
    fileSystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      stat: vi.fn(),
      realpath: vi.fn().mockImplementation(async (p: string) => p),
    } as any;
    config = {
      ytdlpPath: null,
      ffmpegPath: null,
      ffprobePath: null,
      denoPath: null,
    } as any;

    manager = new DependencyManager(runner, fileSystem, config);
    (manager as any).isWindows = false; // Mock platform as Linux for tests by default
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('detectAll', () => {
    it('detects missing dependencies', async () => {
      runner.run.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });
      const report = await manager.detectAll();
      expect(report.allOk).toBe(false);
      expect(report.missingCritical).toContain('yt-dlp');
      expect(report.missingCritical).toContain('ffmpeg');
      expect(report.missingCritical).toContain('ffprobe');
    });

    it('identifies outdated yt-dlp', async () => {
      // Mock yt-dlp returning old version
      runner.run.mockImplementation(async (args) => {
        if (args.bin.includes('yt-dlp')) {
          return { exitCode: 0, stdout: '2022.10.10', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const ytdlp = report.deps.find((d) => d.name === 'yt-dlp');
      expect(ytdlp?.status).toBe('outdated');
      expect(ytdlp?.version).toBe('2022.10.10');
    });

    it('identifies ok dependencies', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin.includes('yt-dlp')) {
          return { exitCode: 0, stdout: '2023.11.16', stderr: '' };
        }
        if (args.bin.includes('ffmpeg') || args.bin.includes('ffprobe')) {
          return { exitCode: 0, stdout: 'ffmpeg version 6.0', stderr: '' };
        }
        if (args.bin.includes('deno')) {
          return { exitCode: 0, stdout: 'deno 2.3.1', stderr: '' };
        }
        if (args.bin.includes('node')) {
          return { exitCode: 0, stdout: 'v22.1.0', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      expect(report.allOk).toBe(true);
      expect(report.deps.every((d) => d.status === 'ok')).toBe(true);
    });

    it('respects config overrides and reports source as config', async () => {
      (config as any).ytdlpPath = '/custom/yt-dlp';
      runner.run.mockImplementation(async (args) => {
        if (args.bin === '/custom/yt-dlp') {
          return { exitCode: 0, stdout: '2023.11.16', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const ytdlp = report.deps.find((d) => d.name === 'yt-dlp');
      expect(ytdlp?.source).toBe('config');
    });

    it('reports source as managed if located in managedDir', async () => {
      const managedBinDir = (manager as any).managedBinDir;
      runner.run.mockImplementation(async (args) => {
        if (args.bin === path.join(managedBinDir, 'yt-dlp')) {
          return { exitCode: 0, stdout: '2023.11.16', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const ytdlp = report.deps.find((d) => d.name === 'yt-dlp');
      expect(ytdlp?.source).toBe('managed');
    });
  });

  describe('update', () => {
    it('refuses to update user-managed dependency', async () => {
      (config as any).ytdlpPath = '/custom/yt-dlp';
      runner.run.mockImplementation(async (args) => {
        if (args.bin === '/custom/yt-dlp') {
          return { exitCode: 0, stdout: '2023.11.16', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      await expect(manager.update('yt-dlp')).rejects.toThrow(
        'Cannot update user-managed dependency: yt-dlp (source: config)',
      );
    });
  });

  describe('install yt-dlp', () => {
    beforeEach(() => {
      vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
        assets: [
          { name: 'yt-dlp_linux', browser_download_url: 'http://url/linux' },
          { name: 'SHA2-256SUMS', browser_download_url: 'http://url/sha' },
        ],
      } as any);
      vi.mocked(GithubReleaseProvider.downloadChecksums).mockResolvedValue({
        'yt-dlp_linux': 'abc123def',
      });
    });

    it('performs successful staged install with execution validation', async () => {
      // Mock tempBin running successfully
      runner.run.mockResolvedValue({ exitCode: 0, stdout: '2024.01.01', stderr: '' });
      fileSystem.stat.mockResolvedValue({ isFile: true } as any);

      const result = await manager.install('yt-dlp');
      expect(result).toBe(true);

      // Verify Downloader was called with checksum
      expect(Downloader.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedSha256: 'abc123def',
        }),
      );

      // Verify validation ran on temp bin
      expect(runner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['--version'],
        }),
      );
    });

    it('fails if execution validation fails, cleans temp bin', async () => {
      // Mock tempBin execution failure
      runner.run.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });

      await expect(manager.install('yt-dlp')).rejects.toThrow(
        'Downloaded yt-dlp binary failed execution test.',
      );

      // Should delete the temp bin
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('fails if checksums not found for asset', async () => {
      vi.mocked(GithubReleaseProvider.downloadChecksums).mockResolvedValue({
        other_file: '123',
      });
      await expect(manager.install('yt-dlp')).rejects.toThrow(
        'No checksum found for yt-dlp binary',
      );
    });
  });

  describe('install ffmpeg', () => {
    beforeEach(() => {
      // Default: mock as Linux (non-Windows) so existing Linux-path tests still work.
      // Windows-specific tests override isWindows explicitly.
      vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
        assets: [
          // Linux asset (used when isWindows = false)
          {
            name: 'ffmpeg-master-latest-linux64-gpl.tar.xz',
            browser_download_url: 'http://url/linux.tar.xz',
          },
          // Windows x64 gpl-shared asset (used when isWindows = true)
          {
            name: 'ffmpeg-master-latest-win64-gpl-shared.zip',
            browser_download_url: 'http://url/win64.zip',
          },
          // Windows ARM64 gpl-shared asset
          {
            name: 'ffmpeg-master-latest-winarm64-gpl-shared.zip',
            browser_download_url: 'http://url/winarm64.zip',
          },
          // BtbN's actual checksum file name
          { name: 'checksums.sha256', browser_download_url: 'http://url/checksums.sha256' },
        ],
      } as any);
      vi.mocked(GithubReleaseProvider.downloadChecksums).mockResolvedValue({
        'ffmpeg-master-latest-linux64-gpl.tar.xz': 'abc123def',
        'ffmpeg-master-latest-win64-gpl-shared.zip': 'def456abc',
        'ffmpeg-master-latest-winarm64-gpl-shared.zip': 'ghi789xyz',
      });
    });

    it('fails on macOS', async () => {
      (manager as any).isWindows = false;
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'macOS managed FFmpeg installation is not supported by BtbN. Please install ffmpeg via Homebrew.',
      );
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('uses checksums.sha256 as the BtbN checksum file (Linux)', async () => {
      // Verify the correct checksum key is used for the Linux asset
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'tar' && args.args?.includes('-tf')) {
          return {
            exitCode: 0,
            stdout:
              'ffmpeg-master-latest-linux64-gpl/bin/ffmpeg\nffmpeg-master-latest-linux64-gpl/bin/ffprobe',
            stderr: '',
          };
        }
        if (args.bin === 'tar') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (args.args?.includes('-version')) {
          return { exitCode: 0, stdout: 'ffmpeg version 6.0', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });
      fileSystem.stat.mockResolvedValue({ isFile: true } as any);

      await manager.install('ffmpeg');

      // Should have downloaded with the sha256 from checksums.sha256 for the Linux asset
      expect(Downloader.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedSha256: 'abc123def',
        }),
      );
    });

    it('selects gpl-shared variant for Windows and uses its checksum', async () => {
      (manager as any).isWindows = true;
      runner.run.mockImplementation(async (args) => {
        if (args.args?.includes('-version')) {
          return { exitCode: 0, stdout: 'ffmpeg version 6.0', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });
      fileSystem.stat.mockResolvedValue({ isFile: true } as any);

      await manager.install('ffmpeg');

      // Must download the gpl-shared zip with its checksum
      expect(Downloader.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://url/win64.zip',
          expectedSha256: 'def456abc',
        }),
      );
    });

    it('performs extraction and execution validation on Linux', async () => {
      // Mock tar extraction and execution success
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'tar' && args.args?.includes('-tf')) {
          return { exitCode: 0, stdout: 'ffmpeg/bin/ffmpeg\nffmpeg/bin/ffprobe', stderr: '' };
        }
        if (args.bin === 'tar') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (args.args?.includes('-version')) {
          return { exitCode: 0, stdout: 'ffmpeg version 6.0', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' }; // for chmod, mv
      });
      fileSystem.stat.mockResolvedValue({ isFile: true } as any);

      const result = await manager.install('ffmpeg');
      expect(result).toBe(true);

      // Verify tar was used
      expect(runner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          bin: 'tar',
        }),
      );

      // Verify validation ran on temp bin
      expect(runner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['-version'],
        }),
      );
    });

    it('fails if tar extraction fails', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'tar' && args.args?.includes('-tf')) {
          return { exitCode: 0, stdout: 'file', stderr: '' };
        }
        if (args.bin === 'tar') {
          return { exitCode: 1, stdout: '', stderr: 'tar error' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });
      await expect(manager.install('ffmpeg')).rejects.toThrow('Tar extraction failed: tar error');
    });

    it('fails if FFmpeg execution validation fails', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'tar' && args.args?.includes('-tf')) {
          return { exitCode: 0, stdout: 'file', stderr: '' };
        }
        if (args.bin === 'tar') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (args.args?.includes('-version')) {
          return { exitCode: 1, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });
      fileSystem.stat.mockResolvedValue({ isFile: true } as any);

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Downloaded FFmpeg binaries failed execution test.',
      );

      // Should cleanup temp archive and extract dir
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('fails before execution if archive is missing ffmpeg.exe (ffmpegStat is null)', async () => {
      (manager as any).isWindows = true;
      // First stat call (ffmpeg) returns null, second (ffprobe) not reached
      fileSystem.stat
        .mockRejectedValueOnce(new Error('ENOENT')) // ffmpeg.exe missing
        .mockResolvedValueOnce({ isFile: true } as any); // ffprobe.exe (never reached)

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Archive is missing required executable: ffmpeg.exe',
      );
      // Staging files must be cleaned up
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('fails before execution if archive is missing ffprobe.exe (ffprobeStat is null)', async () => {
      (manager as any).isWindows = true;
      // First stat (ffmpeg) succeeds, second (ffprobe) returns null
      fileSystem.stat
        .mockResolvedValueOnce({ isFile: true } as any) // ffmpeg.exe present
        .mockRejectedValueOnce(new Error('ENOENT')); // ffprobe.exe missing

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Archive is missing required executable: ffprobe.exe',
      );
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('fails before execution if archive is missing ffprobe (isFile=false)', async () => {
      (manager as any).isWindows = true;
      // First stat (ffmpeg) is a file, second (ffprobe) is a directory (isFile=false)
      fileSystem.stat
        .mockResolvedValueOnce({ isFile: true } as any) // ffmpeg.exe
        .mockResolvedValueOnce({ isFile: false } as any); // ffprobe.exe is a dir (malformed archive)

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Archive is missing required executable: ffprobe.exe',
      );
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('rejects archive with path traversal', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'tar' && args.args?.includes('-tf')) {
          return { exitCode: 0, stdout: '../etc/passwd\nfile', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Archive rejected due to unsafe path traversal in contents.',
      );
      expect(fileSystem.delete).toHaveBeenCalled();
    });

    it('failed install cleans staging without touching pre-existing managed binaries', async () => {
      (manager as any).isWindows = true;
      // Simulate missing ffprobe — should clean up staging and NOT touch managed dir root files
      fileSystem.stat
        .mockResolvedValueOnce({ isFile: true } as any) // ffmpeg.exe staged
        .mockRejectedValueOnce(new Error('ENOENT')); // ffprobe.exe missing in archive

      await expect(manager.install('ffmpeg')).rejects.toThrow(
        'Archive is missing required executable: ffprobe.exe',
      );

      // delete should only be called for staging (tempArchive + extractDir)
      // not for the managed root dir binaries
      const deleteCalls = (fileSystem.delete as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0] as string,
      );
      const managedBinDir = (manager as any).managedBinDir;
      const rootDeletes = deleteCalls.filter(
        (p: string) =>
          p === path.join(managedBinDir, 'ffmpeg.exe') ||
          p === path.join(managedBinDir, 'ffprobe.exe'),
      );
      expect(rootDeletes).toHaveLength(0);
    });
  });

  describe('detect deno', () => {
    it('detects missing deno', async () => {
      runner.run.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });
      const report = await manager.detectAll();
      const deno = report.deps.find((d) => d.name === 'deno');
      expect(deno?.status).toBe('missing');
    });

    it('detects healthy deno >= 2.3.0', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'deno') {
          return { exitCode: 0, stdout: 'deno 2.3.0', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const deno = report.deps.find((d) => d.name === 'deno');
      expect(deno?.status).toBe('ok');
      expect(deno?.source).toBe('system');
      expect(deno?.version).toBe('2.3.0');
    });

    it('detects outdated deno < 2.3.0', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'deno') {
          return { exitCode: 0, stdout: 'deno 1.40.0', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const deno = report.deps.find((d) => d.name === 'deno');
      expect(deno?.status).toBe('outdated');
      expect(deno?.version).toBe('1.40.0');
    });

    it('detects malformed deno version as broken', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'deno') {
          return { exitCode: 0, stdout: 'deno is broken', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const deno = report.deps.find((d) => d.name === 'deno');
      expect(deno?.status).toBe('broken');
      expect(deno?.version).toBe('unknown');
    });
  });

  describe('detect node', () => {
    it('detects missing node', async () => {
      runner.run.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });
      const report = await manager.detectAll();
      const node = report.deps.find((d) => d.name === 'node');
      expect(node?.status).toBe('missing');
    });

    it('detects healthy node >= 22.0.0', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'node') {
          return { exitCode: 0, stdout: 'v22.1.0', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const node = report.deps.find((d) => d.name === 'node');
      expect(node?.status).toBe('ok');
      expect(node?.source).toBe('system');
      expect(node?.version).toBe('22.1.0');
    });

    it('detects outdated node < 22.0.0', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'node') {
          return { exitCode: 0, stdout: 'v20.9.0', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const node = report.deps.find((d) => d.name === 'node');
      expect(node?.status).toBe('outdated');
      expect(node?.version).toBe('20.9.0');
    });

    it('detects malformed node version as broken', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.bin === 'node') {
          return { exitCode: 0, stdout: 'node is here', stderr: '' };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      });
      const report = await manager.detectAll();
      const node = report.deps.find((d) => d.name === 'node');
      expect(node?.status).toBe('broken');
      expect(node?.version).toBe('unknown');
    });
  });

  describe('install deno', () => {
    beforeEach(() => {
      vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
        assets: [
          {
            name: 'deno-x86_64-unknown-linux-gnu.zip',
            browser_download_url: 'http://url/deno.zip',
          },
          {
            name: 'deno-x86_64-unknown-linux-gnu.zip.sha256sum',
            browser_download_url: 'http://url/deno.sha',
          },
          { name: 'deno-x86_64-pc-windows-msvc.zip', browser_download_url: 'http://url/deno.zip' },
          {
            name: 'deno-x86_64-pc-windows-msvc.zip.sha256sum',
            browser_download_url: 'http://url/deno.sha',
          },
          { name: 'deno-aarch64-pc-windows-msvc.zip', browser_download_url: 'http://url/deno.zip' },
          {
            name: 'deno-aarch64-pc-windows-msvc.zip.sha256sum',
            browser_download_url: 'http://url/deno.sha',
          },
          { name: 'deno-x86_64-apple-darwin.zip', browser_download_url: 'http://url/deno.zip' },
          {
            name: 'deno-x86_64-apple-darwin.zip.sha256sum',
            browser_download_url: 'http://url/deno.sha',
          },
          { name: 'deno-aarch64-apple-darwin.zip', browser_download_url: 'http://url/deno.zip' },
          {
            name: 'deno-aarch64-apple-darwin.zip.sha256sum',
            browser_download_url: 'http://url/deno.sha',
          },
        ],
      } as any);
      vi.mocked(GithubReleaseProvider.downloadChecksums).mockResolvedValue({
        'deno-x86_64-unknown-linux-gnu.zip': 'abc123def',
        'deno-x86_64-pc-windows-msvc.zip': 'abc123def',
        'deno-aarch64-pc-windows-msvc.zip': 'abc123def',
        'deno-x86_64-apple-darwin.zip': 'abc123def',
        'deno-aarch64-apple-darwin.zip': 'abc123def',
      });
    });

    it('performs successful staged install', async () => {
      runner.run.mockImplementation(async (args) => {
        if (args.args?.includes('--version')) {
          return { exitCode: 0, stdout: 'deno 1.40.0', stderr: '' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      const result = await manager.install('deno');
      expect(result).toBe(true);

      // Verify Downloader was called
      expect(Downloader.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://url/deno.zip',
          expectedSha256: 'abc123def',
        }),
      );

      // Verify execution test
      expect(runner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['--version'],
        }),
      );
    });
  });
});
