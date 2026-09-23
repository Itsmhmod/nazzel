import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Spinner } from '../components/ui/Spinner.js';
import { KeyHint } from '../components/ui/KeyHint.js';

export interface AnalyzingScreenProps {
  url: string;
  onCancel: () => void;
}

export function AnalyzingScreen({ url, onCancel }: AnalyzingScreenProps) {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Spinner />
        <Text color={theme.text}> Analyzing URL...</Text>
      </Box>

      <Box>
        <Text color={theme.muted}>URL: </Text>
        <Text color={theme.info}>{url}</Text>
      </Box>

      <KeyHint
        keys={[
          { key: 'Esc/q', label: 'Cancel' },
        ]}
      />
    </Box>
  );
}
