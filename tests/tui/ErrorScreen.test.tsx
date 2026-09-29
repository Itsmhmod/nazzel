import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorScreen } from '../../src/tui/screens/ErrorScreen.js';
import { AppError } from '../../src/domain/errors.js';

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

describe('ErrorScreen Component', () => {
  it('renders error details and handles quit', () => {
    const error = new AppError('CONFIG_INVALID', 'Something bad happened');
    const quitMock = vi.fn();

    const { lastFrame } = render(
      <ErrorScreen error={error} onQuit={quitMock} onShowDiagnostics={vi.fn()} />,
    );

    const frame = lastFrame() || '';
    expect(frame).toContain('Something bad happened');
    expect(frame).toContain('CONFIG_INVALID');

    triggerInput('', { return: true }); // Enter
    expect(quitMock).toHaveBeenCalled();
  });
});
