import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, WithSpringConfig } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { WorkOrder, useWorkOrders } from "@/contexts/WorkOrderContext";
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
  const { getStatusColor } = useWorkOrders();
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
          <StatusBadge status={workOrder.status} color={getStatusColor(workOrder.status)} size="medium" />
        </View>
        {workOrder.syncPending ? (
          <View style={[styles.syncPending, { backgroundColor: theme.syncPending }]}>
            <Feather name="upload-cloud" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <ThemedText type="h4" numberOfLines={2} style={styles.title}>
        {displayAddress}
      </ThemedText>

      <View style={styles.idRow}>
        <ThemedText type="body" style={[styles.idLabel, { color: theme.text }]}>
          WO: {workOrder.customerWoId}
        </ThemedText>
        <ThemedText type="body" style={[styles.idLabel, { color: theme.text }]}>
          Meter: {workOrder.status?.toLowerCase() === "completed" 
            ? (workOrder.newMeterId || workOrder.oldMeterId || "N/A")
            : (workOrder.oldMeterId || "N/A")}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Feather name="user" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {displayAssignee}
          </ThemedText>
        </View>
        <View style={styles.footerItem}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
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
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: Spacing.xs,
  },
  idRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  idLabel: {
    fontWeight: "600",
  },
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
