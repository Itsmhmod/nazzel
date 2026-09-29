import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Layout } from '../../src/tui/components/ui/Layout.js';
import { Text } from 'ink';

describe('Layout Component', () => {
  it('renders title and subtitle', () => {
    const { lastFrame } = render(
      <Layout title="MY_TITLE" subtitle="MY_SUBTITLE">
        <Text>Content</Text>
      </Layout>,
    );

    const frame = lastFrame() || '';
    expect(frame).toContain('MY_TITLE');
    expect(frame).toContain('MY_SUBTITLE');
    expect(frame).toContain('Content');
  });

  it('renders footer when provided', () => {
    const { lastFrame } = render(
      <Layout title="Title" footer={<Text>My Footer</Text>}>
        <Text>Content</Text>
      </Layout>,
    );

    const frame = lastFrame() || '';
    expect(frame).toContain('My Footer');
  });
});
