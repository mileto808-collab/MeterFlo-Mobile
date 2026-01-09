import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput, Modal, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

interface HIDScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

export function HIDScannerModal({ visible, onClose, onScan }: HIDScannerModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setValue("");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, [visible]);

  const handleChangeText = (text: string) => {
    const now = Date.now();
    setValue(text);
    setLastKeyTime(now);

    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    submitTimeoutRef.current = setTimeout(() => {
      if (text.length >= 3) {
        handleSubmit(text);
      }
    }, 300);
  };

  const handleSubmit = (submittedValue?: string) => {
    const finalValue = (submittedValue || value).trim();
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    if (finalValue.length < 1) {
      Alert.alert("Invalid Input", "Please scan or enter a meter ID");
      return;
    }
    onClose();
    onScan(finalValue);
    setValue("");
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === "Enter") {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
      handleSubmit();
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
              marginBottom: insets.bottom + Spacing.lg,
            }
          ]}
        >
          <View style={styles.header}>
            <ThemedText type="h4">HID Scanner Input</ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.scannerIcon, { backgroundColor: theme.primary + "20" }]}>
            <Icon name="bluetooth" size={48} color={theme.primary} />
          </View>

          <ThemedText type="body" style={[styles.instructions, { color: theme.textSecondary }]}>
            Point your external barcode scanner at a system or module barcode. The scanned value will appear below.
          </ThemedText>

          <View style={[styles.inputContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={handleChangeText}
              onKeyPress={handleKeyPress}
              placeholder="Waiting for scan..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => handleSubmit()}
            />
            {value.length > 0 ? (
              <Icon name="check-circle" size={20} color={theme.success} />
            ) : null}
          </View>

          {value.length > 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Press Enter or wait to submit
            </ThemedText>
          ) : null}

          <View style={styles.buttons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <ThemedText>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleSubmit()}
              style={({ pressed }) => [
                styles.button,
                styles.submitButton,
                { 
                  backgroundColor: value.length > 0 ? theme.primary : theme.backgroundTertiary, 
                  opacity: pressed ? 0.7 : 1 
                },
              ]}
            >
              <ThemedText style={{ color: value.length > 0 ? "#FFFFFF" : theme.textSecondary }}>
                Find Work Order
              </ThemedText>
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
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  scannerIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  instructions: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
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
  submitButton: {
  },
});
