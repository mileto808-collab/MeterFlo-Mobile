import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label?: string;
}

export function Checkbox({ checked, onToggle, label }: CheckboxProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.container,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[
        styles.checkbox,
        {
          backgroundColor: checked ? theme.primary : "transparent",
          borderColor: checked ? theme.primary : theme.border,
        },
      ]}>
        {checked ? (
          <Icon name="check" size={16} color="#FFFFFF" />
        ) : null}
      </View>
      {label ? (
        <ThemedText type="body">{label}</ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
