import React from 'react';
import { Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { theme } from '../../theme.js';

export interface SpinnerProps {
  type?: 'dots' | 'line';
}

export function Spinner({ type = 'dots' }: SpinnerProps) {
  return (
    <Text color={theme.primary}>
      <InkSpinner type={type} />
    </Text>
  );
}
