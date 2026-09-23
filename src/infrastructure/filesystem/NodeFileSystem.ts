import { AppError } from '@nazzel/domain/errors.js';
import type { IFileStat } from '@nazzel/domain/types.js';
import type { IFileSystem } from '@nazzel/application/interfaces/IFileSystem.js';
import * as fs from 'fs/promises';
import { constants } from 'fs';

export class NodeFileSystem implements IFileSystem {
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { dirPath, action: 'ensureDir' });
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<IFileStat> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mtime: stats.mtime,
      };
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'stat' });
    }
  }

  async move(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error: any) {
      if (error.code === 'EXDEV') {
        // Cross-device link not permitted, must copy and then delete
        await fs.copyFile(sourcePath, targetPath);
        await fs.unlink(sourcePath);
      } else {
        throw AppError.from('FS_WRITE_FAILED', error, { sourcePath, targetPath, action: 'move' });
      }
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'delete' });
      }
    }
  }

  async readJson<T>(filePath: string): Promise<T> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'readJson' });
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'readFile' });
    }
  }

  async writeJson<T>(filePath: string, data: T): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'writeJson' });
    }
  }

  async appendLine(filePath: string, line: string): Promise<void> {
    try {
      await fs.appendFile(filePath, line + '\n', 'utf8');
    } catch (error) {
      throw AppError.from('FS_WRITE_FAILED', error, { filePath, action: 'appendLine' });
    }
  }
}
