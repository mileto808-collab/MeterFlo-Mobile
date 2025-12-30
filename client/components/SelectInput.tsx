import React, { useState } from "react";
import { View, Pressable, StyleSheet, Modal, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SelectInputProps {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

export function SelectInput({ value, options, onSelect, placeholder = "Select..." }: SelectInputProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.selector,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <ThemedText
          type="body"
          style={[!value && { color: theme.textSecondary }]}
        >
          {value || placeholder}
        </ThemedText>
        <Icon name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={[
            styles.dropdown,
            {
              backgroundColor: theme.backgroundDefault,
              marginBottom: insets.bottom,
            },
          ]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <ThemedText type="h4">Select Option</ThemedText>
              <Pressable onPress={() => setIsOpen(false)}>
                <Icon name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: item === value ? theme.primary + "15" : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={item === value ? { color: theme.primary } : undefined}
                  >
                    {item}
                  </ThemedText>
                  {item === value ? (
                    <Icon name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    height: Spacing.inputHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dropdown: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
});
