import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';

export interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  bold?: boolean;
}

export function Badge({ label, color = theme.text, bgColor, bold = false }: BadgeProps) {
  return (
    <Box paddingX={1}>
      <Text color={color} {...(bgColor ? { backgroundColor: bgColor as any } : {})} bold={bold}>
        {label}
      </Text>
    </Box>
  );
}
