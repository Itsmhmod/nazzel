import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { Spinner } from '../components/ui/Spinner.js';

export function VerifyingScreen() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Spinner />
        <Text color={theme.info}> Verifying media integrity...</Text>
      </Box>
      <Text color={theme.muted}>Running ffprobe stream analysis</Text>
    </Box>
  );
}
