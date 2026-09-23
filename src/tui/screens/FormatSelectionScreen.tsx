import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { SelectList } from '../components/ui/SelectList.js';
import { KeyHint } from '../components/ui/KeyHint.js';
import type { IMediaInfo, IMediaFormat } from '@nazzel/domain/types.js';

export interface FormatSelectionScreenProps {
  mediaInfo: IMediaInfo;
  onSelect: (formatId: string) => void;
  onCancel: () => void;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) {
    return 'Unknown size';
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatLabel(f: IMediaFormat): string {
  const size = formatSize(f.filesize);
  if (f.isAudioOnly) {
    return `[Audio] ${f.ext.toUpperCase()} - ${f.tbr ? f.tbr + 'k ' : ''}${size}`;
  }
  if (f.isVideoOnly) {
    return `[${f.resolution || 'Video'}] ${f.ext.toUpperCase()} (Video Only) - ${size}`;
  }
  return `[${f.resolution || 'Video'}] ${f.ext.toUpperCase()} - ${size}`;
}

export function FormatSelectionScreen({ mediaInfo, onSelect, onCancel }: FormatSelectionScreenProps) {
  const items = useMemo(() => {
    // Basic sort: Best video+audio, then Video, then Audio
    const sorted = [...mediaInfo.formats].sort((a, b) => {
      // Very naive sort for UX demo. Usually, we'd rank by resolution or filesize.
      if (!a.isAudioOnly && !a.isVideoOnly && (b.isAudioOnly || b.isVideoOnly)) {
        return -1;
      }
      if (!b.isAudioOnly && !b.isVideoOnly && (a.isAudioOnly || a.isVideoOnly)) {
        return 1;
      }
      
      const sizeA = a.filesize || 0;
      const sizeB = b.filesize || 0;
      return sizeB - sizeA;
    });

    // Add a "Best Quality (Default)" option at the top
    const options = [
      { label: 'Best Quality (Auto)', value: 'best' },
      ...sorted.map((f) => ({
        label: formatLabel(f),
        value: f.formatId,
      }))
    ];

    // Limit to top 15 so we don't overflow small terminals
    return options.slice(0, 15);
  }, [mediaInfo]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.text} bold>{mediaInfo.title || 'Unknown Title'}</Text>
        <Text color={theme.muted}>Select a format to download:</Text>
      </Box>

      <SelectList
        items={items}
        onSelect={(item) => onSelect(item.value)}
        onCancel={onCancel}
      />

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
