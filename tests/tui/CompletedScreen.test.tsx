import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { CompletedScreen } from '../../src/tui/screens/CompletedScreen.js';

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

describe('CompletedScreen Component', () => {
  it('renders success and metadata', () => {
    const result = {
      filePath: '/downloads/video.mp4',
      fileSize: 15000000,
      duration: 300, // 5:00
      verified: true
    };
    
    const { lastFrame } = render(
      <CompletedScreen title="Test Finished Video" result={result as any} onRestart={vi.fn()} onQuit={vi.fn()} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Test Finished Video');
    expect(frame).toContain('/downloads/video.mp4');
    expect(frame).toContain('14.31 MB');
    expect(frame).toContain('5:00');
    expect(frame).toContain('Verified: Yes');
  });

  it('handles quit via q', () => {
    const quitMock = vi.fn();
    render(
      <CompletedScreen title="Done" result={null} onRestart={vi.fn()} onQuit={quitMock} />
    );
    triggerInput('q');
    expect(quitMock).toHaveBeenCalled();
  });

  it('handles restart via r', () => {
    const restartMock = vi.fn();
    render(
      <CompletedScreen title="Done" result={null} onRestart={restartMock} onQuit={vi.fn()} />
    );
    triggerInput('r');
    expect(restartMock).toHaveBeenCalled();
  });
});
