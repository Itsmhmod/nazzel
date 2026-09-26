import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';

export interface ProgressBarProps {
  percent: number; // 0 to 100
  width?: number; // Max columns to occupy
}

export function ProgressBar({ percent, width = 40 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const chars = width * (clamped / 100);
  const filledWidth = Math.floor(chars);
  const frac = chars - filledWidth;
  
  const fractionChars = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];
  const fracChar = fractionChars[Math.floor(frac * fractionChars.length)] || ' ';
  
  const emptyWidth = Math.max(0, width - filledWidth - (fracChar !== ' ' ? 1 : 0));

  const filledStr = '█'.repeat(filledWidth);
  const emptyStr = ' '.repeat(emptyWidth);

  return (
    <Box>
      <Text color={theme.primary}>{filledStr}{fracChar !== ' ' ? fracChar : ''}</Text>
      <Text color={theme.bgLight}>{emptyStr}</Text>
    </Box>
  );
}
