import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Spinner } from '../components/ui/Spinner.js';
import type { DiagnosticsRunner, IDiagnosticsReport } from '@nazzel/application/DiagnosticsRunner.js';

export interface DiagnosticsScreenProps {
  runner: DiagnosticsRunner;
  onClose: () => void;
}

export function DiagnosticsScreen({ runner, onClose }: DiagnosticsScreenProps) {
  const [report, setReport] = useState<IDiagnosticsReport | null>(null);

  useEffect(() => {
    runner.run().then(setReport).catch(() => {
      // In a real app we'd handle error state here
    });
  }, [runner]);

  useInput((input, key) => {
    if (key.escape || input === 'd' || input === 'q') {
      onClose();
    }
  });

  if (!report) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Spinner />
          <Text color={theme.info}> Running system diagnostics...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="round" borderColor={report.dependencies.allOk ? theme.success : theme.error}>
      <Box marginBottom={1}>
        <Text bold color={theme.text}>System Diagnostics</Text>
      </Box>

      {report.dependencies.deps.map((dep) => {
        let statusColor: string = theme.success;
        if (dep.status === 'missing') {
          statusColor = theme.error;
        }
        if (dep.status === 'outdated') {
          statusColor = theme.warning;
        }
        if (dep.status === 'unknown') {
          statusColor = theme.muted;
        }

        return (
          <Box key={dep.name} flexDirection="column" marginBottom={1}>
            <Box>
              <Box width={15}>
                <Text bold>{dep.name}</Text>
              </Box>
              <Text color={statusColor}>[{dep.status.toUpperCase()}]</Text>
            </Box>
            <Box marginLeft={2}>
              {dep.version && <Text color={theme.muted}>Version: {dep.version}</Text>}
              {dep.path && <Text color={theme.muted}> Path: {dep.path}</Text>}
              {dep.reason && <Text color={theme.warning}> Note: {dep.reason}</Text>}
            </Box>
          </Box>
        );
      })}

      <KeyHint
        keys={[
          { key: 'Esc/d', label: 'Close' },
        ]}
      />
    </Box>
  );
}
