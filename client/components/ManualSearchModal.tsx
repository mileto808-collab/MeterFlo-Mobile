import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ManualSearchModalProps {
  visible: boolean;
  value: string;
  onClose: () => void;
  onChangeText: (text: string) => void;
  onFindWorkOrder?: (meterId: string) => void;
}

export function ManualSearchModal({ visible, value, onClose, onChangeText, onFindWorkOrder }: ManualSearchModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setLocalValue(value);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, value]);

  const handleApply = () => {
    onChangeText(localValue);
    onClose();
  };

  const handleClear = () => {
    setLocalValue("");
    onChangeText("");
    onClose();
  };

  const handleFindWorkOrder = () => {
    if (localValue.trim() && onFindWorkOrder) {
      onClose();
      onFindWorkOrder(localValue.trim());
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable 
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content, 
            { 
              backgroundColor: theme.backgroundRoot,
              marginTop: insets.top + Spacing.xl,
            }
          ]}
        >
          <View style={styles.header}>
            <ThemedText type="h4">Search Work Orders</ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="search" size={20} color={theme.textSecondary} />
            <TextInput
              ref={inputRef}
              value={localValue}
              onChangeText={setLocalValue}
              placeholder="Search by address, meter ID, etc..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleApply}
            />
            {localValue.length > 0 ? (
              <Pressable
                onPress={() => setLocalValue("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {onFindWorkOrder && localValue.trim().length > 0 ? (
            <Pressable
              onPress={handleFindWorkOrder}
              style={({ pressed }) => [
                styles.findButton,
                { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Icon name="search" size={18} color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
                Search Work Orders
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.buttons}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText>Clear</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText style={{ color: "#FFFFFF" }}>Filter List</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  findButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});
