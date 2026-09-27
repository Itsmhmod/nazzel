import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { DownloadScreen } from '../../src/tui/screens/DownloadScreen.js';

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

describe('DownloadScreen Component', () => {
  it('renders downloading state', () => {
    const progress = {
      percent: 45.5,
      speed: '5 MiB/s',
      downloaded: 45000000,
      total: 100000000,
      eta: 120,
      phase: 'downloading' as const
    };
    
    const { lastFrame } = render(
      <DownloadScreen title="My Cool Video" progress={progress as any} onCancel={vi.fn()} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('My Cool Video');
    expect(frame).toContain('45.5%');
    expect(frame).toContain('5 MiB/s');
    expect(frame).toContain('ETA: 2:00');
  });

  it('renders merging state', () => {
    const progress = {
      percent: 100,
      speed: '',
      downloaded: null,
      total: null,
      eta: null,
      phase: 'merging' as const
    };
    
    const { lastFrame } = render(
      <DownloadScreen title="My Cool Video" progress={progress as any} onCancel={vi.fn()} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Processing media (merging/converting)');
  });

  it('handles cancellation', () => {
    const cancelMock = vi.fn();
    render(
      <DownloadScreen progress={null} onCancel={cancelMock} />
    );
    triggerInput('q');
    expect(cancelMock).toHaveBeenCalled();
  });
});
