import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // We could log errorInfo to a file if needed
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.error}>
          <Text color={theme.error} bold>
            TUI Critical Failure
          </Text>
          <Box marginY={1}>
            <Text color={theme.text}>An unexpected render error occurred in the terminal UI.</Text>
          </Box>
          <Box>
            <Text color={theme.muted}>{this.state.error?.message || 'Unknown error'}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text}>
              Press <Text bold>Ctrl+C</Text> to quit, or check logs for details.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
