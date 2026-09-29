import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';

export interface KeyHintProps {
  keys: Array<{ key: string; label: string }>;
}

export function KeyHint({ keys }: KeyHintProps) {
  return (
    <Box marginTop={1}>
      {keys.map((k, idx) => (
        <Box key={idx} marginRight={2}>
          <Text color={theme.muted}>
            [
            <Text color={theme.text} bold>
              {k.key}
            </Text>
            ] {k.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
