import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { Layout } from '../components/ui/Layout.js';
import type { IDependencyReport } from '@nazzel/domain/types.js';

interface RepairScreenProps {
  report: IDependencyReport;
  progress: { name: string; downloaded: number; total: number | undefined } | null;
  onConfirm: () => void;
  onQuit: () => void;
}

export function RepairScreen({ report, progress, onConfirm, onQuit }: RepairScreenProps) {
  const [isRepairing, setIsRepairing] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (isRepairing) {
      return;
    }
    if (key.return) {
      setIsRepairing(true);
      onConfirm();
    }
    if (input === 'q') {
      onQuit();
      exit();
    }
  });

  const missing = [...report.missingCritical, ...report.outdated];

  return (
    <Layout title="SYSTEM REPAIR" subtitle="Missing Dependencies">
      <Box
        flexDirection="column"
        gap={1}
        padding={2}
        marginY={1}
        borderStyle="round"
        borderColor="yellow"
      >
        <Box>
          <Text color="yellow" bold>
            ⚠ Dependencies Missing or Outdated
          </Text>
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          {report.deps
            .filter((d) => missing.includes(d.name))
            .map((d) => (
              <Text key={d.name}>
                • {d.name} <Text color="gray">({d.status})</Text>
              </Text>
            ))}
        </Box>

        {!isRepairing ? (
          <Box marginTop={1}>
            <Text>Nazzel needs to install these dependencies to function.</Text>
          </Box>
        ) : null}

        {!isRepairing ? (
          <Box marginTop={1} gap={2}>
            <Text color="cyan" bold>
              [Enter] Install automatically
            </Text>
            <Text color="gray">[q] Quit</Text>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column" gap={1}>
            <Box gap={1}>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text>Installing dependencies...</Text>
            </Box>
            {progress && (
              <Box marginLeft={2}>
                <Text color="gray">Downloading {progress.name}: </Text>
                <Text>
                  {progress.total
                    ? `${Math.round((progress.downloaded / progress.total) * 100)}%`
                    : `${Math.round(progress.downloaded / 1024 / 1024)} MB`}
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Layout>
  );
}
