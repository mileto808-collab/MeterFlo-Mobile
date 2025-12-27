import React from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, StatusBadgeColors, Colors } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
}

type StatusKey = "Open" | "Scheduled" | "In Progress" | "Completed" | "Cancelled" | "Trouble";

const normalizeStatus = (status: string): StatusKey | null => {
  const normalized = status.toLowerCase().replace(/_/g, " ").trim();
  
  switch (normalized) {
    case "open":
    case "pending":
      return "Open";
    case "scheduled":
      return "Scheduled";
    case "in progress":
    case "in_progress":
      return "In Progress";
    case "completed":
    case "complete":
      return "Completed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "trouble":
    case "on hold":
    case "on_hold":
      return "Trouble";
    default:
      return null;
  }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const statusKey = normalizeStatus(status);
  
  // Use neutral fallback for unknown statuses
  const colors = statusKey 
    ? (isDark ? StatusBadgeColors.dark[statusKey] : StatusBadgeColors.light[statusKey])
    : {
        bg: "transparent",
        border: isDark ? Colors.dark.border : Colors.light.border,
        text: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary,
      };

  const hasBorder = colors.border !== "transparent";

  return (
    <View 
      style={[
        styles.badge, 
        { 
          backgroundColor: colors.bg,
          borderColor: hasBorder ? colors.border : "transparent",
          borderWidth: hasBorder ? 1 : 0,
        }
      ]}
    >
      <ThemedText style={[styles.text, { color: colors.text }]}>{status}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
});
