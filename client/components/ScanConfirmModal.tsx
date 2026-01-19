import React from "react";
import { View, StyleSheet, Modal, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icons";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export type MatchSource = "local" | "server" | "none";
export type MatchFieldType = "systemId" | "moduleId" | "workOrderId" | "address" | "none";

// Label map for displaying match type to users
export const MATCH_FIELD_LABELS: Record<MatchFieldType, string> = {
  systemId: "Matched by System ID",
  moduleId: "Matched by Module ID",
  workOrderId: "Matched by Work Order",
  address: "Matched by Address",
  none: "Scanned ID",
};

/**
 * Shared helper to determine match field type with consistent priority ordering.
 * Priority: System ID (exact) > Module ID (exact) > Work Order ID (exact) > Address (partial)
 * Use this across all search paths (local, server, scan) for consistent behavior.
 */
export function determineMatchFieldType(
  workOrder: WorkOrder,
  searchTerm: string
): MatchFieldType {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  
  const oldSystemId = workOrder.oldSystemId?.trim().toLowerCase() || "";
  const newSystemId = workOrder.newSystemId?.trim().toLowerCase() || "";
  const oldModuleId = workOrder.oldModuleId?.trim().toLowerCase() || "";
  const newModuleId = workOrder.newModuleId?.trim().toLowerCase() || "";
  const customerWoId = workOrder.customerWoId?.trim().toLowerCase() || "";
  const internalId = String(workOrder.id).toLowerCase();
  const serviceAddress = workOrder.serviceAddress?.trim().toLowerCase() || "";
  
  // Priority 1: System ID (exact match)
  if (oldSystemId === normalizedTerm || newSystemId === normalizedTerm) {
    return "systemId";
  }
  
  // Priority 2: Module ID (exact match)
  if (oldModuleId === normalizedTerm || newModuleId === normalizedTerm) {
    return "moduleId";
  }
  
  // Priority 3: Work Order ID (exact match on either customer ID or internal ID)
  if (customerWoId === normalizedTerm || internalId === normalizedTerm) {
    return "workOrderId";
  }
  
  // Priority 4: Address (partial/substring match)
  if (serviceAddress.includes(normalizedTerm)) {
    return "address";
  }
  
  return "none";
}

// Priority ordering for match types (lower index = higher priority)
const MATCH_PRIORITY: MatchFieldType[] = ["systemId", "moduleId", "workOrderId", "address", "none"];

/**
 * Find the highest priority match type across multiple work orders.
 * Use when you have multiple matches and need to determine the best label to display.
 */
export function findHighestPriorityMatchType(
  workOrders: WorkOrder[],
  searchTerm: string
): MatchFieldType {
  let highestPriority: MatchFieldType = "none";
  let highestPriorityIndex = MATCH_PRIORITY.indexOf("none");
  
  for (const wo of workOrders) {
    const matchType = determineMatchFieldType(wo, searchTerm);
    const priorityIndex = MATCH_PRIORITY.indexOf(matchType);
    if (priorityIndex < highestPriorityIndex) {
      highestPriority = matchType;
      highestPriorityIndex = priorityIndex;
    }
    // Early exit if we found the highest priority match
    if (highestPriorityIndex === 0) break;
  }
  
  return highestPriority;
}

interface ScanConfirmModalProps {
  visible: boolean;
  meterId: string;
  workOrder: WorkOrder | undefined;
  matchSource?: MatchSource;
  matchFieldType?: MatchFieldType;
  isSearching?: boolean;
  searchError?: string | null;
  isOffline?: boolean;
  isAlreadyCompleted?: boolean;
  isManualSearch?: boolean;
  onConfirm: () => void;
  onScanAgain: () => void;
  onEditSearch?: () => void;
  onClose: () => void;
}

export function ScanConfirmModal({ 
  visible, 
  meterId, 
  workOrder, 
  matchSource = "local",
  matchFieldType = "none",
  isSearching = false,
  searchError = null,
  isOffline = false,
  isAlreadyCompleted = false,
  isManualSearch = false,
  onConfirm, 
  onScanAgain,
  onEditSearch,
  onClose 
}: ScanConfirmModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const getTitle = () => {
    if (isSearching) return "Searching...";
    if (searchError) return "Search Failed";
    if (workOrder) {
      if (isAlreadyCompleted) return "Already Completed";
      if (matchSource === "server") return "Found on Server";
      return "Work Order Found";
    }
    return "No Match Found";
  };

  const getNoMatchMessage = () => {
    if (searchError) return searchError;
    if (isOffline) {
      return "No work order found in cached data. Go online to search the server.";
    }
    return "No work order found in cached work orders or on the server.";
  };

  const getFoundMessage = () => {
    if (matchSource === "server") {
      return "Matched from server";
    }
    return "Matched from cached work orders";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable 
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.content, 
            { 
              backgroundColor: theme.backgroundRoot,
              marginBottom: insets.bottom + Spacing.lg,
            }
          ]}
        >
          {isSearching ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : (
            <Icon 
              name={workOrder 
                ? (isAlreadyCompleted ? "check-circle" : "check-circle") 
                : (searchError ? "x-circle" : "alert-circle")
              } 
              size={56} 
              color={workOrder 
                ? (isAlreadyCompleted ? (theme.error || "#EF4444") : theme.success) 
                : (searchError ? (theme.error || "#EF4444") : theme.warning)
              } 
            />
          )}
          
          <ThemedText type="h4" style={styles.title}>
            {getTitle()}
          </ThemedText>
          
          <View style={[styles.meterIdBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {MATCH_FIELD_LABELS[matchFieldType]}
            </ThemedText>
            <ThemedText type="h3" style={{ fontWeight: "700", marginTop: Spacing.xs }}>
              {meterId}
            </ThemedText>
          </View>

          {isSearching ? (
            <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
              Checking cached work orders and searching the server...
            </ThemedText>
          ) : workOrder ? (
            <>
              {matchSource === "server" ? (
                <View style={[styles.sourceBadge, { backgroundColor: theme.primary + "20" }]}>
                  <Icon name="cloud" size={14} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                    {getFoundMessage()}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.sourceBadge, { backgroundColor: theme.success + "20" }]}>
                  <Icon name="database" size={14} color={theme.success} />
                  <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.xs }}>
                    {getFoundMessage()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.workOrderInfo}>
                <View style={styles.infoRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Work Order:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {workOrder.customerWoId || `#${workOrder.id}`}
                  </ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Address:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500", flex: 1, textAlign: "right" }} numberOfLines={2}>
                    {workOrder.serviceAddress || "No address"}
                  </ThemedText>
                </View>
                {workOrder.oldSystemId?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Old System ID:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.oldSystemId}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.oldSystemType?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Old System Type:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.oldSystemType}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.newSystemId?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>New System ID:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.newSystemId}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.newSystemType?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>New System Type:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.newSystemType}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.oldModuleId?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Old Module ID:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.oldModuleId}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.oldModuleType?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Old Module Type:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.oldModuleType}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.newModuleId?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>New Module ID:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.newModuleId}
                    </ThemedText>
                  </View>
                ) : null}
                {workOrder.newModuleType?.trim() ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>New Module Type:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.newModuleType}
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Status:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500", color: isAlreadyCompleted ? (theme.error || "#EF4444") : undefined }}>
                    {workOrder.status}
                  </ThemedText>
                </View>
                {isAlreadyCompleted && workOrder.completedByUsername ? (
                  <View style={styles.infoRow}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Completed By:</ThemedText>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {workOrder.completedByUsername}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {isAlreadyCompleted ? (
                <ThemedText type="body" style={[styles.noMatchText, { color: theme.error || "#EF4444" }]}>
                  This work order has already been completed and cannot be processed again.
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
              {getNoMatchMessage()}
            </ThemedText>
          )}

          {!isSearching ? (
            <>
              <View style={styles.buttonRow}>
                {workOrder && !isAlreadyCompleted ? (
                  <Button
                    onPress={onConfirm}
                    style={{ backgroundColor: theme.primary, flex: 1 }}
                  >
                    <Icon name="arrow-right" size={18} color="#FFFFFF" />
                    Start Changeout
                  </Button>
                ) : null}
                {!isManualSearch ? (
                  <Button
                    onPress={onScanAgain}
                    style={{ backgroundColor: theme.backgroundSecondary, flex: (workOrder && !isAlreadyCompleted) ? 0 : 1, minWidth: 120 }}
                  >
                    <Icon name="refresh-cw" size={18} color={theme.text} />
                    <ThemedText>Scan Again</ThemedText>
                  </Button>
                ) : null}
              </View>
              {onEditSearch ? (
                <Button
                  onPress={onEditSearch}
                  style={{ backgroundColor: theme.backgroundSecondary, width: "100%" }}
                >
                  <Icon name="edit-2" size={18} color={theme.text} />
                  <ThemedText>Edit Search</ThemedText>
                </Button>
              ) : null}
            </>
          ) : null}
          
          <Pressable onPress={onClose} style={styles.cancelLink}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  meterIdBox: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  workOrderInfo: {
    width: "100%",
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noMatchText: {
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  cancelLink: {
    paddingVertical: Spacing.sm,
  },
});
