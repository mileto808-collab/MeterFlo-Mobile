import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Alert, Platform, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useWorkOrders } from "@/contexts/WorkOrderContext";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getCurrentAppVersion, checkForUpdate, UpdateInfo } from "@/lib/github-update-service";
import { UpdateAvailableModal } from "@/components/UpdateAvailableModal";

const STORAGE_KEYS = {
  UPDATE_CHECK_ENABLED: "meterflo_update_check_enabled",
  SKIPPED_VERSION: "meterflo_skipped_version",
};

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, serverUrl, projectId, projects, logout, isOfflineSession, getUpdateUrl, updateUrl } = useAuth();
  const { isOnline } = useOffline();
  const { lastSyncTime } = useWorkOrders();

  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const currentProject = projects.find(p => p.id === projectId);
  const appVersion = getCurrentAppVersion();

  useEffect(() => {
    const loadSettings = async () => {
      const enabled = await secureGet(STORAGE_KEYS.UPDATE_CHECK_ENABLED);
      setUpdateCheckEnabled(enabled !== "false");
    };
    loadSettings();
  }, []);

  const handleUpdateCheckToggle = useCallback(async (value: boolean) => {
    setUpdateCheckEnabled(value);
    await secureSet(STORAGE_KEYS.UPDATE_CHECK_ENABLED, value ? "true" : "false");
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    const url = await getUpdateUrl();
    if (!url) {
      Alert.alert("No Update Source", "No update source has been configured by your server administrator.");
      return;
    }

    setIsCheckingUpdate(true);
    try {
      const info = await checkForUpdate(url);
      if (!info) {
        Alert.alert("Check Failed", "Could not reach the update server. Please check your connection and try again.");
        return;
      }
      if (info.isUpdateAvailable) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        Alert.alert("Up to Date", `You're running the latest version (${appVersion}).`);
      }
    } catch (error) {
      Alert.alert("Check Failed", "Failed to check for updates. Please try again later.");
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [getUpdateUrl, appVersion]);

  const handleSkipVersion = useCallback(async () => {
    if (updateInfo) {
      await secureSet(STORAGE_KEYS.SKIPPED_VERSION, updateInfo.latestVersion);
    }
    setShowUpdateModal(false);
  }, [updateInfo]);

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
          <Icon name="user" size={32} color="#FFFFFF" />
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

      {isOfflineSession ? (
        <View style={[styles.offlineSessionBanner, { backgroundColor: theme.warning + "20" }]}>
          <Icon name="wifi-off" size={20} color={theme.warning} />
          <View style={styles.offlineSessionText}>
            <ThemedText type="body" style={{ color: theme.warning, fontWeight: "600" }}>
              Offline Session
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              You logged in using saved credentials. Changes will sync when you reconnect.
            </ThemedText>
          </View>
        </View>
      ) : null}

      {currentProject ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Current Project</ThemedText>
          
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Icon name="folder" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Project</ThemedText>
            </View>
            <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
              {currentProject.name}
            </ThemedText>
          </View>

          {currentProject.description ? (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Icon name="file-text" size={16} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Description</ThemedText>
              </View>
              <ThemedText type="body" numberOfLines={2} style={styles.infoValue}>
                {currentProject.description}
              </ThemedText>
            </View>
          ) : null}

          {projects.length > 1 ? (
            <Pressable
              onPress={() => navigation.navigate("ProjectSelect")}
              style={({ pressed }) => [
                styles.switchProjectButton,
                { 
                  backgroundColor: theme.primary + "15",
                  borderColor: theme.primary + "30",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Icon name="refresh-cw" size={16} color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.primary, fontWeight: "500" }}>
                Switch Project
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Server Connection</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="globe" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Server URL</ThemedText>
          </View>
          <ThemedText type="body" numberOfLines={1} style={styles.infoValue}>
            {serverUrl || "Not configured"}
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name={isOnline ? "wifi" : "wifi-off"} size={16} color={isOnline ? theme.success : theme.warning} />
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
            <Icon name="refresh-cw" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Last Sync</ThemedText>
          </View>
          <ThemedText type="body">{formatTime(lastSyncTime)}</ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>App Information</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="info" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Version</ThemedText>
          </View>
          <ThemedText type="body">{appVersion}</ThemedText>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="smartphone" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>App</ThemedText>
          </View>
          <ThemedText type="body">MeterFlo Mobile</ThemedText>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Updates</ThemedText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoLabel}>
            <Icon name="download" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Auto-check for updates</ThemedText>
          </View>
          <Switch
            value={updateCheckEnabled}
            onValueChange={handleUpdateCheckToggle}
            trackColor={{ false: theme.border, true: theme.primary + "80" }}
            thumbColor={updateCheckEnabled ? theme.primary : theme.textSecondary}
          />
        </View>

        {updateUrl ? (
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Icon name="server" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Update source</ThemedText>
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: theme.success + "20" }]}>
              <ThemedText type="small" style={{ color: theme.success }}>Configured</ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Icon name="server" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Update source</ThemedText>
            </View>
            <View style={[styles.statusIndicator, { backgroundColor: theme.warning + "20" }]}>
              <ThemedText type="small" style={{ color: theme.warning }}>Not configured</ThemedText>
            </View>
          </View>
        )}

        {Platform.OS !== "android" ? (
          <View style={[styles.platformNote, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="info" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Automatic updates are only available on Android. Use GitHub to download updates manually.
            </ThemedText>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.checkUpdateButton,
            { 
              backgroundColor: theme.primary,
              opacity: pressed || isCheckingUpdate ? 0.7 : 1,
            },
          ]}
          onPress={handleCheckForUpdates}
          disabled={isCheckingUpdate}
        >
          <Icon name="refresh-cw" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
            {isCheckingUpdate ? "Checking..." : "Check for Updates"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.logoutSection}>
        <Button
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: theme.error }]}
        >
          Log Out
        </Button>
      </View>

      <UpdateAvailableModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onClose={() => setShowUpdateModal(false)}
        onSkip={handleSkipVersion}
      />
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
  offlineSessionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  offlineSessionText: {
    flex: 1,
    gap: Spacing.xs,
  },
  platformNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  checkUpdateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  switchProjectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
