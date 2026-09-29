import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Spinner } from '../components/ui/Spinner.js';
import { Layout } from '../components/ui/Layout.js';
import type {
  IDiagnosticsRunner,
  IDiagnosticsReport,
} from '../../application/interfaces/IDiagnosticsRunner.js';

export interface DiagnosticsScreenProps {
  runner: IDiagnosticsRunner;
  onClose: () => void;
}

export function DiagnosticsScreen({ runner, onClose }: DiagnosticsScreenProps) {
  const [report, setReport] = useState<IDiagnosticsReport | null>(null);

  useEffect(() => {
    runner
      .run()
      .then(setReport)
      .catch(() => {
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
    <Layout
      title="DIAGNOSTICS"
      subtitle="System Health"
      footer={<KeyHint keys={[{ key: 'Esc/d', label: 'Close' }]} />}
    >
      <Box flexDirection="column" paddingX={2} marginY={1}>
        <Box
          marginBottom={1}
          borderStyle="single"
          borderColor={report.dependencies.allOk ? theme.success : theme.error}
          padding={1}
        >
          <Text bold color={theme.text}>
            Overall Health:{' '}
          </Text>
          <Text color={report.dependencies.allOk ? theme.success : theme.error}>
            {report.dependencies.allOk ? 'OK' : 'ISSUES DETECTED'}
          </Text>
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
      </Box>
    </Layout>
  );
}
