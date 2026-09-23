import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Alert } from '../components/ui/Alert.js';
import { KeyHint } from '../components/ui/KeyHint.js';

export interface RecoveringScreenProps {
  attempt: number;
  maxAttempts: number;
  onCancel: () => void;
}

export function RecoveringScreen({ attempt, maxAttempts, onCancel }: RecoveringScreenProps) {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Alert type="warning" title="Recovering Download...">
        <Box>
          <Text color={theme.text}>Attempt </Text>
          <Text color={theme.warning} bold>{attempt}</Text>
          <Text color={theme.text}> of </Text>
          <Text color={theme.warning} bold>{maxAttempts}</Text>
        </Box>
        <Text color={theme.muted}>Retrying in background...</Text>
      </Alert>

      <KeyHint
        keys={[
          { key: 'Esc/q', label: 'Cancel' },
        ]}
      />
    </Box>
  );
}
