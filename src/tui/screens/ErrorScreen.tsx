import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Alert } from '../components/ui/Alert.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Badge } from '../components/ui/Badge.js';
import { Layout } from '../components/ui/Layout.js';
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
    <Layout 
      title="ERROR"
      subtitle="Download Failed"
      footer={
        <KeyHint
          keys={[
            { key: 'd', label: 'Diagnostics' },
            { key: 'Enter/Esc', label: 'Quit' },
          ]}
        />
      }
    >
      <Box paddingX={2} marginY={1}>
        <Alert type="error" title="Download Failed">
          {error ? (
            <Box flexDirection="column">
              <Text color={theme.text}>{error.message}</Text>
              <Box marginTop={1} flexDirection="column">
                <Box marginBottom={1}>
                  <Badge label={error.code} bgColor={theme.error} color={theme.bgDark} bold />
                  <Box marginLeft={1}>
                    <Text color={theme.muted}>
                      Recoverable: {error.recoverable ? 'Yes (Exhausted)' : 'No'}
                    </Text>
                  </Box>
                </Box>
                
                {!!error.cause && (
                  <Box flexDirection="column" marginTop={1} padding={1} borderStyle="single" borderColor={theme.muted}>
                    <Text color={theme.muted}>Cause Details:</Text>
                    <Text color={theme.text}>{String((error.cause as any).message || error.cause)}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <Text color={theme.text}>An unknown error occurred.</Text>
          )}
        </Alert>
      </Box>
    </Layout>
  );
}
