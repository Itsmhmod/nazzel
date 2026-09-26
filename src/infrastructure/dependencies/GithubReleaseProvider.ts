import * as https from 'https';
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
  static async getLatestRelease(repo: string): Promise<GithubRelease> {
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/${repo}/releases/latest`;

      const request = https.get(
        url,
        {
          headers: {
            'User-Agent': 'NazzelDownloader/0.1.0',
            'Accept': 'application/vnd.github.v3+json'
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new AppError('NETWORK_FAILURE', `GitHub API Error ${res.statusCode} for ${repo}`));
          }

          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const release = JSON.parse(data);
              resolve(release);
            } catch {
              reject(new AppError('NETWORK_FAILURE', 'Invalid JSON from GitHub API'));
            }
          });
        }
      );

      request.on('error', (err) => {
        reject(new AppError('NETWORK_FAILURE', err.message));
      });
    });
  }

  static async downloadChecksums(url: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const request = https.get(
        url,
        {
          headers: {
            'User-Agent': 'NazzelDownloader/0.1.0',
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const redirectUrl = res.headers.location;
            if (redirectUrl) {
              return resolve(this.downloadChecksums(redirectUrl));
            }
          }

          if (res.statusCode && res.statusCode >= 400) {
            return reject(new AppError('NETWORK_FAILURE', `HTTP Error ${res.statusCode} getting checksums`));
          }

          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
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
            resolve(checksums);
          });
        }
      );

      request.on('error', (err) => {
        reject(new AppError('NETWORK_FAILURE', err.message));
      });
    });
  }
}
