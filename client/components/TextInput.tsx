import React, { useState, useCallback } from "react";
import { TextInput as RNTextInput, TextInputProps, StyleSheet, TextStyle, StyleProp, NativeSyntheticEvent, TextInputContentSizeChangeEventData } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Props extends TextInputProps {
  style?: StyleProp<TextStyle>;
  autoExpand?: boolean;
}

export function TextInput({ style, multiline, autoExpand = true, onContentSizeChange, ...props }: Props) {
  const { theme } = useTheme();
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  const handleContentSizeChange = useCallback((e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    if (multiline && autoExpand) {
      setContentHeight(e.nativeEvent.contentSize.height);
    }
    onContentSizeChange?.(e);
  }, [multiline, autoExpand, onContentSizeChange]);

  const multilineStyles = multiline ? {
    height: undefined,
    minHeight: autoExpand && contentHeight ? Math.max(80, contentHeight + Spacing.lg) : 80,
    paddingVertical: Spacing.md,
    textAlignVertical: "top" as const,
  } : {};

  return (
    <RNTextInput
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      onContentSizeChange={handleContentSizeChange}
      style={[
        styles.input,
        {
          backgroundColor: theme.backgroundSecondary,
          color: theme.text,
          borderColor: theme.border,
        },
        multilineStyles,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    fontSize: 16,
    borderWidth: 1,
  },
});
