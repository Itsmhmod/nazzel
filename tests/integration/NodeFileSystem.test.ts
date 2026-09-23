import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeFileSystem } from '@nazzel/infrastructure/filesystem/NodeFileSystem.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('NodeFileSystem Integration', () => {
  let fileSystem: NodeFileSystem;
  let testDir: string;

  beforeEach(async () => {
    fileSystem = new NodeFileSystem();
    testDir = path.join(os.tmpdir(), `nazzel-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('can check if a file exists', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'hello');
    
    expect(await fileSystem.exists(filePath)).toBe(true);
    expect(await fileSystem.exists(path.join(testDir, 'nonexistent.txt'))).toBe(false);
  });

  it('can ensure directories are created', async () => {
    const deepDir = path.join(testDir, 'a', 'b', 'c');
    await fileSystem.ensureDir(deepDir);
    expect(await fileSystem.exists(deepDir)).toBe(true);
  });

  it('can move files', async () => {
    const src = path.join(testDir, 'src.txt');
    const dest = path.join(testDir, 'dest.txt');
    
    await fs.writeFile(src, 'content');
    await fileSystem.move(src, dest);
    
    expect(await fileSystem.exists(src)).toBe(false);
    expect(await fileSystem.exists(dest)).toBe(true);
  });
});
