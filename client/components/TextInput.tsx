import React from "react";
import { TextInput as RNTextInput, TextInputProps, StyleSheet, TextStyle, StyleProp } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Props extends TextInputProps {
  style?: StyleProp<TextStyle>;
}

export function TextInput({ style, ...props }: Props) {
  const { theme } = useTheme();

  return (
    <RNTextInput
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.input,
        {
          backgroundColor: theme.backgroundSecondary,
          color: theme.text,
          borderColor: theme.border,
        },
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
