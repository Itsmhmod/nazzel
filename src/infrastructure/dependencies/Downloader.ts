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

    return new Promise(async (resolve, reject) => {
      const hash = expectedSha256 ? crypto.createHash('sha256') : null;
      let downloaded = 0;
      let total = 0;
      const writeStream = fs.createWriteStream(destination);
      let isRejected = false;
      let requestTimeout: NodeJS.Timeout | null = null;
      let abortController = new AbortController();

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
        abortController.abort();
        cleanup();
        reject(new AppError('NETWORK_FAILURE', err.message));
      };

      try {
        if (timeoutMs) {
          requestTimeout = setTimeout(() => {
            doReject(new Error('Request timed out'));
          }, timeoutMs);
        }

        const res = await fetch(url, { signal: abortController.signal, redirect: 'follow' });

        if (!res.ok) {
          return doReject(new Error(`HTTP ${res.status}`));
        }

        total = parseInt(res.headers.get('content-length') || '0', 10);

        if (!res.body) {
          return doReject(new Error('No response body'));
        }

        // We use the async iterator of the web ReadableStream
        // Note: res.body is a ReadableStream<Uint8Array>
        const reader = res.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          downloaded += value.length;
          if (hash) {
            hash.update(value);
          }
          if (onProgress) {
            onProgress(downloaded, total);
          }

          // Write chunk and handle backpressure if needed (simplified for CLI context)
          const canWrite = writeStream.write(value);
          if (!canWrite) {
            await new Promise<void>((res) => writeStream.once('drain', () => res()));
          }
        }

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
                  `Checksum mismatch. Expected ${expectedSha256}, got ${actualSha256}`
                )
              );
            }
          }
          resolve();
        });
      } catch (err: any) {
        doReject(err);
      }
    });
  }
}
