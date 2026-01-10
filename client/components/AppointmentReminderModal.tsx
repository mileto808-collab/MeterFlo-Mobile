import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";

export type ReminderType = "1hour" | "30min" | "15min" | "missed";

interface AppointmentReminderModalProps {
  visible: boolean;
  reminderType: ReminderType;
  workOrderId: string;
  customerWoId?: string;
  serviceAddress: string;
  scheduledDate: string;
  onDismiss: () => void;
  onViewWorkOrder: () => void;
}

const REMINDER_CONFIG: Record<ReminderType, { title: string; icon: "clock" | "alert-circle"; color: "warning" | "error" }> = {
  "1hour": { title: "Appointment in 1 Hour", icon: "clock", color: "warning" },
  "30min": { title: "Appointment in 30 Minutes", icon: "clock", color: "warning" },
  "15min": { title: "Appointment in 15 Minutes", icon: "alert-circle", color: "warning" },
  "missed": { title: "Missed Appointment", icon: "alert-circle", color: "error" },
};

export function AppointmentReminderModal({
  visible,
  reminderType,
  workOrderId,
  customerWoId,
  serviceAddress,
  scheduledDate,
  onDismiss,
  onViewWorkOrder,
}: AppointmentReminderModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const config = REMINDER_CONFIG[reminderType];
  const iconColor = config.color === "error" ? theme.error : theme.warning;
  
  const formatScheduledTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
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
          <Icon name={config.icon} size={56} color={iconColor} />
          
          <ThemedText type="h4" style={styles.title}>
            {config.title}
          </ThemedText>
          
          <View style={[styles.detailsBox, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Work Order
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {customerWoId || workOrderId}
              </ThemedText>
            </View>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Address
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {serviceAddress}
              </ThemedText>
            </View>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            <View style={styles.detailRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Scheduled Time
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600", color: iconColor }}>
                {formatScheduledTime(scheduledDate)}
              </ThemedText>
            </View>
          </View>
          
          {reminderType === "missed" && (
            <ThemedText type="small" style={[styles.missedText, { color: theme.error }]}>
              This appointment time has passed. Please reschedule or contact the customer.
            </ThemedText>
          )}
          
          <View style={styles.buttonRow}>
            <Button
              onPress={onDismiss}
              style={[styles.button, { backgroundColor: theme.backgroundSecondary }]}
            >
              Dismiss
            </Button>
            <Button
              onPress={onViewWorkOrder}
              style={styles.button}
            >
              View
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  title: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  detailsBox: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  detailRow: {
    paddingVertical: Spacing.sm,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  missedText: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
    width: "100%",
  },
  button: {
    flex: 1,
  },
});
