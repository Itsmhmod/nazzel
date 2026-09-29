import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { FormatSelectionScreen } from '../../src/tui/screens/FormatSelectionScreen.js';

vi.mock('ink', async () => {
  const actual: any = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

import { useInput } from 'ink';

function triggerInput(input: string, key: any = {}) {
  const mockUseInput = useInput as any;
  const callbacks = mockUseInput.mock.calls.map((call: any[]) => call[0]);
  callbacks.forEach((cb: any) => cb(input, key));
}

describe('FormatSelectionScreen Component', () => {
  const mockMediaInfo: any = {
    title: 'Test Video',
    formats: [
      {
        formatId: 'f1',
        ext: 'mp4',
        resolution: '1080p',
        filesize: 10000000,
        isVideoOnly: false,
        isAudioOnly: false,
        vcodec: 'h264',
      },
      {
        formatId: 'f2',
        ext: 'webm',
        resolution: '720p',
        filesize: 5000000,
        isVideoOnly: true,
        isAudioOnly: false,
        vcodec: 'vp9',
      },
      {
        formatId: 'f3',
        ext: 'm4a',
        filesize: 1000000,
        isVideoOnly: false,
        isAudioOnly: true,
        acodec: 'aac',
      },
    ],
  };

  it('renders title and options', () => {
    const { lastFrame } = render(
      <FormatSelectionScreen
        mediaInfo={mockMediaInfo as any}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const frame = lastFrame() || '';
    expect(frame).toContain('FORMAT SELECTION');
    expect(frame).toContain('Test Video');
    expect(frame).toContain('Best Quality (Auto-merged)');
    expect(frame).toContain('1080p');
    expect(frame).toContain('720p');
    expect(frame).toContain('AUDIO');
    expect(frame).toContain('V-ONLY');
    expect(frame).toContain('VIDEO'); // Best quality should be combined or default
  });

  it('handles cancellation via Escape', () => {
    const cancelMock = vi.fn();
    render(
      <FormatSelectionScreen
        mediaInfo={mockMediaInfo as any}
        onSelect={vi.fn()}
        onCancel={cancelMock}
      />,
    );
    triggerInput('', { escape: true }); // Escape
    expect(cancelMock).toHaveBeenCalled();
  });

  it('handles selection via Enter', () => {
    const selectMock = vi.fn();
    render(
      <FormatSelectionScreen mediaInfo={mockMediaInfo} onSelect={selectMock} onCancel={vi.fn()} />,
    );
    triggerInput('', { return: true }); // Selects first option (Best Quality)
    expect(selectMock).toHaveBeenCalledWith('best');
  });

  it('handles navigation via Down arrow', () => {
    const selectMock = vi.fn();
    render(
      <FormatSelectionScreen mediaInfo={mockMediaInfo} onSelect={selectMock} onCancel={vi.fn()} />,
    );
    triggerInput('', { downArrow: true }); // Down arrow
    triggerInput('', { return: true });
    // Best Quality is index 0. Index 1 should be f1 (highest filesize video+audio)
    expect(selectMock).toHaveBeenCalledWith('f1');
  });
});
