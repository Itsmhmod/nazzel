import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme.js';

export interface SelectItem<T> {
  label: string;
  element?: React.ReactNode;
  value: T;
}

export interface SelectListProps<T> {
  items: SelectItem<T>[];
  onSelect: (item: SelectItem<T>) => void;
  onCancel?: () => void;
  visibleRows?: number;
}

export function SelectList<T>({ items, onSelect, onCancel, visibleRows }: SelectListProps<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  
  // Calculate window based on selectedIndex
  let startIdx = 0;
  let endIdx = items.length;
  
  if (visibleRows && visibleRows > 0) {
    if (items.length > visibleRows) {
      // Keep selectedIndex in the middle if possible
      const half = Math.floor(visibleRows / 2);
      startIdx = Math.max(0, selectedIndex - half);
      endIdx = startIdx + visibleRows;
      
      if (endIdx > items.length) {
        endIdx = items.length;
        startIdx = Math.max(0, endIdx - visibleRows);
      }
    }
  }
  
  const visibleItems = items.slice(startIdx, endIdx);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
    } else if (key.return) {
      const selected = items[selectedIndex];
      if (selected) {
        onSelect(selected);
      }
    } else if (key.escape && onCancel) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, localIndex) => {
        const globalIndex = startIdx + localIndex;
        const isSelected = globalIndex === selectedIndex;
        return (
          <Box key={globalIndex}>
            <Box width={2}>
              <Text color={isSelected ? theme.highlight : theme.muted}>
                {isSelected ? '❯ ' : '  '}
              </Text>
            </Box>
            <Box>
              {item.element ? item.element : (
                <Text color={isSelected ? theme.highlight : theme.text}>
                  {item.label}
                </Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
