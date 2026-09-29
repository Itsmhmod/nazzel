import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppError } from '@nazzel/domain/errors.js';

export interface ExtractOptions {
  sourceZip: string;
  targetDir: string;
  maxEntries?: number;
  maxUncompressedSize?: number;
  maxEntrySize?: number;
}

export class SafeZipExtractor {
  // Defensive limits based on FFmpeg packaging
  // FFmpeg zip is typically ~100MB compressed, ~300MB uncompressed, ~2000 entries.
  private static DEFAULT_MAX_ENTRIES = 50000;
  private static DEFAULT_MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024; // 1 GB
  private static DEFAULT_MAX_ENTRY_SIZE = 1024 * 1024 * 500; // 500 MB

  public static async extract(options: ExtractOptions): Promise<void> {
    const maxEntries = options.maxEntries ?? this.DEFAULT_MAX_ENTRIES;
    const maxTotalSize = options.maxUncompressedSize ?? this.DEFAULT_MAX_UNCOMPRESSED_SIZE;
    const maxEntrySize = options.maxEntrySize ?? this.DEFAULT_MAX_ENTRY_SIZE;

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(options.sourceZip);
    } catch (e: any) {
      throw AppError.from('FS_WRITE_FAILED', e, { action: 'readFile', file: options.sourceZip });
    }

    const zipReader = new ZipReader(new Uint8ArrayReader(new Uint8Array(buffer)));

    try {
      const entries = await zipReader.getEntries();

      if (entries.length > maxEntries) {
        throw new AppError(
          'DEPENDENCY_INSTALL_FAILED',
          `Archive contains too many entries: ${entries.length} > ${maxEntries}`,
        );
      }

      let totalSize = 0;
      const normalizedPaths = new Set<string>();

      // 1. Validation Pass
      for (const entry of entries) {
        const filename = entry.filename;
        const uncompressedSize = entry.uncompressedSize || 0;

        // Zip Bomb protection
        if (uncompressedSize > maxEntrySize) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive entry exceeds maximum allowed size: ${filename} (${uncompressedSize} bytes)`,
          );
        }
        totalSize += uncompressedSize;
        if (totalSize > maxTotalSize) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive total uncompressed size exceeds limit (${maxTotalSize} bytes)`,
          );
        }

        // Security: Path validation
        if (!filename || filename.trim() === '') {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            'Archive contains entry with empty filename',
          );
        }

        if (filename.includes('\0')) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            'Archive rejected due to NUL byte in filename',
          );
        }

        // Drive letter protection (e.g. C:, D:)
        if (/^[a-zA-Z]:/.test(filename)) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive rejected due to drive letter in path: ${filename}`,
          );
        }

        if (path.isAbsolute(filename) || filename.startsWith('/') || filename.startsWith('\\')) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive rejected due to absolute path: ${filename}`,
          );
        }

        const parts = filename.split(/[/\\]/);
        if (parts.includes('..')) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive rejected due to unsafe path traversal: ${filename}`,
          );
        }

        const normalized = path.normalize(filename);
        if (normalized.startsWith('..' + path.sep)) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Archive entry normalizes outside staging root: ${filename}`,
          );
        }

        // Prevent exact duplicate normalized paths from overwriting each other maliciously
        if (!entry.directory) {
          if (normalizedPaths.has(normalized)) {
            throw new AppError(
              'DEPENDENCY_INSTALL_FAILED',
              `Archive rejected due to duplicate normalized path: ${normalized}`,
            );
          }
          normalizedPaths.add(normalized);
        }

        // External file attributes (upper 16 bits encode file type in Unix)
        // Check for symlinks. 0xA000 is the Unix mask for symbolic link.
        const externalAttrs = entry.externalFileAttributes;
        if (externalAttrs !== null && externalAttrs !== undefined) {
          const unixMode = externalAttrs >>> 16;
          if ((unixMode & 0o170000) === 0o120000) {
            throw new AppError(
              'DEPENDENCY_INSTALL_FAILED',
              `Archive rejected due to symlink entry: ${filename}`,
            );
          }
        }
      }

      // 2. Extraction Pass
      for (const entry of entries) {
        if (entry.directory) {
          continue;
        }

        const targetPath = path.resolve(options.targetDir, entry.filename);
        const resolvedTargetDir = path.resolve(options.targetDir);

        // Final sanity check
        if (
          !targetPath.startsWith(resolvedTargetDir + path.sep) &&
          targetPath !== resolvedTargetDir
        ) {
          throw new AppError(
            'DEPENDENCY_INSTALL_FAILED',
            `Extraction path escaped target directory: ${targetPath}`,
          );
        }

        const targetDir = path.dirname(targetPath);
        await fs.mkdir(targetDir, { recursive: true });

        if (entry.getData) {
          const data = await entry.getData(new Uint8ArrayWriter());
          await fs.writeFile(targetPath, data);
        }
      }
    } finally {
      await zipReader.close();
    }
  }
}
