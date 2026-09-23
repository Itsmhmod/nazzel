import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { YtDlpEngine } from '@nazzel/infrastructure/ytdlp/YtDlpEngine.js';
import type { IProcessRunner } from '@nazzel/application/interfaces/IProcessRunner.js';

describe('YtDlpEngine', () => {
  let runner: Mocked<IProcessRunner>;
  let engine: YtDlpEngine;

  beforeEach(() => {
    runner = {
      run: vi.fn(),
      spawn: vi.fn(),
    } as any;
    engine = new YtDlpEngine(runner, 'yt-dlp');
  });

  describe('analyze()', () => {
    it('parses valid metadata JSON', async () => {
      runner.run.mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          id: '123',
          title: 'Test Video',
          webpage_url: 'https://test.com',
          duration: 100,
          formats: [
            { format_id: '137', ext: 'mp4', format_note: '1080p', vcodec: 'avc1', acodec: 'none' },
            { format_id: '140', ext: 'm4a', format_note: 'audio only', vcodec: 'none', acodec: 'aac' },
          ]
        }),
        stderr: '',
      });

      const info = await engine.analyze('https://test.com');
      
      expect(info.id).toBe('123');
      expect(info.title).toBe('Test Video');
      expect(info.duration).toBe(100);
      expect(info.formats).toHaveLength(2);
      expect(info.formats[0]?.isVideoOnly).toBe(true);
      expect(info.formats[1]?.isAudioOnly).toBe(true);
    });

    it('throws EXTRACTOR_FAILURE if process fails', async () => {
      runner.run.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'ERROR: Unsupported URL',
      });

      await expect(engine.analyze('https://test.com')).rejects.toThrowError(
        expect.objectContaining({ code: 'EXTRACTOR_FAILURE' })
      );
    });
  });
});
