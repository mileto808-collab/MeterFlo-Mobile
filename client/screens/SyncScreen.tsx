import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icons";

import { useTheme } from "@/hooks/useTheme";
import { useOffline, SyncHistoryEntry } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { createBackupZip, shareBackup, saveBackupToFolder, BackupProgress } from "@/lib/backup";

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isOnline, pendingActions, syncHistory, isSyncing, syncPendingActions, clearAllPending, clearSyncHistory, removePendingAction } = useOffline();
  const { lastSyncTime, isLoading, refreshWorkOrders, clearAllData, workOrders, updateWorkOrder, deleteLocalWorkOrder } = useWorkOrders();
  const [isClearing, setIsClearing] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "update": return "Update";
      case "complete": return "Complete";
      case "workflow": return "Workflow";
      default: return type;
    }
  };
  
  const formatHistoryTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  
  const getStatusIcon = (status: SyncHistoryEntry["status"]) => {
    switch (status) {
      case "success": return "check-circle";
      case "failed": return "x-circle";
      case "partial": return "alert-circle";
    }
  };
  
  const getStatusColor = (status: SyncHistoryEntry["status"]) => {
    switch (status) {
      case "success": return theme.success;
      case "failed": return theme.error;
      case "partial": return theme.warning;
    }
  };

  const handleSync = async () => {
    await refreshWorkOrders(true);
    if (pendingActions.length > 0) {
      const { syncedWorkOrderIds, conflictedWorkOrderIds } = await syncPendingActions();
      for (const workOrderId of syncedWorkOrderIds) {
        updateWorkOrder(workOrderId, { syncPending: false });
      }
      if (conflictedWorkOrderIds.length > 0) {
        console.log(`[SyncScreen] ${conflictedWorkOrderIds.length} work orders conflicted, deleting local data`);
        for (const workOrderId of conflictedWorkOrderIds) {
          await deleteLocalWorkOrder(workOrderId);
        }
        if (Platform.OS !== "web") {
          Alert.alert(
            "Work Orders Removed",
            `${conflictedWorkOrderIds.length} work order${conflictedWorkOrderIds.length !== 1 ? "s were" : " was"} already claimed by another user and removed from your device.`
          );
        }
      }
    }
  };

  const handleRemovePendingAction = (actionId: string, title: string) => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" && window.confirm(`Remove "${title}" from pending actions? This cannot be undone.`);
      if (confirmed) {
        removePendingAction(actionId);
      }
    } else {
      Alert.alert(
        "Remove Pending Action",
        `Remove "${title}" from pending actions? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Remove", 
            style: "destructive",
            onPress: () => removePendingAction(actionId)
          }
        ]
      );
    }
  };

  const handleClearAllData = async () => {
    const doBackupAndClear = async () => {
      setIsClearing(true);
      
      try {
        if (workOrders.length > 0) {
          setShowBackupModal(true);
          setBackupProgress({
            stage: "preparing",
            current: 0,
            total: 1,
            message: "Preparing backup...",
          });
          
          const backupPath = await createBackupZip(workOrders, setBackupProgress);
          
          setShowBackupModal(false);
          setBackupProgress(null);
          
          if (Platform.OS !== "web") {
            const isAndroid = Platform.OS === "android";
            
            const alertButtons = isAndroid 
              ? [
                  { text: "Cancel", style: "cancel" as const, onPress: () => "cancel" },
                  { text: "Share", onPress: () => "share" },
                  { text: "Save to Folder", onPress: () => "save" },
                ]
              : [
                  { text: "Cancel", style: "cancel" as const, onPress: () => "cancel" },
                  { text: "Share or Save", onPress: () => "share" },
                ];
            
            const alertMessage = isAndroid
              ? "Your backup has been created. What would you like to do with it?"
              : "Your backup has been created. Tap 'Share or Save' to save to Files or share via other apps.";
            
            const userChoice = await new Promise<"save" | "share" | "cancel">((resolve) => {
              Alert.alert(
                "Backup Ready",
                alertMessage,
                alertButtons.map(btn => ({
                  ...btn,
                  onPress: () => resolve(btn.onPress() as "save" | "share" | "cancel")
                })),
                { cancelable: false }
              );
            });
            
            if (userChoice === "cancel") {
              setIsClearing(false);
              return;
            }
            
            let savedLocation: string | null = null;
            
            if (userChoice === "save" && isAndroid) {
              savedLocation = await saveBackupToFolder(backupPath);
              if (!savedLocation) {
                const tryAgain = await new Promise<boolean>((resolve) => {
                  Alert.alert(
                    "Save Cancelled",
                    "No folder was selected. Would you like to try again?",
                    [
                      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                      { text: "Try Again", onPress: () => resolve(true) },
                    ],
                    { cancelable: false }
                  );
                });
                if (tryAgain) {
                  savedLocation = await saveBackupToFolder(backupPath);
                }
                if (!savedLocation) {
                  setIsClearing(false);
                  return;
                }
              }
            } else {
              await shareBackup(backupPath);
            }
            
            const confirmMessage = savedLocation 
              ? `Your backup has been saved to "${savedLocation}". Proceed to clear data and refresh?`
              : "Make sure you saved the backup file. Proceed to clear data and refresh?";
            
            const shouldProceed = await new Promise<boolean>((resolve) => {
              Alert.alert(
                "Backup Complete",
                confirmMessage,
                [
                  { 
                    text: "Cancel", 
                    style: "cancel",
                    onPress: () => resolve(false)
                  },
                  { 
                    text: "Clear & Refresh", 
                    style: "destructive", 
                    onPress: () => resolve(true)
                  },
                ],
                { cancelable: false }
              );
            });
            
            if (!shouldProceed) {
              setIsClearing(false);
              return;
            }
          }
        }
        
        setShowBackupModal(true);
        setBackupProgress({
          stage: "complete",
          current: 1,
          total: 1,
          message: "Clearing cached data...",
        });
        
        await clearAllPending();
        await clearAllData();
        
        setBackupProgress({
          stage: "complete",
          current: 1,
          total: 1,
          message: "Fetching fresh data from server...",
        });
        
        await refreshWorkOrders(true);
        
        setShowBackupModal(false);
        setBackupProgress(null);
        
        if (Platform.OS !== "web") {
          Alert.alert("Success", workOrders.length > 0 
            ? "Backup created and data refreshed from server."
            : "Data refreshed from server."
          );
        }
      } catch (err) {
        setShowBackupModal(false);
        setBackupProgress(null);
        const message = err instanceof Error ? err.message : "Failed to backup/clear data";
        if (Platform.OS === "web") {
          alert(message);
        } else {
          Alert.alert("Error", message);
        }
      } finally {
        setIsClearing(false);
      }
    };

    const hasData = workOrders.length > 0;
    const confirmMessage = hasData
      ? "This will create a backup of all cached work orders and photos to your device, then fetch fresh data from the server. Continue?"
      : "This will fetch fresh data from the server. Continue?";
    const confirmButton = hasData ? "Backup & Refresh" : "Refresh";

    if (Platform.OS === "web") {
      if (confirm(confirmMessage)) {
        doBackupAndClear();
      }
    } else {
      Alert.alert(
        "Clear All Data",
        confirmMessage,
        [
          { text: "Cancel", style: "cancel" },
          { text: confirmButton, style: "destructive", onPress: doBackupAndClear },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.statusCard, { backgroundColor: isOnline ? theme.success + "15" : theme.warning + "15" }]}>
        <View style={[styles.statusIcon, { backgroundColor: isOnline ? theme.success : theme.warning }]}>
          <Icon name={isOnline ? "wifi" : "wifi-off"} size={24} color="#FFFFFF" />
        </View>
        <View style={styles.statusContent}>
          <ThemedText type="h4">{isOnline ? "Connected" : "Offline"}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {isOnline 
              ? "All changes will sync automatically" 
              : "Changes will be queued until connected"
            }
          </ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Last Sync</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {formatTime(lastSyncTime)}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Pending Actions</ThemedText>
          <View style={[styles.countBadge, { backgroundColor: pendingActions.length > 0 ? theme.syncPending : theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: pendingActions.length > 0 ? "#FFFFFF" : theme.textSecondary }}>
              {pendingActions.length}
            </ThemedText>
          </View>
        </View>

        {pendingActions.length > 0 ? (
          <View style={styles.pendingList}>
            {pendingActions.map(action => (
              <View key={action.id} style={[styles.pendingItem, { borderColor: theme.border }]}>
                <View style={styles.pendingItemContent}>
                  <View style={[styles.actionTypeBadge, { backgroundColor: theme.syncPending }]}>
                    <ThemedText type="caption" style={{ color: "#FFFFFF" }}>
                      {getActionTypeLabel(action.type)}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" numberOfLines={1} style={{ flex: 1 }}>
                    {action.workOrderTitle}
                  </ThemedText>
                </View>
                <View style={styles.pendingItemActions}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {new Date(action.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                  <Pressable
                    onPress={() => handleRemovePendingAction(action.id, action.workOrderTitle)}
                    style={({ pressed }) => [
                      styles.removeActionButton,
                      { opacity: pressed ? 0.6 : 1 }
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="x" size={16} color={theme.error} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="check-circle" size={32} color={theme.success} />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              All changes are synced
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          onPress={handleSync}
          disabled={!isOnline || isLoading || isSyncing}
          style={{ backgroundColor: theme.primary }}
        >
          {isLoading || isSyncing ? (
            <View style={styles.syncingContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>Syncing...</ThemedText>
            </View>
          ) : (
            "Sync Now"
          )}
        </Button>

        {pendingActions.length > 0 ? (
          <Pressable
            onPress={clearAllPending}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name="trash-2" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error }}>
              Clear All Pending
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Cached Data</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {workOrders.length} work orders
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Clear all cached data and fetch fresh work orders from the server.
        </ThemedText>
        <Pressable
          onPress={handleClearAllData}
          disabled={isClearing || !isOnline}
          style={({ pressed }) => [
            styles.clearDataButton,
            { 
              backgroundColor: theme.error + "15",
              opacity: (pressed || isClearing || !isOnline) ? 0.5 : 1 
            },
          ]}
        >
          {isClearing ? (
            <ActivityIndicator size="small" color={theme.error} />
          ) : (
            <Icon name="refresh-cw" size={18} color={theme.error} />
          )}
          <ThemedText type="body" style={{ color: theme.error }}>
            {isClearing ? "Clearing..." : "Clear All Data & Refresh"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Upload History</ThemedText>
          {syncHistory.length > 0 ? (
            <Pressable onPress={clearSyncHistory}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Clear
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {syncHistory.length > 0 ? (
          <View style={styles.historyList}>
            {syncHistory.slice(0, 10).map((entry) => (
              <View key={entry.id} style={[styles.historyItem, { borderColor: theme.border }]}>
                <View style={styles.historyItemHeader}>
                  <View style={styles.historyItemStatus}>
                    <Icon 
                      name={getStatusIcon(entry.status)} 
                      size={16} 
                      color={getStatusColor(entry.status)} 
                    />
                    <ThemedText type="body" style={{ color: getStatusColor(entry.status) }}>
                      {entry.status === "success" ? "Success" : entry.status === "failed" ? "Failed" : "Partial"}
                    </ThemedText>
                  </View>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {formatHistoryTime(entry.timestamp)}
                  </ThemedText>
                </View>
                
                <View style={styles.historyItemDetails}>
                  <View style={styles.historyDetailRow}>
                    <Icon name="file-text" size={12} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {entry.workOrderTitles.length} work order{entry.workOrderTitles.length !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  
                  {entry.photoCount > 0 ? (
                    <View style={styles.historyDetailRow}>
                      <Icon name="camera" size={12} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {entry.photoCount} photo{entry.photoCount !== 1 ? "s" : ""}
                      </ThemedText>
                    </View>
                  ) : null}
                  
                  {entry.successCount > 0 && entry.failedCount > 0 ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {entry.successCount} succeeded, {entry.failedCount} failed
                    </ThemedText>
                  ) : null}
                </View>
                
                {entry.errorMessage ? (
                  <View style={[styles.errorBox, { backgroundColor: theme.error + "10" }]}>
                    <ThemedText type="caption" style={{ color: theme.error }}>
                      {entry.errorMessage}
                    </ThemedText>
                  </View>
                ) : null}
                
                {entry.workOrderTitles.length > 0 && entry.workOrderTitles.length <= 3 ? (
                  <View style={styles.workOrderList}>
                    {entry.workOrderTitles.map((title, idx) => (
                      <ThemedText key={idx} type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
                        {title}
                      </ThemedText>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="clock" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              No upload history yet
            </ThemedText>
          </View>
        )}
      </View>

      <Modal
        visible={showBackupModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="h4" style={styles.modalTitle}>
              {backupProgress?.stage === "complete" ? "Please Wait" : "Creating Backup"}
            </ThemedText>
            {backupProgress ? (
              <>
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  {backupProgress.message}
                </ThemedText>
                {backupProgress.total > 1 ? (
                  <View style={styles.progressContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          backgroundColor: theme.primary,
                          width: `${(backupProgress.current / backupProgress.total) * 100}%` 
                        }
                      ]} 
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.lg,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  statusContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  pendingList: {
    gap: Spacing.sm,
  },
  pendingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  pendingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  actionTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  pendingItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  removeActionButton: {
    padding: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  actions: {
    gap: Spacing.lg,
  },
  syncingContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  clearDataButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  historyList: {
    gap: Spacing.md,
  },
  historyItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyItemStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  historyItemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  historyDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  errorBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  workOrderList: {
    gap: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
  },
  progressContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
});
