import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../../theme.js';

export interface SelectItem<T> {
  label: string;
  value: T;
}

export interface SelectListProps<T> {
  items: SelectItem<T>[];
  onSelect: (item: SelectItem<T>) => void;
  onCancel?: () => void;
}

export function SelectList<T>({ items, onSelect, onCancel }: SelectListProps<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

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
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={index}>
            <Box width={2}>
              <Text color={isSelected ? theme.highlight : theme.muted}>
                {isSelected ? '❯ ' : '  '}
              </Text>
            </Box>
            <Text color={isSelected ? theme.highlight : theme.text}>
              {item.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
