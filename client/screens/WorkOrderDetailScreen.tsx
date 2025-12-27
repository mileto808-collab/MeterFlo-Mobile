import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteProps = RouteProp<RootStackParamList, "WorkOrderDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkOrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { workOrders, claimWorkOrder } = useWorkOrders();
  const { user } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);

  const workOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === route.params.workOrder.id) || route.params.workOrder;
  }, [workOrders, route.params.workOrder]);

  const isAssignedToMe = workOrder.assignedUserId === user?.id;
  const canClaim = !workOrder.assignedUserId || !isAssignedToMe;
  const isCompleted = workOrder.status.toLowerCase() === "completed";

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const handleClaim = async () => {
    const doClaim = async () => {
      setIsClaiming(true);
      try {
        await claimWorkOrder(workOrder.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to claim work order";
        if (Platform.OS === "web") {
          alert(message);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        setIsClaiming(false);
      }
    };

    if (Platform.OS === "web") {
      doClaim();
    } else {
      Alert.alert(
        "Claim Work Order",
        "Assign this work order to yourself?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Claim", onPress: doClaim },
        ]
      );
    }
  };

  const handleProcess = () => {
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
            {workOrder.syncPending ? (
              <View style={[styles.syncBadge, { backgroundColor: theme.warning }]}>
                <Feather name="upload-cloud" size={12} color="#FFFFFF" />
                <ThemedText style={styles.syncBadgeText}>Pending Sync</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="h3" style={styles.title}>{workOrder.serviceAddress}</ThemedText>
          <ThemedText type="small" style={[styles.id, { color: theme.textSecondary }]}>
            {workOrder.customerWoId}
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Customer</ThemedText>
          
          {workOrder.customerName ? (
            <View style={styles.detailItem}>
              <Feather name="user" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Name</ThemedText>
                <ThemedText type="body">{workOrder.customerName}</ThemedText>
              </View>
            </View>
          ) : null}

          {workOrder.customerPhone ? (
            <View style={styles.detailItem}>
              <Feather name="phone" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Phone</ThemedText>
                <ThemedText type="body">{workOrder.customerPhone}</ThemedText>
              </View>
            </View>
          ) : null}

          <View style={styles.detailItem}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Address</ThemedText>
              <ThemedText type="body">
                {workOrder.serviceAddress}
                {workOrder.city ? `, ${workOrder.city}` : ""}
                {workOrder.state ? `, ${workOrder.state}` : ""}
                {workOrder.zip ? ` ${workOrder.zip}` : ""}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Meter Information</ThemedText>
          
          <View style={styles.meterRow}>
            <View style={styles.meterItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Old Meter ID</ThemedText>
              <ThemedText type="body">{workOrder.oldMeterId || "N/A"}</ThemedText>
            </View>
            {workOrder.newMeterId ? (
              <View style={styles.meterItem}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>New Meter ID</ThemedText>
                <ThemedText type="body">{workOrder.newMeterId}</ThemedText>
              </View>
            ) : null}
          </View>

          {workOrder.meterType ? (
            <View style={styles.detailItem}>
              <Feather name="box" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Meter Type</ThemedText>
                <ThemedText type="body">{workOrder.meterType}</ThemedText>
              </View>
            </View>
          ) : null}

          {workOrder.serviceType ? (
            <View style={styles.detailItem}>
              <Feather name="settings" size={16} color={theme.textSecondary} />
              <View style={styles.detailContent}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>Service Type</ThemedText>
                <ThemedText type="body">{workOrder.serviceType}</ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Assignment</ThemedText>
          
          <View style={styles.detailItem}>
            <Feather name="user" size={16} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Assigned To</ThemedText>
              <ThemedText type="body">
                {workOrder.assignedUserDisplayName || workOrder.assignedUserUsername || "Unassigned"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Feather name="calendar" size={16} color={theme.textSecondary} />
            <View style={styles.detailContent}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Scheduled Date</ThemedText>
              <ThemedText type="body">{formatDate(workOrder.scheduledDate)}</ThemedText>
            </View>
          </View>
        </View>

        {workOrder.notes ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>Notes</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {workOrder.notes}
            </ThemedText>
          </View>
        ) : null}

        {workOrder.troubleCode || workOrder.troubleNote ? (
          <View style={[styles.section, { backgroundColor: theme.error + "10" }]}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.error }]}>
              Trouble Report
            </ThemedText>
            {workOrder.troubleCode ? (
              <ThemedText type="body">Code: {workOrder.troubleCode}</ThemedText>
            ) : null}
            {workOrder.troubleNote ? (
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {workOrder.troubleNote}
              </ThemedText>
            ) : null}
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
          {workOrder.completedAt ? (
            <ThemedText type="small" style={{ color: theme.success }}>
              Completed: {formatDate(workOrder.completedAt)}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>

      <View style={[
        styles.bottomAction,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: insets.bottom + Spacing.lg,
        }
      ]}>
        {canClaim && !isCompleted ? (
          <Button
            onPress={handleClaim}
            style={[styles.claimButton, { backgroundColor: theme.backgroundSecondary }]}
            disabled={isClaiming}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <>
                <Feather name="user-plus" size={16} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>Claim</ThemedText>
              </>
            )}
          </Button>
        ) : null}
        <Button
          onPress={handleProcess}
          style={[styles.processButton, { backgroundColor: theme.primary }]}
          disabled={isCompleted}
        >
          {isCompleted ? "Completed" : "Start Meter Changeout"}
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
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  syncBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
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
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  meterRow: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  meterItem: {
    flex: 1,
    gap: 2,
  },
  timestampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: Spacing.md,
  },
  claimButton: {
    flex: 0,
    paddingHorizontal: Spacing.lg,
  },
  processButton: {
    flex: 1,
  },
});
