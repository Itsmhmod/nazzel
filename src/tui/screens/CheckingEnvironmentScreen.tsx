import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { Layout } from '../components/ui/Layout.js';

export function CheckingEnvironmentScreen() {
  return (
    <Layout title="STARTING" subtitle="Initializing Nazzel">
      <Box
        flexDirection="column"
        gap={1}
        padding={2}
        marginY={2}
        borderStyle="round"
        borderColor="cyan"
      >
        <Box>
          <Text color="cyan" bold>
            Nazzel{' '}
          </Text>
          <Text color="gray">v0.1.0</Text>
        </Box>
        <Box gap={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text>Checking runtime environment and dependencies...</Text>
        </Box>
      </Box>
    </Layout>
  );
}
