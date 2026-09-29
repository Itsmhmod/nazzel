import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { HomeScreen } from '../../src/tui/screens/HomeScreen.js';

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
  const calls = mockUseInput.mock.calls;
  // HomeScreen has 2 useInputs (its own, and TextInput's).
  // They are the last 2 registered on every render.
  if (calls.length >= 2) {
    calls[calls.length - 2][0](input, key);
    calls[calls.length - 1][0](input, key);
  } else if (calls.length === 1) {
    calls[0][0](input, key);
  }
}

describe('HomeScreen Component', () => {
  it('renders title and input', () => {
    const { lastFrame } = render(
      <HomeScreen
        onSubmit={vi.fn()}
        onShowDiagnostics={vi.fn()}
        onShowHistory={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    const frame = lastFrame() || '';
    expect(frame).toContain('NAZZEL');
    expect(frame).toContain('Enter media URL');
  });

  it('allows quitting via q', () => {
    const quitMock = vi.fn();
    render(
      <HomeScreen
        onSubmit={vi.fn()}
        onShowDiagnostics={vi.fn()}
        onShowHistory={vi.fn()}
        onQuit={quitMock}
      />,
    );
    triggerInput('q');
    expect(quitMock).toHaveBeenCalled();
  });

  it('allows showing diagnostics via d', () => {
    const diagMock = vi.fn();
    render(
      <HomeScreen
        onSubmit={vi.fn()}
        onShowDiagnostics={diagMock}
        onShowHistory={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    triggerInput('d');
    expect(diagMock).toHaveBeenCalled();
  });

  it('allows showing history via h', () => {
    const histMock = vi.fn();
    render(
      <HomeScreen
        onSubmit={vi.fn()}
        onShowDiagnostics={vi.fn()}
        onShowHistory={histMock}
        onQuit={vi.fn()}
      />,
    );
    triggerInput('h');
    expect(histMock).toHaveBeenCalled();
  });

  it('disables shortcuts when typing URL', () => {
    const quitMock = vi.fn();
    const submitMock = vi.fn();
    const { lastFrame } = render(
      <HomeScreen
        onSubmit={submitMock}
        onShowDiagnostics={vi.fn()}
        onShowHistory={vi.fn()}
        onQuit={quitMock}
      />,
    );
    triggerInput('h'); // triggers history (which unmounts usually, but here just calls mock)
    // Wait, in HomeScreen, 'h' triggers onShowHistory if url is empty!
    // But then typing 'q' should quit. Let's type 'q' but wait, we need 'http'
    triggerInput('t'); // url is 't'
    triggerInput('t'); // url is 'tt'
    triggerInput('p'); // url is 'ttp'
    triggerInput('q'); // 'ttpq'
    expect(quitMock).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('ttpq');
  });

  it('submits valid URL on enter', () => {
    const submitMock = vi.fn();
    render(
      <HomeScreen
        onSubmit={submitMock}
        onShowDiagnostics={vi.fn()}
        onShowHistory={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    triggerInput('x');
    triggerInput('', { return: true });
    expect(submitMock).toHaveBeenCalledWith('x');
  });
});
