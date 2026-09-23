import { AppError } from '@nazzel/domain/errors.js';
import type { IFileSystem } from './interfaces/IFileSystem.js';
import type { IHistoryEntry } from '@nazzel/domain/types.js';

export class HistoryManager {
  private readonly fileSystem: IFileSystem;
  private readonly historyPath: string;

  constructor(fileSystem: IFileSystem, historyPath: string) {
    this.fileSystem = fileSystem;
    this.historyPath = historyPath;
  }

  /**
   * Appends a new history record atomically to the NDJSON file.
   */
  async append(entry: Omit<IHistoryEntry, 'schemaVersion'>): Promise<void> {
    const fullEntry: IHistoryEntry = {
      ...entry,
      schemaVersion: 1, // Phase 2 requirement
    };

    const line = JSON.stringify(fullEntry);
    
    try {
      await this.fileSystem.appendLine(this.historyPath, line);
    } catch (error: any) {
      throw new AppError('FS_WRITE_FAILED', 'Failed to append history record', { cause: error, context: { path: this.historyPath } });
    }
  }

  /**
   * Reads and parses all history records. 
   * A single malformed record will be skipped and will not corrupt the whole view.
   */
  async readAll(): Promise<IHistoryEntry[]> {
    const exists = await this.fileSystem.exists(this.historyPath);
    if (!exists) {
      return [];
    }

    let rawData: string;
    try {
      rawData = await this.fileSystem.readFile(this.historyPath);
    } catch (error: any) {
      throw new AppError('FS_WRITE_FAILED', 'Failed to read history file', { cause: error, context: { path: this.historyPath } });
    }

    const lines = rawData.split('\n');
    const records: IHistoryEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (this.isValidRecord(parsed)) {
          records.push(parsed);
        }
        // Implicitly ignores records that fail validation without throwing
      } catch {
        // Ignores lines that are not valid JSON (e.g. corrupted / partial line)
      }
    }

    return records;
  }

  /**
   * Clears the entire history by deleting the file.
   */
  async clear(): Promise<void> {
    const exists = await this.fileSystem.exists(this.historyPath);
    if (!exists) {
      return;
    }
    
    try {
      await this.fileSystem.delete(this.historyPath);
    } catch (error: any) {
      throw new AppError('FS_WRITE_FAILED', 'Failed to clear history file', { cause: error, context: { path: this.historyPath } });
    }
  }

  /**
   * Validates that the parsed JSON roughly matches IHistoryEntry.
   * Tolerates missing optional fields.
   */
  private isValidRecord(data: any): data is IHistoryEntry {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    // Must have the required fields as per IHistoryEntry
    const requiredStr = ['id', 'timestamp', 'url', 'title', 'formatId', 'filePath', 'status'];
    for (const field of requiredStr) {
      if (typeof data[field] !== 'string') {
        return false;
      }
    }
    
    if (typeof data.fileSize !== 'number') {
      return false;
    }

    // duration can be number | null
    if (data.duration !== null && typeof data.duration !== 'number') {
      return false;
    }

    // Must have valid status strings
    const validStatuses = ['completed', 'failed', 'interrupted', 'cancelled'];
    if (!validStatuses.includes(data.status)) {
      return false; // Unknown status handled here
    }

    if (typeof data.schemaVersion !== 'number') {
      return false;
    }

    return true;
  }
}
