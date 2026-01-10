import React from "react";
import { Modal, View, StyleSheet, Pressable } from "react-native";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { Icon } from "./Icons";
import { Button } from "./Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { ReminderType, AppointmentReminder } from "@/contexts/AppointmentReminderContext";

export type { ReminderType, AppointmentReminder };

interface AppointmentReminderModalProps {
  visible: boolean;
  reminder: AppointmentReminder | null;
  onDismiss: () => void;
  onViewWorkOrder: (workOrder: WorkOrder) => void;
}

const REMINDER_CONFIG: Record<ReminderType, { title: string; icon: "clock" | "alert-circle"; color: "warning" | "error" }> = {
  "1hour": { title: "Appointment in 1 Hour", icon: "clock", color: "warning" },
  "30min": { title: "Appointment in 30 Minutes", icon: "clock", color: "warning" },
  "15min": { title: "Appointment in 15 Minutes", icon: "alert-circle", color: "warning" },
  "missed": { title: "Missed Appointment", icon: "alert-circle", color: "error" },
};

export function AppointmentReminderModal({
  visible,
  reminder,
  onDismiss,
  onViewWorkOrder,
}: AppointmentReminderModalProps) {
  const { theme } = useTheme();

  if (!reminder) return null;

  const config = REMINDER_CONFIG[reminder.reminderType];
  const accentColor = config.color === "error" ? theme.error : theme.warning;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  };

  const handleViewWorkOrder = () => {
    onViewWorkOrder(reminder.workOrder);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.container, { borderColor: theme.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: accentColor + "20" }]}>
            <Icon name={config.icon} size={32} color={accentColor} />
          </View>

          <ThemedText type="h3" style={styles.title}>
            {config.title}
          </ThemedText>

          <View style={[styles.detailsCard, { backgroundColor: theme.backgroundTertiary }]}>
            <View style={styles.detailRow}>
              <Icon name="briefcase" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={styles.detailText}>
                {reminder.workOrder.customerWoId || `WO #${reminder.workOrder.id}`}
              </ThemedText>
            </View>

            {reminder.workOrder.serviceAddress ? (
              <View style={styles.detailRow}>
                <Icon name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={styles.detailText} numberOfLines={2}>
                  {reminder.workOrder.serviceAddress}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Icon name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={styles.detailText}>
                {formatDate(reminder.scheduledDate)} at {formatTime(reminder.scheduledDate)}
              </ThemedText>
            </View>

            {reminder.workOrder.customerName ? (
              <View style={styles.detailRow}>
                <Icon name="user" size={16} color={theme.textSecondary} />
                <ThemedText type="body" style={styles.detailText}>
                  {reminder.workOrder.customerName}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.buttonRow}>
            <Pressable 
              style={[styles.secondaryButton, { borderColor: theme.border }]} 
              onPress={onDismiss}
            >
              <ThemedText type="body" style={{ fontWeight: "600" }}>Dismiss</ThemedText>
            </Pressable>
            <View style={styles.buttonWrapper}>
              <Button onPress={handleViewWorkOrder}>View</Button>
            </View>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  detailsCard: {
    width: "100%",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  detailText: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  buttonWrapper: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
