import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YtDlpEngine } from '@nazzel/infrastructure/ytdlp/YtDlpEngine.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('YtDlpEngine Integration', () => {
  let engine: YtDlpEngine;
  let mockRunner: IProcessRunner;
  let fixtureData: string;

  beforeEach(async () => {
    fixtureData = await fs.readFile(
      path.join(__dirname, '../fixtures/ytdlp-responses/video.json'),
      'utf-8',
    );
    mockRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: fixtureData, stderr: '' }),
      spawn: vi.fn(),
    };
    engine = new YtDlpEngine(mockRunner, 'yt-dlp');
  });

  it('correctly analyzes a video using real fixture data', async () => {
    const info = await engine.analyze('https://fake-url');

    expect(info.id).toBe('jNQXAC9IVRw');
    expect(info.title).toBe('Me at the zoo');
    expect(info.duration).toBe(19);
    expect(info.formats.length).toBeGreaterThan(0);
    expect(info.formats[0]).toHaveProperty('formatId');
    expect(info.formats[0]).toHaveProperty('ext');
    expect(info.formats[0]).toHaveProperty('resolution');
  });
});
