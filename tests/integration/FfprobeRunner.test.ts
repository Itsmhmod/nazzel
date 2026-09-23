import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FfprobeRunner } from '@nazzel/infrastructure/ffmpeg/FfprobeRunner.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FfprobeRunner Integration', () => {
  let runner: FfprobeRunner;
  let mockRunner: IProcessRunner;
  let fixtureData: string;

  beforeEach(async () => {
    fixtureData = await fs.readFile(path.join(__dirname, '../fixtures/ffprobe-responses/video.json'), 'utf-8');
    mockRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: fixtureData, stderr: '' }),
      spawn: vi.fn(),
    };
    runner = new FfprobeRunner(mockRunner, 'ffprobe');
  });

  it('correctly probes a media file using real fixture data', async () => {
    const result = await runner.probe('fake-file.mp4');
    
    expect(result.formatName).toBe('mp4');
    expect(result.duration).toBe(120.5);
    expect(result.size).toBe(20500000);
    expect(result.bitRate).toBe(1332000);
    
    expect(result.streams.length).toBe(2);
    expect(result.streams[0]?.codecType).toBe('video');
    expect(result.streams[0]?.codecName).toBe('h264');
    expect(result.streams[0]?.width).toBe(1280);
    expect(result.streams[1]?.codecType).toBe('audio');
  });
});
