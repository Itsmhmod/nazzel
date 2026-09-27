import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { join } from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');

describe('Real CLI Download Lifecycle', () => {
  it('downloads a short test video completely', async () => {
    // We use a small generic MP4 since YouTube/GitHub are blocked in this environment
    const TEST_URL = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4';
    const outputDir = join(os.tmpdir(), 'nazzel_test_out_' + Date.now());
    const mockBinDir = join(os.tmpdir(), 'nazzel_test_bin_' + Date.now());
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(mockBinDir, { recursive: true });

    // Write a mock ffprobe so that verification doesn't fail due to missing dependency
    const mockFfprobePath = join(mockBinDir, 'ffprobe.cmd');
    await fs.writeFile(mockFfprobePath, `@echo off\necho {"format":{"duration":"10","size":"1000000","bit_rate":"800000","format_name":"mp4"},"streams":[]}\n`);

    // Ensure our mock ffprobe is in PATH
    const env = { ...process.env, PATH: `${mockBinDir};${process.env['PATH']}` };

    try {
      const { stdout, exitCode } = await execa('node', [
        CLI_PATH, 
        TEST_URL, 
        '--no-tui', 
        '--output', outputDir
      ], { env });

      expect(exitCode).toBe(0);

      // Verify that stdout contains NDJSON
      const lines = stdout.split('\n').filter(Boolean);
      const events = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      
      const successEvent = events.find(e => e.type === 'DOWNLOAD_COMPLETED');
      expect(successEvent).toBeDefined();
      
      // Verify that the output file exists
      const filePath = successEvent.result.filePath;
      expect(filePath).toBeDefined();
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      // Cleanup
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(mockBinDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 120000); // 120s timeout
});
