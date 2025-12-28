import React, { useMemo, useState, useLayoutEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { Accordion } from "@/components/Accordion";
import { Spacing, BorderRadius } from "@/constants/theme";

type RouteProps = RouteProp<RootStackParamList, "WorkOrderDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function InfoRow({ 
  icon, 
  label, 
  value, 
  onPress,
}: { 
  icon: keyof typeof Feather.glyphMap; 
  label: string; 
  value?: string | null;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  if (!value) return null;

  const content = (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={theme.textSecondary} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
        <ThemedText type="body" style={onPress ? { color: theme.primary } : undefined}>{value}</ThemedText>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function GridItem({ label, value }: { label: string; value?: string | null }) {
  const { theme } = useTheme();
  return (
    <View style={styles.gridItem}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
      <ThemedText type="body">{value || "N/A"}</ThemedText>
    </View>
  );
}

export default function WorkOrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const { workOrders, referenceData, claimWorkOrder, fetchSingleWorkOrder } = useWorkOrders();
  const { user } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const workOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === route.params.workOrder.id) || route.params.workOrder;
  }, [workOrders, route.params.workOrder]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchSingleWorkOrder(workOrder.id);
      if (Platform.OS !== "web") {
        Alert.alert("Refreshed", "Work order details updated from server.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh work order";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSingleWorkOrder, workOrder.id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleRefresh}
          disabled={isRefreshing}
          accessibilityLabel="Refresh work order"
          accessibilityRole="button"
          style={({ pressed }) => ({
            opacity: pressed || isRefreshing ? 0.5 : 1,
            paddingHorizontal: 16,
            paddingVertical: 8,
          })}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather name="refresh-cw" size={22} color={theme.primary} />
          )}
        </Pressable>
      ),
    });
  }, [navigation, handleRefresh, isRefreshing, theme.primary]);

  const isAssignedToMe = workOrder.assignedUserId === user?.id;
  const canClaim = !workOrder.assignedUserId || !isAssignedToMe;
  const isCompleted = workOrder.status.toLowerCase() === "completed";
  const isCancelled = workOrder.status.toLowerCase() === "cancelled";

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTroubleCodeLabel = (code?: string) => {
    if (!code) return null;
    const found = referenceData?.troubleCodes.find(tc => tc.code === code);
    return found ? `${found.code} - ${found.description}` : code;
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

  const handleCallPhone = () => {
    if (workOrder.customerPhone) {
      Linking.openURL(`tel:${workOrder.customerPhone}`);
    }
  };

  const handleOpenMaps = () => {
    const address = `${workOrder.serviceAddress}, ${workOrder.city || ""} ${workOrder.state || ""} ${workOrder.zip || ""}`.trim();
    const encodedAddress = encodeURIComponent(address);
    if (Platform.OS === "ios") {
      Linking.openURL(`maps:?q=${encodedAddress}`);
    } else {
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
    }
  };

  const fullAddress = [
    workOrder.serviceAddress,
    workOrder.city,
    workOrder.state ? `${workOrder.state} ${workOrder.zip || ""}`.trim() : workOrder.zip,
  ].filter(Boolean).join(", ");

  const attachmentCount = workOrder.attachments?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { 
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing["5xl"] + 60,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderLeftColor: theme.primary }]}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryLeft}>
              <ThemedText type="h3" style={styles.woTitle}>
                {workOrder.customerWoId || `WO #${workOrder.id}`}
              </ThemedText>
              <View style={styles.badgeRow}>
                <StatusBadge status={workOrder.status} />
                {workOrder.serviceType ? (
                  <View style={[styles.serviceTypeBadge, { backgroundColor: theme.primary + "20" }]}>
                    <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
                      {workOrder.serviceType}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.syncPending ? (
                  <View style={[styles.syncBadge, { backgroundColor: theme.warning }]}>
                    <Feather name="upload-cloud" size={12} color="#FFFFFF" />
                    <ThemedText style={styles.syncBadgeText}>Pending</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.quickInfo}>
            <Pressable 
              onPress={handleOpenMaps}
              style={({ pressed }) => [styles.quickInfoItem, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="map-pin" size={14} color={theme.primary} style={styles.quickInfoIcon} />
              <ThemedText type="small" style={{ color: theme.primary, flex: 1 }}>
                {fullAddress || "No address"}
              </ThemedText>
            </Pressable>

            {workOrder.customerName ? (
              <View style={styles.quickInfoItem}>
                <Feather name="user" size={14} color={theme.textSecondary} style={styles.quickInfoIcon} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  {workOrder.customerName}
                </ThemedText>
              </View>
            ) : null}

            {workOrder.scheduledDate ? (
              <View style={styles.quickInfoItem}>
                <Feather name="calendar" size={14} color={theme.textSecondary} style={styles.quickInfoIcon} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  {formatDate(workOrder.scheduledDate)}
                </ThemedText>
              </View>
            ) : null}

            {workOrder.assignedUserDisplayName || workOrder.assignedUserUsername ? (
              <View style={styles.quickInfoItem}>
                <Feather name="user-check" size={14} color={theme.textSecondary} style={styles.quickInfoIcon} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  {workOrder.assignedUserDisplayName || workOrder.assignedUserUsername}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {attachmentCount > 0 ? (
            <View style={styles.attachmentInfo}>
              <Feather name="paperclip" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {attachmentCount} attachment{attachmentCount !== 1 ? "s" : ""}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <Accordion title="Customer & Site" icon="home" defaultExpanded>
          <InfoRow icon="hash" label="Customer ID" value={workOrder.customerId} />
          <InfoRow icon="user" label="Customer Name" value={workOrder.customerName} />
          <InfoRow 
            icon="map-pin" 
            label="Address" 
            value={fullAddress}
            onPress={handleOpenMaps}
          />
          <InfoRow 
            icon="phone" 
            label="Phone" 
            value={workOrder.customerPhone}
            onPress={workOrder.customerPhone ? handleCallPhone : undefined}
          />
          <InfoRow icon="mail" label="Email" value={workOrder.customerEmail} />
          <View style={styles.gridRow}>
            <GridItem label="Route" value={workOrder.route} />
            <GridItem label="Zone" value={workOrder.zone} />
          </View>
        </Accordion>

        <Accordion title="Meter Details" icon="cpu" defaultExpanded>
          <View style={[styles.meterSection, { borderLeftColor: theme.textSecondary }]}>
            <ThemedText type="h4" style={[styles.meterSectionTitle, { color: theme.textSecondary }]}>
              Old Meter
            </ThemedText>
            <View style={styles.gridRow}>
              <GridItem label="Meter ID" value={workOrder.oldMeterId} />
              <GridItem label="Reading" value={workOrder.oldMeterReading} />
            </View>
            <View style={styles.gridRow}>
              <GridItem label="Type" value={workOrder.oldMeterType || workOrder.meterType} />
              <GridItem label="GPS" value={workOrder.oldGps} />
            </View>
          </View>

          {workOrder.newMeterId || workOrder.newMeterReading || workOrder.newMeterType || workOrder.newGps ? (
            <View style={[styles.meterSection, { borderLeftColor: theme.success }]}>
              <ThemedText type="h4" style={[styles.meterSectionTitle, { color: theme.success }]}>
                New Meter
              </ThemedText>
              <View style={styles.gridRow}>
                <GridItem label="Meter ID" value={workOrder.newMeterId} />
                <GridItem label="Reading" value={workOrder.newMeterReading} />
              </View>
              <View style={styles.gridRow}>
                <GridItem label="Type" value={workOrder.newMeterType} />
                <GridItem label="GPS" value={workOrder.newGps} />
              </View>
            </View>
          ) : null}

          {workOrder.signatureName || workOrder.signatureData ? (
            <View style={styles.signatureSection}>
              <ThemedText type="h4" style={styles.meterSectionTitle}>Signature</ThemedText>
              {workOrder.signatureName ? (
                <ThemedText type="body">{workOrder.signatureName}</ThemedText>
              ) : null}
              {workOrder.signatureData ? (
                <View style={[styles.signatureIndicator, { backgroundColor: theme.success + "20" }]}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.success }}>Signature captured</ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </Accordion>

        <Accordion title="Scheduling & Assignment" icon="calendar">
          <InfoRow 
            icon="flag" 
            label="Status" 
            value={workOrder.status} 
          />
          <InfoRow 
            icon="calendar" 
            label="Scheduled Date" 
            value={formatDateTime(workOrder.scheduledDate)} 
          />
          <InfoRow 
            icon="user" 
            label="Scheduled By" 
            value={workOrder.scheduledByUsername} 
          />
          <InfoRow 
            icon="user-check" 
            label="Assigned User" 
            value={workOrder.assignedUserDisplayName || workOrder.assignedUserUsername} 
          />
          <InfoRow 
            icon="users" 
            label="Assigned Group" 
            value={workOrder.assignedGroupName || workOrder.assignedGroupId} 
          />
          {workOrder.troubleCode ? (
            <View style={[styles.troubleSection, { backgroundColor: theme.error + "10" }]}>
              <View style={styles.troubleHeader}>
                <Feather name="alert-triangle" size={16} color={theme.error} />
                <ThemedText type="body" style={{ color: theme.error, fontWeight: "600" }}>
                  Trouble Code
                </ThemedText>
              </View>
              <ThemedText type="body">{getTroubleCodeLabel(workOrder.troubleCode)}</ThemedText>
            </View>
          ) : null}
        </Accordion>

        {workOrder.notes ? (
          <Accordion title="Notes" icon="file-text">
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {workOrder.notes}
            </ThemedText>
          </Accordion>
        ) : null}

        {attachmentCount > 0 ? (
          <Accordion title={`Attachments (${attachmentCount})`} icon="paperclip">
            <View style={styles.attachmentList}>
              {workOrder.attachments?.map((attachment, index) => {
                let url = "";
                let filename = `Attachment ${index + 1}`;
                
                if (typeof attachment === "string") {
                  url = attachment;
                  filename = attachment.split("/").pop() || filename;
                } else if (attachment && typeof attachment === "object") {
                  const attachObj = attachment as { url?: string; filename?: string; name?: string; id?: string };
                  url = attachObj.url || "";
                  filename = attachObj.filename || attachObj.name || attachObj.id || filename;
                }
                
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                
                return (
                  <Pressable
                    key={index}
                    onPress={() => {
                      if (url) {
                        Linking.openURL(url);
                      } else {
                        if (Platform.OS === "web") {
                          alert("Unable to open attachment - no URL available");
                        } else {
                          Alert.alert("Error", "Unable to open attachment - no URL available");
                        }
                      }
                    }}
                    style={({ pressed }) => [
                      styles.attachmentItem,
                      { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather 
                      name={isImage ? "image" : "file"} 
                      size={18} 
                      color={theme.primary} 
                    />
                    <View style={styles.attachmentContent}>
                      <ThemedText type="body" numberOfLines={1} style={{ flex: 1 }}>
                        {filename}
                      </ThemedText>
                    </View>
                    <Feather name="external-link" size={16} color={theme.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          </Accordion>
        ) : null}

        <Accordion title="Audit Information" icon="clock">
          <View style={styles.auditGrid}>
            <View style={styles.auditItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Created By</ThemedText>
              <ThemedText type="small">{workOrder.createdByUsername || workOrder.createdBy || "N/A"}</ThemedText>
            </View>
            <View style={styles.auditItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Created At</ThemedText>
              <ThemedText type="small">{formatDateTime(workOrder.createdAt) || "N/A"}</ThemedText>
            </View>
            <View style={styles.auditItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Updated By</ThemedText>
              <ThemedText type="small">{workOrder.updatedByUsername || workOrder.updatedBy || "N/A"}</ThemedText>
            </View>
            <View style={styles.auditItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Updated At</ThemedText>
              <ThemedText type="small">{formatDateTime(workOrder.updatedAt) || "N/A"}</ThemedText>
            </View>
            {workOrder.completedAt ? (
              <>
                <View style={styles.auditItem}>
                  <ThemedText type="caption" style={{ color: theme.success }}>Completed By</ThemedText>
                  <ThemedText type="small" style={{ color: theme.success }}>
                    {workOrder.completedByUsername || workOrder.completedBy || "N/A"}
                  </ThemedText>
                </View>
                <View style={styles.auditItem}>
                  <ThemedText type="caption" style={{ color: theme.success }}>Completed At</ThemedText>
                  <ThemedText type="small" style={{ color: theme.success }}>
                    {formatDateTime(workOrder.completedAt)}
                  </ThemedText>
                </View>
              </>
            ) : null}
          </View>
        </Accordion>
      </ScrollView>

      <View style={[
        styles.bottomAction,
        { 
          backgroundColor: theme.backgroundRoot,
          paddingBottom: insets.bottom + Spacing.lg,
        }
      ]}>
        {canClaim && !isCompleted && !isCancelled ? (
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
          style={[styles.processButton, { backgroundColor: isCompleted || isCancelled ? theme.backgroundSecondary : theme.primary }]}
          disabled={isCompleted || isCancelled}
        >
          <Feather 
            name={isCompleted ? "check-circle" : isCancelled ? "x-circle" : "play-circle"} 
            size={18} 
            color={isCompleted || isCancelled ? theme.textSecondary : "#FFFFFF"} 
          />
          <ThemedText 
            style={{ 
              marginLeft: Spacing.sm, 
              color: isCompleted || isCancelled ? theme.textSecondary : "#FFFFFF",
              fontWeight: "600",
            }}
          >
            {isCompleted ? "Completed" : isCancelled ? "Cancelled" : "Start Meter Changeout"}
          </ThemedText>
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
    gap: Spacing.md,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    gap: Spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLeft: {
    flex: 1,
    gap: Spacing.sm,
  },
  woTitle: {
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  serviceTypeBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
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
  quickInfo: {
    gap: Spacing.xs,
  },
  quickInfoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  quickInfoIcon: {
    marginTop: 2,
  },
  attachmentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  gridRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  gridItem: {
    flex: 1,
    gap: 2,
  },
  meterSection: {
    paddingLeft: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  meterSectionTitle: {
    marginBottom: Spacing.xs,
  },
  signatureSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  signatureIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  troubleSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  troubleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  auditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  auditItem: {
    width: "45%",
    gap: 2,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentList: {
    gap: Spacing.sm,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  attachmentContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
});
