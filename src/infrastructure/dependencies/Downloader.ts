import * as fs from 'fs';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { AppError } from '@nazzel/domain/errors.js';

export interface DownloadOptions {
  url: string;
  destination: string;
  expectedSha256?: string | undefined;
  timeoutMs?: number | undefined;
  onProgress?: ((downloaded: number, total: number) => void) | undefined;
}

export class Downloader {
  static async downloadFile(options: DownloadOptions): Promise<void> {
    const { url, destination, expectedSha256, timeoutMs, onProgress } = options;

    return new Promise((resolve, reject) => {
      const hash = expectedSha256 ? crypto.createHash('sha256') : null;
      let downloaded = 0;
      let total = 0;
      const writeStream = fs.createWriteStream(destination);
      let isRejected = false;
      let requestTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (requestTimeout) {
          clearTimeout(requestTimeout);
        }
        writeStream.destroy();
        fs.unlink(destination, () => {});
      };

      const doReject = (err: Error) => {
        if (isRejected) {
          return;
        }
        isRejected = true;
        cleanup();
        reject(new AppError('NETWORK_FAILURE', err.message));
      };

      const execute = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          return doReject(new Error('Too many redirects'));
        }

        const parsedUrl = new URL(requestUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(requestUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            execute(res.headers.location, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            res.resume();
            return doReject(new Error(`HTTP ${res.statusCode}`));
          }

          total = parseInt(res.headers['content-length'] || '0', 10);

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (hash) {
              hash.update(chunk);
            }
            if (onProgress) {
              onProgress(downloaded, total);
            }
            writeStream.write(chunk);
          });

          res.on('end', () => {
            writeStream.end(() => {
              if (requestTimeout) {
                clearTimeout(requestTimeout);
              }

              if (expectedSha256 && hash) {
                const actualSha256 = hash.digest('hex');
                if (actualSha256 !== expectedSha256) {
                  fs.unlink(destination, () => {});
                  return reject(
                    new AppError(
                      'VERIFY_FAILURE',
                      `Checksum mismatch. Expected ${expectedSha256}, got ${actualSha256}`,
                    ),
                  );
                }
              }
              resolve();
            });
          });

          res.on('error', (err) => {
            doReject(err);
          });
        });

        req.on('error', (err) => {
          doReject(err);
        });

        if (timeoutMs && redirectCount === 0) {
          requestTimeout = setTimeout(() => {
            req.destroy();
            doReject(new Error('Request timed out'));
          }, timeoutMs);
        }
      };

      writeStream.on('error', (err) => {
        doReject(err);
      });

      execute(url);
    });
  }
}
