import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, WithSpringConfig } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const completedSteps = workOrder.workflowSteps.filter(s => s.completed).length;
  const totalSteps = workOrder.workflowSteps.length;

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
          <PriorityBadge priority={workOrder.priority} />
        </View>
        {workOrder.syncPending ? (
          <View style={[styles.syncPending, { backgroundColor: theme.syncPending }]}>
            <Feather name="upload-cloud" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <ThemedText type="h4" numberOfLines={2} style={styles.title}>
        {workOrder.title}
      </ThemedText>

      <ThemedText type="caption" style={[styles.id, { color: theme.textSecondary }]}>
        {workOrder.id}
      </ThemedText>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Feather name="user" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {workOrder.assignedTo}
          </ThemedText>
        </View>
        <View style={styles.footerItem}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(workOrder.dueDate)}
          </ThemedText>
        </View>
      </View>

      {totalSteps > 0 ? (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(completedSteps / totalSteps) * 100}%`,
                  backgroundColor: completedSteps === totalSteps ? theme.success : theme.primary,
                },
              ]}
            />
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {completedSteps}/{totalSteps}
          </ThemedText>
        </View>
      ) : null}
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
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
