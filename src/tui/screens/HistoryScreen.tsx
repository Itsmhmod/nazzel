import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Layout } from '../components/ui/Layout.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import type { IHistoryManager } from '../../application/interfaces/IHistoryManager.js';
import type { IHistoryEntry } from '../../domain/types.js';

export interface HistoryScreenProps {
  historyManager: IHistoryManager;
  onClose: () => void;
}

export function HistoryScreen({ historyManager, onClose }: HistoryScreenProps) {
  const [records, setRecords] = useState<IHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { columns, rows } = useTerminalSize();

  // For scrolling
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    historyManager
      .readAll()
      .then((data) => {
        // Sort newest first
        const sorted = data.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setRecords(sorted);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load history');
        setLoading(false);
      });
  }, [historyManager]);

  const pageSize = Math.max(5, rows - 10);
  const maxOffset = Math.max(0, records.length - pageSize);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'h') {
      onClose();
    } else if (key.upArrow || input === 'k') {
      setOffset((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setOffset((prev) => Math.min(maxOffset, prev + 1));
    } else if (key.pageDown) {
      setOffset((prev) => Math.min(maxOffset, prev + pageSize));
    } else if (key.pageUp) {
      setOffset((prev) => Math.max(0, prev - pageSize));
    }
  });

  const visibleRecords = records.slice(offset, offset + pageSize);

  return (
    <Layout
      title="HISTORY"
      subtitle="Past Downloads"
      footer={
        <KeyHint
          keys={[
            { key: '↑/↓', label: 'Scroll' },
            { key: 'Esc/q', label: 'Close' },
          ]}
        />
      }
    >
      <Box flexDirection="column" paddingX={2} marginY={1}>
        <Box marginBottom={1} justifyContent="space-between">
          <Text color={theme.primary} bold>
            Download History
          </Text>
          <Text color={theme.muted}>
            {records.length > 0
              ? `${offset + 1}-${Math.min(offset + pageSize, records.length)} of ${records.length}`
              : ''}
          </Text>
        </Box>

        {loading && (
          <Box paddingY={1}>
            <Text color={theme.info}>Loading history...</Text>
          </Box>
        )}

        {error && (
          <Box paddingY={1}>
            <Text color={theme.error}>Error: {error}</Text>
          </Box>
        )}

        {!loading && !error && records.length === 0 && (
          <Box paddingY={1}>
            <Text color={theme.muted}>No downloads found in history.</Text>
          </Box>
        )}

        {!loading && !error && records.length > 0 && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold color={theme.muted}>
                {'DATE'.padEnd(12)} {'STATUS'.padEnd(10)} {'TITLE'}
              </Text>
            </Box>
            {visibleRecords.map((r, i) => {
              const dateStr = new Date(r.timestamp).toLocaleDateString();
              const statusColor =
                r.status === 'completed'
                  ? theme.success
                  : r.status === 'failed'
                    ? theme.error
                    : theme.warning;

              // Truncate title
              const titleWidth = Math.max(10, columns - 32);
              let titleStr = r.title || r.url || 'Unknown';
              if (titleStr.length > titleWidth) {
                titleStr = titleStr.slice(0, titleWidth - 3) + '...';
              }

              return (
                <Box key={r.id || i} marginBottom={1}>
                  <Text>
                    <Text color={theme.muted}>{dateStr.padEnd(12)} </Text>
                    <Text color={statusColor}>{r.status.padEnd(10)} </Text>
                    <Text color={theme.text}>{titleStr}</Text>
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Layout>
  );
}
