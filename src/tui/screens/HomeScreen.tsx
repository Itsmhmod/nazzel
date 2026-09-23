import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { KeyHint } from '../components/ui/KeyHint.js';

export interface HomeScreenProps {
  onSubmit: (url: string) => void;
  onShowDiagnostics: () => void;
  onQuit: () => void;
}

export function HomeScreen({ onSubmit, onShowDiagnostics, onQuit }: HomeScreenProps) {
  const [url, setUrl] = useState('');
  
  // We handle simple raw input for URL parsing instead of ink-text-input 
  // to avoid bringing in extra dependencies and keeping it lean.
  useInput((input, key) => {
    if (key.return) {
      if (url.trim().length > 0) {
        onSubmit(url.trim());
      }
    } else if (key.escape || (input === 'q' && url.length === 0)) {
      onQuit();
    } else if (input === 'd' && url.length === 0) {
      onShowDiagnostics();
    } else if (key.backspace || key.delete) {
      setUrl((prev) => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setUrl((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>
          NAZZEL
        </Text>
        <Text color={theme.muted}> - Terminal Media Downloader</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.text}>Enter media URL:</Text>
        <Box borderStyle="single" borderColor={theme.muted} paddingX={1} width={60}>
          <Text>{url}</Text>
          <Text color={theme.primary}>█</Text>
        </Box>
      </Box>

      <KeyHint
        keys={[
          { key: 'Enter', label: 'Analyze' },
          { key: 'd', label: 'Diagnostics' },
          { key: 'Esc/q', label: 'Quit' },
        ]}
      />
    </Box>
  );
}
