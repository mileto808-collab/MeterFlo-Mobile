import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high" | "urgent";
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: "#6B7280", label: "Low" },
  medium: { color: "#F59E0B", label: "Medium" },
  high: { color: "#EF4444", label: "High" },
  urgent: { color: "#DC2626", label: "Urgent" },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;

  return (
    <View style={[styles.badge, { backgroundColor: config.color + "20", borderColor: config.color }]}>
      <ThemedText style={[styles.text, { color: config.color }]}>{config.label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
