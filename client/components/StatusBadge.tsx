import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
}

const getStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, "_");
  
  switch (normalizedStatus) {
    case "open":
    case "pending":
      return "#3B82F6";
    case "in_progress":
    case "in progress":
      return "#F59E0B";
    case "completed":
    case "complete":
      return "#10B981";
    case "trouble":
    case "on_hold":
    case "on hold":
      return "#EF4444";
    case "scheduled":
      return "#8B5CF6";
    default:
      return "#6B7280";
  }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = getStatusColor(status);

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <ThemedText style={styles.text}>{status}</ThemedText>
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
