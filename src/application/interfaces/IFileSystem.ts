import type { IFileStat } from '../../domain/types.js';

export interface IFileSystem {
  ensureDir(dirPath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  stat(filePath: string): Promise<IFileStat>;
  move(sourcePath: string, targetPath: string): Promise<void>;
  delete(filePath: string): Promise<void>;
  readJson<T>(filePath: string): Promise<T>;
  readFile(filePath: string): Promise<string>;
  writeJson<T>(filePath: string, data: T): Promise<void>;
  appendLine(filePath: string, line: string): Promise<void>;
  realpath(filePath: string): Promise<string>;
}
