import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Alert } from '../components/ui/Alert.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Layout } from '../components/ui/Layout.js';
import type { IDownloadResult } from '@nazzel/domain/types.js';

export interface CompletedScreenProps {
  title?: string | undefined;
  result: IDownloadResult | null;
  onRestart: () => void;
  onQuit: () => void;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'Unknown duration';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CompletedScreen({ title, result, onRestart, onQuit }: CompletedScreenProps) {
  useInput((input, key) => {
    if (key.return || input === 'r') {
      onRestart();
    } else if (key.escape || input === 'q') {
      onQuit();
    }
  });

  return (
    <Layout
      title="COMPLETED"
      subtitle="Download Finished"
      footer={
        <KeyHint
          keys={[
            { key: 'Enter/r', label: 'New Download' },
            { key: 'Esc/q', label: 'Quit' },
          ]}
        />
      }
    >
      <Box paddingX={2} marginY={1}>
        <Alert type="success" title="Success">
          <Text color={theme.text} bold>
            {title}
          </Text>
          {result && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.muted}>
                Path: <Text color={theme.text}>{result.filePath}</Text>
              </Text>
              <Text color={theme.muted}>
                Size: <Text color={theme.text}>{formatBytes(result.fileSize)}</Text>
              </Text>
              <Text color={theme.muted}>
                Duration: <Text color={theme.text}>{formatDuration(result.duration)}</Text>
              </Text>
              <Text color={theme.muted}>
                Verified:{' '}
                <Text color={result.verified ? theme.success : theme.error}>
                  {result.verified ? 'Yes' : 'No'}
                </Text>
              </Text>
            </Box>
          )}
        </Alert>
      </Box>
    </Layout>
  );
}
