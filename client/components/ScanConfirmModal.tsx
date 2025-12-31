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

interface ScanConfirmModalProps {
  visible: boolean;
  meterId: string;
  workOrder: WorkOrder | undefined;
  matchSource?: MatchSource;
  isSearching?: boolean;
  searchError?: string | null;
  isOffline?: boolean;
  onConfirm: () => void;
  onScanAgain: () => void;
  onClose: () => void;
}

export function ScanConfirmModal({ 
  visible, 
  meterId, 
  workOrder, 
  matchSource = "local",
  isSearching = false,
  searchError = null,
  isOffline = false,
  onConfirm, 
  onScanAgain, 
  onClose 
}: ScanConfirmModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const getTitle = () => {
    if (isSearching) return "Searching...";
    if (searchError) return "Search Failed";
    if (workOrder) {
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
              name={workOrder ? "check-circle" : searchError ? "x-circle" : "alert-circle"} 
              size={56} 
              color={workOrder ? theme.success : searchError ? (theme.error || theme.warning) : theme.warning} 
            />
          )}
          
          <ThemedText type="h4" style={styles.title}>
            {getTitle()}
          </ThemedText>
          
          <View style={[styles.meterIdBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Scanned Meter ID
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
                <View style={styles.infoRow}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Status:</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "500" }}>{workOrder.status}</ThemedText>
                </View>
              </View>
            </>
          ) : (
            <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
              {getNoMatchMessage()}
            </ThemedText>
          )}

          {!isSearching ? (
            <View style={styles.buttonRow}>
              {workOrder ? (
                <Button
                  onPress={onConfirm}
                  style={{ backgroundColor: theme.primary, flex: 1 }}
                >
                  <Icon name="arrow-right" size={18} color="#FFFFFF" />
                  Start Wizard
                </Button>
              ) : null}
              <Button
                onPress={onScanAgain}
                style={{ backgroundColor: theme.backgroundSecondary, flex: workOrder ? 0 : 1, minWidth: 120 }}
              >
                <Icon name="refresh-cw" size={18} color={theme.text} />
                <ThemedText>Scan Again</ThemedText>
              </Button>
            </View>
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
