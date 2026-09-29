import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import clipboardy from 'clipboardy';
import { theme } from '../theme.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Layout } from '../components/ui/Layout.js';
import { TextInput } from '../components/ui/TextInput.js';

export interface HomeScreenProps {
  onSubmit: (url: string) => void;
  onShowDiagnostics: () => void;
  onShowHistory: () => void;
  onQuit: () => void;
}

export function HomeScreen({
  onSubmit,
  onShowDiagnostics,
  onShowHistory,
  onQuit,
}: HomeScreenProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    try {
      const text = clipboardy.readSync();
      if (text && /^https?:\/\//i.test(text.trim())) {
        setUrl(text.trim());
      }
    } catch {
      // Ignore clipboard read errors in headless environments
    }
  }, []);

  useInput(
    (input, key) => {
      if (key.escape || (input === 'q' && url.length === 0)) {
        onQuit();
      } else if (input === 'd' && url.length === 0) {
        onShowDiagnostics();
      } else if (input === 'h' && url.length === 0) {
        onShowHistory();
      }
    },
    { isActive: url.length === 0 },
  );

  return (
    <Layout
      title="NAZZEL"
      subtitle="Terminal Media Downloader"
      footer={
        <KeyHint
          keys={[
            { key: 'Enter', label: 'Analyze' },
            { key: 'h', label: 'History' },
            { key: 'd', label: 'Diagnostics' },
            { key: 'Esc/q', label: 'Quit' },
          ]}
        />
      }
    >
      <Box flexDirection="column" marginY={2} paddingX={2}>
        <Text color={theme.primary} bold>
          Enter media URL:
        </Text>
        <Box marginTop={1}>
          <TextInput
            value={url}
            onChange={setUrl}
            onSubmit={(val) => {
              if (val.trim().length > 0) {
                onSubmit(val.trim());
              }
            }}
            placeholder="https://..."
            width={60}
          />
        </Box>
      </Box>
    </Layout>
  );
}
