import { AppError } from '@nazzel/domain/errors.js';

export interface GithubAsset {
  name: string;
  browser_download_url: string;
}

export interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
  prerelease: boolean;
  draft: boolean;
}

export class GithubReleaseProvider {
  static async getReleaseByTag(repo: string, tag: string): Promise<GithubRelease> {
    const url = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
    const headers: Record<string, string> = {
      'User-Agent': 'NazzelDownloader/0.1.0',
      Accept: 'application/vnd.github.v3+json',
    };
    if (process.env['GITHUB_TOKEN']) {
      headers['Authorization'] = `token ${process.env['GITHUB_TOKEN']}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError(
        'NETWORK_FAILURE',
        `GitHub API Error ${response.status} for ${repo} tag ${tag}`,
      );
    }

    try {
      const release = (await response.json()) as GithubRelease;
      return release;
    } catch {
      throw new AppError('NETWORK_FAILURE', 'Invalid JSON from GitHub API');
    }
  }

  static async getLatestRelease(repo: string): Promise<GithubRelease> {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const headers: Record<string, string> = {
      'User-Agent': 'NazzelDownloader/0.1.0',
      Accept: 'application/vnd.github.v3+json',
    };
    if (process.env['GITHUB_TOKEN']) {
      headers['Authorization'] = `token ${process.env['GITHUB_TOKEN']}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError('NETWORK_FAILURE', `GitHub API Error ${response.status} for ${repo}`);
    }

    try {
      const release = (await response.json()) as GithubRelease;
      return release;
    } catch {
      throw new AppError('NETWORK_FAILURE', 'Invalid JSON from GitHub API');
    }
  }

  static async downloadChecksums(url: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'User-Agent': 'NazzelDownloader/0.1.0',
    };
    if (process.env['GITHUB_TOKEN']) {
      headers['Authorization'] = `token ${process.env['GITHUB_TOKEN']}`;
    }
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new AppError('NETWORK_FAILURE', `HTTP Error ${response.status} getting checksums`);
    }

    const data = await response.text();
    const checksums: Record<string, string> = {};
    const lines = data.split('\n');
    let psHash = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Hash')) {
        psHash = trimmed.split(/:\s+/)[1] || trimmed.split(/\s+/).pop() || '';
        continue;
      }
      if (trimmed.startsWith('Path')) {
        const psPath = trimmed.split(/:\s+/)[1] || trimmed.split(/\s+/).pop() || '';
        const basename = psPath.split(/[/\\]/).pop();
        if (psHash && basename) {
          checksums[basename] = psHash.toLowerCase();
        }
        continue;
      }

      // SHA256SUMS format usually: <hash>  <filename> or <hash> *<filename>
      const parts = trimmed.split(/\s+/);
      const firstPart = parts[0];
      if (parts.length >= 2 && firstPart && /^[a-fA-F0-9]{8,128}$/.test(firstPart)) {
        const hash = firstPart;
        const filename = parts.slice(1).join(' ').replace(/^\*/, '');
        if (hash && filename) {
          checksums[filename] = hash.toLowerCase();
        }
      }
    }
    return checksums;
  }
}
