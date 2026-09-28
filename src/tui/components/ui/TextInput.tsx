import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme.js';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: ((value: string) => void) | undefined;
  placeholder?: string;
  width?: number;
}

export function TextInput({ value, onChange, onSubmit, placeholder = 'Type here...', width = 50 }: TextInputProps) {
  const [cursorOffset, setCursorOffset] = useState(0); // Offset from the right end (0 = end)

  useInput((input, key) => {
    if (key.return) {
      if (onSubmit) { onSubmit(value); }
    } else if (key.backspace || key.delete) {
      if (value.length > 0 && cursorOffset < value.length) {
        const newValue = value.slice(0, value.length - cursorOffset - 1) + value.slice(value.length - cursorOffset);
        onChange(newValue);
      }
    } else if (key.leftArrow) {
      setCursorOffset((prev) => Math.min(value.length, prev + 1));
    } else if (key.rightArrow) {
      setCursorOffset((prev) => Math.max(0, prev - 1));
    } else if (key.ctrl && input === 'a') {
      setCursorOffset(value.length);
    } else if (key.ctrl && input === 'e') {
      setCursorOffset(0);
    } else if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow) {
      const newValue = value.slice(0, value.length - cursorOffset) + input + value.slice(value.length - cursorOffset);
      onChange(newValue);
    }
  });

  const isPlaceholder = value.length === 0;

  // Render logic to support cursor
  const cursorIndex = value.length - cursorOffset;
  const beforeCursor = value.slice(0, cursorIndex);
  const atCursor = value.slice(cursorIndex, cursorIndex + 1) || ' ';
  const afterCursor = value.slice(cursorIndex + 1);

  return (
    <Box borderStyle="single" borderColor={theme.muted} paddingX={1} width={width}>
      {isPlaceholder ? (
        <Text color={theme.bgLight}>{placeholder}</Text>
      ) : (
        <Text>
          {beforeCursor}
          <Text backgroundColor={theme.text} color={theme.bgDark}>{atCursor}</Text>
          {afterCursor}
        </Text>
      )}
    </Box>
  );
}
