import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { SelectList } from '../components/ui/SelectList.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import { Badge } from '../components/ui/Badge.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import type { IMediaInfo, IMediaFormat } from '@nazzel/domain/types.js';

export interface FormatSelectionScreenProps {
  mediaInfo: IMediaInfo;
  onSelect: (formatId: string) => void;
  onCancel: () => void;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) {
    return '???';
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function FormatSelectionScreen({ mediaInfo, onSelect, onCancel }: FormatSelectionScreenProps) {
  const { rows } = useTerminalSize();
  
  const items = useMemo(() => {
    const sorted = [...mediaInfo.formats].sort((a, b) => {
      if (!a.isAudioOnly && !a.isVideoOnly && (b.isAudioOnly || b.isVideoOnly)) {
        return -1;
      }
      if (!b.isAudioOnly && !b.isVideoOnly && (a.isAudioOnly || a.isVideoOnly)) {
        return 1;
      }
      return (b.filesize || 0) - (a.filesize || 0);
    });

    const createOption = (f: IMediaFormat | null) => {
      if (!f) {
        return {
          label: 'Best Quality (Auto)',
          value: 'best',
          element: (
            <Box>
              <Badge label="AUTO" bgColor={theme.primary} color={theme.bgDark} bold />
              <Box marginLeft={1}>
                <Text color={theme.text}>Best Quality (Auto-merged)</Text>
              </Box>
            </Box>
          )
        };
      }

      const sizeStr = formatSize(f.filesize).padStart(10);
      const extStr = f.ext.toUpperCase().padEnd(5);
      
      let badgeLabel = 'VIDEO';
      let badgeBg: string = theme.info;
      let resStr = (f.resolution || 'N/A').padEnd(10);

      if (f.isAudioOnly) {
        badgeLabel = 'AUDIO';
        badgeBg = theme.warning;
        resStr = (f.tbr ? `${f.tbr}k` : 'N/A').padEnd(10);
      } else if (f.isVideoOnly) {
        badgeLabel = 'V-ONLY';
        badgeBg = theme.muted;
      }

      return {
        label: f.formatId,
        value: f.formatId,
        element: (
          <Box>
            <Box width={8}>
              <Badge label={badgeLabel} bgColor={badgeBg} color={theme.bgDark} bold />
            </Box>
            <Box marginLeft={1} width={12}>
              <Text color={theme.text}>{resStr}</Text>
            </Box>
            <Box width={7}>
              <Text color={theme.muted}>{extStr}</Text>
            </Box>
            <Box>
              <Text color={theme.highlight}>{sizeStr}</Text>
            </Box>
          </Box>
        )
      };
    };

    return [createOption(null), ...sorted.map(createOption)];
  }, [mediaInfo]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.text} bold>{mediaInfo.title || 'Unknown Title'}</Text>
        <Text color={theme.muted}>Select a format to download ({items.length} options):</Text>
      </Box>

      <Box height={Math.max(5, rows - 10)} flexDirection="column">
        <SelectList
          items={items}
          onSelect={(item) => onSelect(item.value)}
          onCancel={onCancel}
          visibleRows={Math.max(5, rows - 10)}
        />
      </Box>

      <KeyHint
        keys={[
          { key: '↑/↓', label: 'Navigate' },
          { key: 'Enter', label: 'Select' },
          { key: 'Esc', label: 'Cancel' },
        ]}
      />
    </Box>
  );
}
