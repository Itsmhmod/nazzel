import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';

export interface ProgressBarProps {
  percent: number; // 0 to 100
  width?: number; // Max columns to occupy
}

export function ProgressBar({ percent, width = 40 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filledWidth = Math.floor((clamped / 100) * width);
  const emptyWidth = width - filledWidth;

  const filledStr = '█'.repeat(filledWidth);
  const emptyStr = '░'.repeat(emptyWidth);

  return (
    <Box>
      <Text color={theme.primary}>{filledStr}</Text>
      <Text color={theme.muted}>{emptyStr}</Text>
    </Box>
  );
}
