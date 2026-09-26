import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { ProgressBar } from '../components/ui/ProgressBar.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import type { IDownloadProgress } from '@nazzel/domain/types.js';

export interface DownloadScreenProps {
  title?: string | undefined;
  progress: IDownloadProgress | null;
  onCancel: () => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return '???';
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null) {
    return 'Unknown ETA';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function DownloadScreen({ title, progress, onCancel }: DownloadScreenProps) {
  const { columns, isNarrow } = useTerminalSize();

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
    }
  });

  const pct = progress?.percent ?? 0;
  const speed = progress?.speed ?? 'Calculating...';
  const downloaded = formatBytes(progress?.downloaded ?? null);
  const total = formatBytes(progress?.total ?? null);
  const eta = formatEta(progress?.eta ?? null);
  const phase = progress?.phase ?? 'downloading';

  // Fixed widths to prevent layout thrashing
  const speedStr = speed.padEnd(12, ' ');
  const fracStr = `${downloaded} / ${total}`.padStart(18, ' ');
  const etaStr = `ETA: ${eta}`.padEnd(12, ' ');
  
  const barWidth = Math.max(10, columns - (isNarrow ? 10 : 50));

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text color={theme.text} bold>{title || 'Downloading...'}</Text>
      </Box>

      {phase === 'merging' || phase === 'converting' ? (
        <Box marginBottom={1} padding={1} borderStyle="round" borderColor={theme.info}>
          <Text color={theme.info}>Processing media (merging/converting)...</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1} padding={1} borderStyle="round" borderColor={theme.primary}>
          <Box marginBottom={1} flexDirection={isNarrow ? 'column' : 'row'}>
            <ProgressBar percent={pct} width={barWidth} />
            <Box marginLeft={isNarrow ? 0 : 2} marginTop={isNarrow ? 1 : 0}>
              <Text color={theme.primary} bold>{pct.toFixed(1)}%</Text>
            </Box>
          </Box>
          
          <Box flexDirection={isNarrow ? 'column' : 'row'} justifyContent="space-between">
            <Box>
              <Text color={theme.muted}>SPEED: </Text>
              <Text color={theme.text} bold>{speedStr}</Text>
            </Box>
            <Box>
              <Text color={theme.muted}>SIZE: </Text>
              <Text color={theme.text} bold>{fracStr}</Text>
            </Box>
            <Box>
              <Text color={theme.muted}>ETA: </Text>
              <Text color={theme.highlight} bold>{etaStr}</Text>
            </Box>
          </Box>
        </Box>
      )}

      <KeyHint
        keys={[
          { key: 'q', label: 'Cancel' },
        ]}
      />
    </Box>
  );
}
