import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';

export interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  hideBorder?: boolean;
}

export function Layout({ children, title = 'NAZZEL', subtitle = 'Media Downloader', footer, hideBorder = false }: LayoutProps) {
  const { columns, rows } = useTerminalSize();

  return (
    <Box 
      flexDirection="column" 
      width={columns} 
      minHeight={rows} 
      padding={hideBorder ? 0 : 1}
      borderStyle={hideBorder ? undefined : 'round'}
      borderColor={theme.primary}
    >
      {/* Header */}
      <Box marginBottom={1} borderBottom={!hideBorder} borderStyle="single" borderColor={theme.muted} paddingBottom={hideBorder ? 0 : 1}>
        <Text color={theme.primary} bold>{title}</Text>
        {subtitle && <Text color={theme.muted}> - {subtitle}</Text>}
      </Box>

      {/* Body */}
      <Box flexGrow={1} flexDirection="column">
        {children}
      </Box>

      {/* Footer */}
      {footer && (
        <Box marginTop={1} borderTop={!hideBorder} borderStyle="single" borderColor={theme.muted} paddingTop={hideBorder ? 0 : 1}>
          {footer}
        </Box>
      )}
    </Box>
  );
}
