import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { HistoryManager } from '../../../src/application/HistoryManager.js';
import type { IFileSystem } from '../../../src/application/interfaces/IFileSystem.js';

describe('HistoryManager', () => {
  let mockFileSystem: Mocked<IFileSystem>;
  let manager: HistoryManager;

  const validRecordBase = {
    id: 'test-123',
    timestamp: '2026-09-22T19:47:00Z',
    url: 'https://example.com/video',
    title: 'Test Video',
    formatId: '137+140',
    filePath: '/tmp/test.mp4',
    duration: 120,
    fileSize: 1024,
    status: 'completed' as const,
  };

  beforeEach(() => {
    mockFileSystem = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      stat: vi.fn(),
      move: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined) as any,
      readJson: vi.fn() as any,
      readFile: vi.fn().mockResolvedValue(''),
      writeJson: vi.fn(),
      appendLine: vi.fn().mockResolvedValue(undefined),
      realpath: vi.fn().mockResolvedValue('/test/history.ndjson')
    };
    manager = new HistoryManager(mockFileSystem, '/test/history.ndjson');
  });

  it('appends a record with schemaVersion 1', async () => {
    await manager.append(validRecordBase);

    expect(mockFileSystem.appendLine).toHaveBeenCalledTimes(1);
    const args = mockFileSystem.appendLine.mock.calls[0]!;
    expect(args[0]).toBe('/test/history.ndjson');
    
    const writtenJson = JSON.parse(args[1] as string);
    expect(writtenJson.schemaVersion).toBe(1);
    expect(writtenJson.id).toBe('test-123');
  });

  it('reads all valid records', async () => {
    const validLine1 = JSON.stringify({ ...validRecordBase, schemaVersion: 1, id: '1' });
    const validLine2 = JSON.stringify({ ...validRecordBase, schemaVersion: 1, id: '2' });
    
    mockFileSystem.readFile.mockResolvedValue(`${validLine1}\n${validLine2}\n`);

    const records = await manager.readAll();
    
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('1');
    expect(records[1]?.id).toBe('2');
  });

  it('tolerates malformed and partial records', async () => {
    const validLine1 = JSON.stringify({ ...validRecordBase, schemaVersion: 1, id: '1' });
    const corruptedLine = '{ "id": "2", "timestamp": "broken'; // partial JSON
    const invalidStatusLine = JSON.stringify({ ...validRecordBase, schemaVersion: 1, id: '3', status: 'unknown_magic' });
    const missingFieldsLine = JSON.stringify({ id: '4', schemaVersion: 1 });
    const validLine2 = JSON.stringify({ ...validRecordBase, schemaVersion: 1, id: '5' });

    mockFileSystem.readFile.mockResolvedValue(
      `${validLine1}\n${corruptedLine}\n${invalidStatusLine}\n${missingFieldsLine}\n${validLine2}\n`
    );

    const records = await manager.readAll();
    
    // Only the two valid ones should survive
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe('1');
    expect(records[1]?.id).toBe('5');
  });

  it('returns empty array if file does not exist', async () => {
    mockFileSystem.exists.mockResolvedValue(false);
    
    const records = await manager.readAll();
    
    expect(records).toEqual([]);
    expect(mockFileSystem.readFile).not.toHaveBeenCalled();
  });

  it('clears history file', async () => {
    mockFileSystem.exists.mockResolvedValue(true);
    await manager.clear();
    
    expect(mockFileSystem.delete).toHaveBeenCalledWith('/test/history.ndjson');
  });

  it('does not throw on clear if file does not exist', async () => {
    mockFileSystem.exists.mockResolvedValue(false);
    await manager.clear();
    
    expect(mockFileSystem.delete).not.toHaveBeenCalled();
  });
});
