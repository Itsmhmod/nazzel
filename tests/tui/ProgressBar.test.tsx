import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ProgressBar } from '../../src/tui/components/ui/ProgressBar.js';

describe('ProgressBar Component', () => {
  it('renders 0% correctly', () => {
    const { lastFrame } = render(<ProgressBar percent={0} width={10} />);
    // Since it's colored, ink-testing-library preserves some chalk output, but we can check raw strings
    const frame = lastFrame() || '';
    expect(frame).not.toContain('█');
  });

  it('renders 100% correctly', () => {
    const { lastFrame } = render(<ProgressBar percent={100} width={10} />);
    const frame = lastFrame() || '';
    expect(frame).toContain('██████████');
  });

  it('renders 50% correctly', () => {
    const { lastFrame } = render(<ProgressBar percent={50} width={10} />);
    const frame = lastFrame() || '';
    expect(frame).toContain('█████');
  });
});
