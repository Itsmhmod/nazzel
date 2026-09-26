import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Layout } from '../components/ui/Layout.js';

export function VerifyingScreen() {
  return (
    <Layout title="VERIFYING" subtitle="Checking download integrity">
      <Box paddingX={2} marginY={2} flexDirection="column">
        <Box marginBottom={1}>
          <Spinner />
          <Text color={theme.info}> Verifying media integrity...</Text>
        </Box>
        <Text color={theme.muted}>Running ffprobe stream analysis</Text>
      </Box>
    </Layout>
  );
}
