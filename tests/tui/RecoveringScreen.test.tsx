import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { RecoveringScreen } from '../../src/tui/screens/RecoveringScreen.js';

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

describe('RecoveringScreen Component', () => {
  it('renders attempt counts and handles cancel', () => {
    const cancelMock = vi.fn();
    
    const { lastFrame } = render(
      <RecoveringScreen attempt={2} maxAttempts={5} onCancel={cancelMock} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Attempt');
    expect(frame).toContain('2');
    expect(frame).toContain('5');
    
    triggerInput('q');
    expect(cancelMock).toHaveBeenCalled();
  });
});
