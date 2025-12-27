import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, WithSpringConfig } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Spacing, BorderRadius } from "@/constants/theme";

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onPress: () => void;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function WorkOrderCard({ workOrder, onPress }: WorkOrderCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not scheduled";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const displayAddress = workOrder.serviceAddress || "No address";
  const displayAssignee = workOrder.assignedUserDisplayName || workOrder.assignedUserUsername || "Unassigned";

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.badges}>
          <StatusBadge status={workOrder.status} />
        </View>
        {workOrder.syncPending ? (
          <View style={[styles.syncPending, { backgroundColor: theme.syncPending }]}>
            <Ionicons name="cloud-upload-outline" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <ThemedText type="h4" numberOfLines={2} style={styles.title}>
        {displayAddress}
      </ThemedText>

      <ThemedText type="caption" style={[styles.id, { color: theme.textSecondary }]}>
        {workOrder.customerWoId} - {workOrder.oldMeterId || "No meter ID"}
      </ThemedText>

      {workOrder.customerName ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
          {workOrder.customerName}
        </ThemedText>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {displayAssignee}
          </ThemedText>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(workOrder.scheduledDate)}
          </ThemedText>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  syncPending: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: Spacing.xs,
  },
  id: {},
  footer: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
});
