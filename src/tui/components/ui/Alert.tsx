import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';

export interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  children?: React.ReactNode;
}

export function Alert({ type, title, children }: AlertProps) {
  const borderColor = theme[type];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box marginBottom={children ? 1 : 0}>
        <Text bold color={borderColor}>
          {title}
        </Text>
      </Box>
      {children && <Box flexDirection="column">{children}</Box>}
    </Box>
  );
}
