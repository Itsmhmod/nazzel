/**
 * @fileoverview Theme tokens for the Nazzel TUI.
 *
 * Provides a centralized set of semantic colors for Ink components.
 */

export const theme = {
  primary: '#00D1FF',   // Cyan / Blue branding
  success: '#10B981',   // Green
  error: '#EF4444',     // Red
  warning: '#F59E0B',   // Yellow
  info: '#3B82F6',      // Blue
  muted: '#6B7280',     // Gray for hints and empty states
  text: '#F3F4F6',      // Default bright text
  highlight: '#FCD34D', // Highlighted selections
  bgDark: '#111827',    // Dark background if needed
  bgLight: '#1F2937',   // Lighter background
} as const;
