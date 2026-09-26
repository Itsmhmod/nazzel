import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { Spinner } from '../components/ui/Spinner.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Layout } from '../components/ui/Layout.js';

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
    <Layout 
      title="ANALYZING"
      subtitle="Fetching metadata..."
      footer={
        <KeyHint
          keys={[
            { key: 'Esc/q', label: 'Cancel' },
          ]}
        />
      }
    >
      <Box paddingX={2} marginY={2} flexDirection="column">
        <Box marginBottom={2}>
          <Spinner />
          <Text color={theme.text}> Extracting formats and media info...</Text>
        </Box>

        <Box padding={1} borderStyle="single" borderColor={theme.muted}>
          <Text color={theme.muted}>URL: </Text>
          <Text color={theme.info}>{url}</Text>
        </Box>
      </Box>
    </Layout>
  );
}
