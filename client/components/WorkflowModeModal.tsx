import React from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

export type WorkflowModeChoice = "changeout" | "reading_only";

interface WorkflowModeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: WorkflowModeChoice) => void;
}

interface ModeOptionProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}

function ModeOption({ icon, title, description, onPress }: ModeOptionProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
        <Icon name={icon} size={28} color={theme.primary} />
      </View>
      <View style={styles.optionText}>
        <ThemedText type="body" style={{ fontWeight: "600" }}>{title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {description}
        </ThemedText>
      </View>
      <Icon name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

export function WorkflowModeModal({ visible, onClose, onSelectMode }: WorkflowModeModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSelect = (mode: WorkflowModeChoice) => {
    onClose();
    onSelectMode(mode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable 
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content, 
            { 
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            }
          ]}
        >
          <View style={styles.handle} />
          
          <ThemedText type="h4" style={styles.title}>
            What would you like to do?
          </ThemedText>

          <View style={styles.options}>
            <ModeOption
              icon="refresh-cw"
              title="Complete Changeout"
              description="Replace meter and capture new equipment information"
              onPress={() => handleSelect("changeout")}
            />
            <ModeOption
              icon="edit-3"
              title="Capture Reading Only"
              description="Record current meter reading without equipment change"
              onPress={() => handleSelect("reading_only")}
            />
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText type="body">Cancel</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  options: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  cancelButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
});
