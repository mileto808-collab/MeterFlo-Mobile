import React from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, serverUrl, projectId, projects, logout } = useAuth();
  const { isOnline } = useOffline();
  const { lastSyncTime } = useWorkOrders();

  const currentProject = projects.find(p => p.id === projectId);

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }

    Alert.alert(
      "Log Out",
      "Are you sure you want to log out? Any unsynced changes will remain on this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: logout },
      ]
    );
  };

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
      <View style={[styles.profileCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Ionicons name="person-outline" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.profileInfo}>
          <ThemedText type="h3">{user?.displayName || user?.username || "User"}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            @{user?.username || "username"}
          </ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="caption" style={{ color: theme.primary }}>
              {user?.role || "User"}
            </ThemedText>
          </View>
        </View>
      </View>

      {currentProject ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Current Project</ThemedText>
          
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="folder-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Project</ThemedText>
            </View>
            <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
              {currentProject.name}
            </ThemedText>
          </View>

          {currentProject.description ? (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Description</ThemedText>
              </View>
              <ThemedText type="body" numberOfLines={2} style={styles.infoValue}>
                {currentProject.description}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Server Connection</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Server URL</ThemedText>
          </View>
          <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
            {serverUrl || "Not configured"}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Ionicons name={isOnline ? "wifi-outline" : "cloud-offline-outline"} size={16} color={isOnline ? theme.success : theme.warning} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Status</ThemedText>
          </View>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isOnline ? theme.success + "20" : theme.warning + "20" }
          ]}>
            <ThemedText type="small" style={{ color: isOnline ? theme.success : theme.warning }}>
              {isOnline ? "Connected" : "Offline"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Last Sync</ThemedText>
          </View>
          <ThemedText type="body">{formatTime(lastSyncTime)}</ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>App Information</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Version</ThemedText>
          </View>
          <ThemedText type="body">1.0.0</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Ionicons name="phone-portrait-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>App</ThemedText>
          </View>
          <ThemedText type="body">MeterFlo Mobile</ThemedText>
        </View>
      </View>

      <View style={styles.logoutSection}>
        <Button
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: theme.error }]}
        >
          Log Out
        </Button>
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoValue: {
    flex: 1,
    textAlign: "right",
  },
  statusIndicator: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  logoutSection: {
    marginTop: Spacing.xl,
  },
  logoutButton: {},
});
