import React, { useRef } from "react";
import { View, TextInput, StyleSheet, Pressable, TextInput as RNTextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSearchPress?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = "Search...", onSearchPress }: SearchBarProps) {
  const { theme } = useTheme();
  const inputRef = useRef<RNTextInput>(null);

  if (onSearchPress) {
    return (
      <Pressable 
        onPress={onSearchPress}
        style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}
      >
        <Feather name="search" size={18} color={theme.textSecondary} />
        {value.length > 0 ? (
          <>
            <ThemedText style={[styles.valueText, { color: theme.text }]} numberOfLines={1}>
              {value}
            </ThemedText>
            <Pressable
              onPress={() => onChangeText("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          </>
        ) : (
          <ThemedText style={[styles.valueText, { color: theme.textSecondary }]}>
            {placeholder}
          </ThemedText>
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <Feather name="search" size={18} color={theme.textSecondary} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  valueText: {
    flex: 1,
    fontSize: 16,
  },
});
