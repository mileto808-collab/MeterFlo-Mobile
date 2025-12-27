import React, { useMemo } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteProps = RouteProp<RootStackParamList, "WorkOrderDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { workOrders } = useWorkOrders();

  const workOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === route.params.workOrder.id) || route.params.workOrder;
  }, [workOrders, route.params.workOrder]);

  const completedSteps = workOrder.workflowSteps.filter(s => s.completed).length;
  const totalSteps = workOrder.workflowSteps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const handleStartWorkflow = () => {
    navigation.navigate("WorkflowWizard", { workOrder });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["5xl"] + 60 },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <StatusBadge status={workOrder.status} />
            <PriorityBadge priority={workOrder.priority} />
          </View>
          <ThemedText type="h3" style={styles.title}>{workOrder.title}</ThemedText>
          <ThemedText type="small" style={[styles.id, { color: theme.textSecondary }]}>
            {workOrder.id}
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Details</ThemedText>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Feather name="user" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Assigned To</ThemedText>
                <ThemedText type="body">{workOrder.assignedTo}</ThemedText>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Due Date</ThemedText>
                <ThemedText type="body">{formatDate(workOrder.dueDate)}</ThemedText>
              </View>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={[styles.detailItem, { flex: 1 }]}>
              <Feather name="map-pin" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Location</ThemedText>
                <ThemedText type="body">{workOrder.location}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Description</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {workOrder.description}
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.workflowHeader}>
            <ThemedText type="h4" style={styles.sectionTitle}>Workflow Progress</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {completedSteps}/{totalSteps} steps
            </ThemedText>
          </View>
          
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${progressPercent}%`,
                  backgroundColor: theme.success,
                }
              ]} 
            />
          </View>

          <View style={styles.stepsList}>
            {workOrder.workflowSteps.map((step, index) => (
              <View key={step.id} style={styles.stepItem}>
                <View style={[
                  styles.stepIndicator,
                  { 
                    backgroundColor: step.completed ? theme.success : theme.border,
                    borderColor: step.completed ? theme.success : theme.border,
                  }
                ]}>
                  {step.completed ? (
                    <Feather name="check" size={12} color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.stepNumber}>{index + 1}</ThemedText>
                  )}
                </View>
                <ThemedText 
                  type="body" 
                  style={[
                    styles.stepName,
                    step.completed && { color: theme.textSecondary }
                  ]}
                >
                  {step.name}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {workOrder.notes.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>Notes</ThemedText>
            {workOrder.notes.map((note, index) => (
              <View key={index} style={styles.noteItem}>
                <Feather name="message-circle" size={14} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1 }}>
                  {note}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Timestamps</ThemedText>
          <View style={styles.timestampRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Created: {formatDate(workOrder.createdAt)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Updated: {formatDate(workOrder.updatedAt)}
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      <View style={[
        styles.bottomAction,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: insets.bottom + Spacing.lg,
        }
      ]}>
        <Button
          onPress={handleStartWorkflow}
          style={{ backgroundColor: theme.primary }}
          disabled={workOrder.status === "completed"}
        >
          {workOrder.status === "completed" ? "Completed" : "Process Work Order"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  title: {
    marginTop: Spacing.sm,
  },
  id: {},
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    flex: 1,
  },
  detailContent: {
    gap: 2,
  },
  workflowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  stepsList: {
    gap: Spacing.md,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: "600",
  },
  stepName: {},
  noteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  timestampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
