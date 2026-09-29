import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { AppError } from '@nazzel/domain/errors.js';
import { URL } from 'url';

export interface DownloadOptions {
  url: string;
  destination: string;
  expectedSha256?: string | undefined;
  onProgress?: ((downloaded: number, total: number | undefined) => void) | undefined;
  signal?: AbortSignal;
}

export class Downloader {
  static async downloadFile(options: DownloadOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const { url, destination, expectedSha256, onProgress, signal } = options;

      const parsedUrl = new URL(url);
      const reqFn = parsedUrl.protocol === 'http:' ? http.get : https.get;

      const hash = expectedSha256 ? crypto.createHash('sha256') : null;
      let downloaded = 0;
      let total: number | undefined = undefined;

      const writeStream = fs.createWriteStream(destination);

      const request = reqFn(
        url,
        {
          headers: {
            'User-Agent': 'NazzelDownloader/0.1.0',
          },
        },
        (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              writeStream.close();
              return reject(new AppError('NETWORK_FAILURE', 'Redirect without location header'));
            }
            writeStream.close();
            // Follow redirect once
            return resolve(
              this.downloadFile({
                ...options,
                url: redirectUrl.startsWith('http')
                  ? redirectUrl
                  : new URL(redirectUrl, url).toString(),
              }),
            );
          }

          if (response.statusCode && response.statusCode >= 400) {
            writeStream.close();
            return reject(
              new AppError('NETWORK_FAILURE', `HTTP Error ${response.statusCode} for ${url}`),
            );
          }

          const contentLength = response.headers['content-length'];
          if (contentLength) {
            total = parseInt(contentLength, 10);
          }

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (hash) {
              hash.update(chunk);
            }
            if (onProgress) {
              onProgress(downloaded, total);
            }
          });

          response.pipe(writeStream);

          response.on('end', () => {
            writeStream.close();
          });
        },
      );

      request.on('error', (err) => {
        writeStream.close();
        fs.unlink(destination, () => {});
        reject(new AppError('NETWORK_FAILURE', err.message));
      });

      writeStream.on('finish', () => {
        if (expectedSha256 && hash) {
          const actualHash = hash.digest('hex');
          if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
            fs.unlink(destination, () => {});
            return reject(
              new AppError(
                'VERIFY_FAILURE',
                `Checksum mismatch. Expected ${expectedSha256}, got ${actualHash}`,
              ),
            );
          }
        }
        resolve();
      });

      writeStream.on('error', (err) => {
        writeStream.close();
        fs.unlink(destination, () => {});
        reject(new AppError('FS_WRITE_FAILED', err.message));
      });

      if (signal) {
        if (signal.aborted) {
          request.destroy();
          writeStream.close();
          fs.unlink(destination, () => {});
          return reject(new AppError('CANCELLED', 'Download aborted'));
        }
        signal.addEventListener('abort', () => {
          request.destroy();
          writeStream.close();
          fs.unlink(destination, () => {});
          reject(new AppError('CANCELLED', 'Download aborted'));
        });
      }
    });
  }
}
