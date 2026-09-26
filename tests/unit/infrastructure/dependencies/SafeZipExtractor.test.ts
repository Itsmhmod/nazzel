import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SafeZipExtractor } from '../../../../src/infrastructure/dependencies/SafeZipExtractor.js';
import * as fs from 'fs/promises';
import { ZipReader } from '@zip.js/zip.js';

vi.mock('fs/promises');
vi.mock('@zip.js/zip.js');

describe('SafeZipExtractor', () => {
  let mockGetEntries: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('mock-zip-data'));
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    mockGetEntries = vi.fn().mockResolvedValue([]);
    mockClose = vi.fn().mockResolvedValue(undefined);

    vi.mocked(ZipReader).mockImplementation(() => ({
      getEntries: mockGetEntries,
      close: mockClose
    }) as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockEntry = (opts: any) => ({
    filename: opts.filename,
    directory: opts.directory || false,
    uncompressedSize: opts.uncompressedSize || 100,
    externalFileAttributes: opts.externalFileAttributes,
    getData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  });

  it('extracts a valid archive', async () => {
    mockGetEntries.mockResolvedValue([
      createMockEntry({ filename: 'bin/ffmpeg.exe' }),
      createMockEntry({ filename: 'bin/ffprobe.exe' })
    ]);

    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .resolves.toBeUndefined();
    
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
  });

  it('rejects archive with excessive entry count', async () => {
    mockGetEntries.mockResolvedValue(new Array(50001).fill(null));
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive contains too many entries');
  });

  it('rejects archive with excessive total uncompressed size', async () => {
    mockGetEntries.mockResolvedValue([
      createMockEntry({ filename: 'file1.bin', uncompressedSize: 600 * 1024 * 1024 }),
      createMockEntry({ filename: 'file2.bin', uncompressedSize: 600 * 1024 * 1024 })
    ]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target', maxUncompressedSize: 1024 * 1024 * 1024, maxEntrySize: 1024 * 1024 * 1024 }))
      .rejects.toThrow('Archive total uncompressed size exceeds limit');
  });

  it('rejects archive with single entry exceeding max size', async () => {
    mockGetEntries.mockResolvedValue([
      createMockEntry({ filename: 'huge.bin', uncompressedSize: 1024 * 1024 * 600 })
    ]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target', maxUncompressedSize: 1024 * 1024 * 1024, maxEntrySize: 1024 * 1024 * 500 }))
      .rejects.toThrow('Archive entry exceeds maximum allowed size');
  });

  it('rejects absolute paths', async () => {
    mockGetEntries.mockResolvedValue([createMockEntry({ filename: '/etc/passwd' })]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to absolute path');
  });

  it('rejects drive-letter paths', async () => {
    mockGetEntries.mockResolvedValue([createMockEntry({ filename: 'C:\\Windows\\System32\\cmd.exe' })]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to drive letter');
  });

  it('rejects path traversal (..)', async () => {
    mockGetEntries.mockResolvedValue([createMockEntry({ filename: 'bin/../../etc/passwd' })]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to unsafe path traversal');
  });

  it('rejects NUL bytes in path', async () => {
    mockGetEntries.mockResolvedValue([createMockEntry({ filename: 'bin/malicious\0.exe' })]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to NUL byte');
  });

  it('rejects symlink entries', async () => {
    mockGetEntries.mockResolvedValue([
      createMockEntry({ filename: 'link', externalFileAttributes: 0o120000 << 16 })
    ]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to symlink entry');
  });

  it('rejects exact duplicate normalized paths', async () => {
    mockGetEntries.mockResolvedValue([
      createMockEntry({ filename: 'bin/ffmpeg.exe' }),
      createMockEntry({ filename: 'bin\\ffmpeg.exe' }) // Normalizes to the same
    ]);
    await expect(SafeZipExtractor.extract({ sourceZip: 'dummy.zip', targetDir: '/target' }))
      .rejects.toThrow('Archive rejected due to duplicate normalized path');
  });
});
