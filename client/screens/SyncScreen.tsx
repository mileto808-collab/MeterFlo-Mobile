import React from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useOffline } from "@/contexts/OfflineContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isOnline, pendingActions, lastSyncTime, isSyncing, syncPendingActions, clearAllPending } = useOffline();

  const formatTime = (date: Date | null) => {
    if (!date) return "Never";
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
          <Feather name={isOnline ? "wifi" : "wifi-off"} size={24} color="#FFFFFF" />
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
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {new Date(action.timestamp).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={theme.success} />
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              All changes are synced
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          onPress={syncPendingActions}
          disabled={!isOnline || pendingActions.length === 0 || isSyncing}
          style={{ backgroundColor: theme.primary }}
        >
          {isSyncing ? (
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
            <Feather name="trash-2" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error }}>
              Clear All Pending
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
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
});
