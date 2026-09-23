import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Alert } from '../components/ui/Alert.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import type { AppError } from '@nazzel/domain/errors.js';

export interface ErrorScreenProps {
  error: AppError | null;
  onShowDiagnostics: () => void;
  onQuit: () => void;
}

export function ErrorScreen({ error, onShowDiagnostics, onQuit }: ErrorScreenProps) {
  useInput((input, key) => {
    if (input === 'd') {
      onShowDiagnostics();
    } else if (key.escape || key.return || input === 'q') {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Alert type="error" title="Download Failed">
        {error ? (
          <Box flexDirection="column">
            <Text color={theme.text}>{error.message}</Text>
            <Box marginTop={1}>
              <Text color={theme.muted}>Code: </Text>
              <Text color={theme.warning}>{error.code}</Text>
            </Box>
            <Box>
              <Text color={theme.muted}>Recoverable: </Text>
              <Text color={error.recoverable ? theme.success : theme.error}>
                {error.recoverable ? 'Yes (Exhausted)' : 'No'}
              </Text>
            </Box>
          </Box>
        ) : (
          <Text color={theme.text}>An unknown error occurred.</Text>
        )}
      </Alert>

      <KeyHint
        keys={[
          { key: 'd', label: 'Diagnostics' },
          { key: 'Enter/Esc', label: 'Quit' },
        ]}
      />
    </Box>
  );
}
