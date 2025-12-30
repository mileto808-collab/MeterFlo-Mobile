import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icons";
import { WorkOrder } from "@/contexts/WorkOrderContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ScanConfirmModalProps {
  visible: boolean;
  meterId: string;
  workOrder: WorkOrder | undefined;
  onConfirm: () => void;
  onScanAgain: () => void;
  onClose: () => void;
}

export function ScanConfirmModal({ 
  visible, 
  meterId, 
  workOrder, 
  onConfirm, 
  onScanAgain, 
  onClose 
}: ScanConfirmModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

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
          <Icon 
            name={workOrder ? "check-circle" : "alert-circle"} 
            size={56} 
            color={workOrder ? theme.success : theme.warning} 
          />
          
          <ThemedText type="h4" style={styles.title}>
            {workOrder ? "Work Order Found" : "No Match Found"}
          </ThemedText>
          
          <View style={[styles.meterIdBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Scanned Meter ID
            </ThemedText>
            <ThemedText type="h3" style={{ fontWeight: "700", marginTop: Spacing.xs }}>
              {meterId}
            </ThemedText>
          </View>

          {workOrder ? (
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
          ) : (
            <ThemedText type="body" style={[styles.noMatchText, { color: theme.textSecondary }]}>
              No work order found with this meter ID. Please try scanning again or search manually.
            </ThemedText>
          )}

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
