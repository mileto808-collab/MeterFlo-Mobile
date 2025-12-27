import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { StatusColors, Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: "pending" | "in_progress" | "completed" | "on_hold";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = StatusColors[status] || StatusColors.pending;
  const label = STATUS_LABELS[status] || status;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <ThemedText style={styles.text}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});
