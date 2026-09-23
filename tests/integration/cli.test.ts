import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { join } from 'path';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');

describe('CLI Integration', () => {
  // We need to build the project first for the CLI to be available in dist/
  
  it('shows help when run with --help', async () => {
    const { stdout } = await execa('node', [CLI_PATH, '--help']);
    expect(stdout).toContain('Usage: nazzel');
    expect(stdout).toContain('Local-first terminal media downloader');
  }, 30000);

  it('shows version when run with --version', async () => {
    const { stdout } = await execa('node', [CLI_PATH, '--version']);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/); // e.g. 0.1.0
  }, 30000);

  it('shows version when run with version command', async () => {
    const { stdout } = await execa('node', [CLI_PATH, 'version']);
    expect(stdout).toContain('VERSION_INFO');
  }, 30000);

  it('fails with code 2 for invalid flags', async () => {
    try {
      await execa('node', [CLI_PATH, '--invalid-flag']);
      expect.fail('Should have exited with error');
    } catch (error: any) {
      expect(error.exitCode).toBe(2);
      expect(error.stderr).toContain("error: unknown option '--invalid-flag'");
    }
  }, 30000);

  it('outputs NDJSON for history list', async () => {
    const { stdout } = await execa('node', [CLI_PATH, 'history']);
    // Should be valid JSON
    const data = JSON.parse(stdout);
    expect(data.type).toBe('HISTORY_LIST');
    expect(Array.isArray(data.history)).toBe(true);
  }, 30000);
});
