// @ts-nocheck
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { TextInput } from '../../src/tui/components/ui/TextInput.js';
import { render } from 'ink-testing-library';

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
  const callback = mockUseInput.mock.calls[mockUseInput.mock.calls.length - 1][0];
  callback(input, key);
}

function TestWrapper({ onSubmit }: { onSubmit?: (val: string) => void }) {
  const [val, setVal] = useState('');
  return <TextInput value={val} onChange={setVal} onSubmit={onSubmit} placeholder="Empty..." />;
}

describe('TextInput Component', () => {
  it('renders placeholder when empty', () => {
    const { lastFrame } = render(<TextInput value="" onChange={() => {}} placeholder="Empty..." />);
    expect(lastFrame()).toContain('Empty...');
  });

  it('handles character input', async () => {
    const { lastFrame } = render(<TestWrapper />);
    triggerInput('a');
    triggerInput('b');
    triggerInput('c');
    expect(lastFrame()).toContain('a');
    expect(lastFrame()).toContain('b');
    expect(lastFrame()).toContain('c');
  });

  it('handles backspace', async () => {
    const { lastFrame } = render(<TestWrapper />);
    triggerInput('a');
    triggerInput('b');
    triggerInput('', { backspace: true }); // backspace
    expect(lastFrame()).not.toContain('b');
    expect(lastFrame()).toContain('a');
  });

  it('handles left and right arrow keys and cursor movement', async () => {
    const { lastFrame } = render(<TestWrapper />);
    triggerInput('a');
    triggerInput('c');
    // Left arrow
    triggerInput('', { leftArrow: true });
    triggerInput('b');
    // Right arrow
    triggerInput('', { rightArrow: true });
    triggerInput('d');
    
    expect(lastFrame()?.replace(/\x1B\[[0-9;]*m/g, '')).toContain('abcd');
  });

  it('submits on enter', async () => {
    const submitMock = vi.fn();
    render(<TestWrapper onSubmit={submitMock} />);
    triggerInput('x');
    triggerInput('', { return: true });
    expect(submitMock).toHaveBeenCalledWith('x');
  });
});
