import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { RepairScreen } from '../../src/tui/screens/RepairScreen.js';

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

describe('RepairScreen Component', () => {
  const mockReport = {
    allOk: false,
    missingCritical: ['ffmpeg' as const],
    outdated: [],
    deps: [
      { name: 'ffmpeg' as const, status: 'missing' as const, version: '1.0', path: '', source: 'managed' as const, minVersion: '1.0' }
    ],
    checkedAt: new Date().toISOString()
  };

  it('renders missing dependencies and handles cancel', () => {
    const quitMock = vi.fn();
    
    const { lastFrame } = render(
      <RepairScreen report={mockReport} progress={null} onConfirm={vi.fn()} onQuit={quitMock} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Dependencies Missing');
    expect(frame).toContain('ffmpeg');
    expect(frame).toContain('missing');
    
    triggerInput('q');
    expect(quitMock).toHaveBeenCalled();
  });
});
