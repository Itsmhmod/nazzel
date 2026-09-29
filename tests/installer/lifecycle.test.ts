import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { LifecycleManager } from '../../src/application/LifecycleManager.js';
import { GithubReleaseProvider } from '../../src/infrastructure/dependencies/GithubReleaseProvider.js';
import { DependencyManager } from '../../src/infrastructure/dependencies/DependencyManager.js';
import { NAZZEL_VERSION } from '../../src/shared/version.js';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    openSync: vi.fn(),
    closeSync: vi.fn(),
    unlinkSync: vi.fn(),
    renameSync: vi.fn(),
    chmodSync: vi.fn(),
    rmSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('../../src/infrastructure/dependencies/GithubReleaseProvider.js', () => ({
  GithubReleaseProvider: {
    getLatestRelease: vi.fn(),
    getReleaseByTag: vi.fn(),
    downloadChecksums: vi.fn(),
  },
}));

vi.mock('../../src/infrastructure/dependencies/Downloader.js', () => ({
  Downloader: {
    downloadFile: vi.fn(),
  },
}));

describe('LifecycleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.openSync as any).mockReturnValue(99);
  });

  it('detects dev environment correctly', () => {
    const originalExecPath = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', { value: '/usr/bin/node', configurable: true });
      const m = new LifecycleManager();
      expect((m as any).isDev).toBe(true);

      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/nazzel',
        configurable: true,
      });
      const m2 = new LifecycleManager();
      expect((m2 as any).isDev).toBe(false);
    } finally {
      Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    }
  });

  it('compares versions correctly in checkUpdate', async () => {
    vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
      tag_name: 'v999.0.0',
      assets: [],
      prerelease: false,
      draft: false,
    });

    const m = new LifecycleManager();
    const result = await m.checkUpdate();
    expect(result.currentVersion).toBe(NAZZEL_VERSION);
    expect(result.latestVersion).toBe('999.0.0');
    expect(result.hasUpdate).toBe(true);
  });

  it('aborts update if in dev mode', async () => {
    const originalExecPath = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', { value: '/usr/bin/node', configurable: true });
      const m = new LifecycleManager();
      await expect(m.update()).rejects.toThrow('Cannot self-update source code');
    } finally {
      Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    }
  });

  it('aborts update if no update available', async () => {
    const originalExecPath = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/nazzel',
        configurable: true,
      });
      vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
        tag_name: 'v' + NAZZEL_VERSION,
        assets: [],
        prerelease: false,
        draft: false,
      });
      const m = new LifecycleManager();
      const result = await m.update();
      expect(result).toMatch(/Already up to date/);
    } finally {
      Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    }
  });

  it('performs atomic swap on update', async () => {
    const originalExecPath = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/nazzel',
        configurable: true,
      });

      const latestVersion = '999.0.0';
      const m = new LifecycleManager();
      const { platform, arch } = (m as any).getPlatformArch();
      const assetName = `nazzel-${latestVersion}-${platform}-${arch}${platform === 'windows' ? '.exe' : ''}`;

      vi.mocked(GithubReleaseProvider.getLatestRelease).mockResolvedValue({
        tag_name: 'v' + latestVersion,
        assets: [{ name: assetName, browser_download_url: 'http://example.com' }],
        prerelease: false,
        draft: false,
      });

      vi.mocked(GithubReleaseProvider.downloadChecksums).mockResolvedValue({
        [assetName]: 'fakehash',
      });

      vi.mocked(child_process.spawnSync).mockReturnValue({
        status: 0,
        stdout: latestVersion,
      } as any);

      const result = await m.update();
      expect(result).toBe(`Updated to Nazzel ${latestVersion}`);

      // Verify atomic rename steps
      expect(fs.renameSync).toHaveBeenCalledWith(
        '/usr/local/bin/nazzel',
        '/usr/local/bin/nazzel.old',
      );
      expect(fs.renameSync).toHaveBeenCalledWith(
        expect.stringContaining('nazzel-temp-'),
        '/usr/local/bin/nazzel',
      );
    } finally {
      Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    }
  });

  it('repairs dependencies successfully', async () => {
    const originalExecPath = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/bin/nazzel',
        configurable: true,
      });

      const m = new LifecycleManager();

      const depManager = {
        installMissing: vi.fn().mockResolvedValue(undefined),
      } as unknown as DependencyManager;

      const result = await m.repair(depManager);
      expect(depManager.installMissing).toHaveBeenCalled();
      expect(result).toContain('Verified managed dependencies (yt-dlp, ffmpeg, ffprobe, deno).');
    } finally {
      Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
    }
  });
});
