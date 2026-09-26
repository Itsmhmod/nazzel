import type { IHistoryEntry } from '@nazzel/domain/types.js';

export interface IHistoryManager {
  readAll(): Promise<IHistoryEntry[]>;
  append(entry: IHistoryEntry): Promise<void>;
  clear(): Promise<void>;
}
